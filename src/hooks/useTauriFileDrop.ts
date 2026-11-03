import { useEffect, useRef, useState } from 'react'
import type { DragDropEvent } from '@tauri-apps/api/webview'

export type DropSide = 'A' | 'B'

type LoadPath = (filePath: string) => void | Promise<void>

interface UseTauriFileDropOptions {
  onDropA: LoadPath
  onDropB: LoadPath
}

function isTauri(): boolean {
  return Boolean((window as any).__TAURI_INTERNALS__)
}

function sideFromElement(element: Element | null): DropSide | null {
  const zone = element?.closest('[data-drop-side]')
  const side = zone?.getAttribute('data-drop-side')
  return side === 'A' || side === 'B' ? side : null
}

/**
 * Tauri's DragDropEvent type labels every position as physical, but wry
 * reports logical (CSS) pixels from GTK and WKWebView. Only WebView2 on
 * Windows actually needs the devicePixelRatio conversion.
 */
export function usesPhysicalDropPosition(userAgent = navigator.userAgent): boolean {
  return /Windows/i.test(userAgent)
}

/**
 * Resolves which drop pane is under a native Tauri drag event position.
 * elementFromPoint expects CSS pixels.
 */
export function sideAtPoint(
  x: number,
  y: number,
  scale = window.devicePixelRatio || 1,
  positionIsPhysical = usesPhysicalDropPosition()
): DropSide | null {
  const factor = positionIsPhysical ? scale : 1
  const cssX = x / factor
  const cssY = y / factor

  if (!Number.isFinite(cssX) || !Number.isFinite(cssY)) return null

  const direct = sideFromElement(document.elementFromPoint?.(cssX, cssY) ?? null)
  if (direct) return direct

  // elementFromPoint can miss when an overlay covers the pane. Fall back to
  // the drop-zone bounding boxes before giving up on the event.
  for (const element of document.querySelectorAll('[data-drop-side]')) {
    const rect = element.getBoundingClientRect()
    if (cssX >= rect.left && cssX < rect.right && cssY >= rect.top && cssY < rect.bottom) {
      return sideFromElement(element)
    }
  }

  return null
}

/**
 * Desktop file drop support.
 *
 * Tauri's native drag-drop handler stays enabled on all platforms. That is
 * required on Linux/Wayland, where WebKitGTK does not reliably deliver
 * external file drops to the HTML5 drag-and-drop API. Native events give us
 * file paths, which are automatically added to the fs plugin scope on drop.
 */
export function useTauriFileDrop({
  onDropA,
  onDropB,
}: UseTauriFileDropOptions): DropSide | null {
  const [dragOverSide, setDragOverSide] = useState<DropSide | null>(null)
  const handlersRef = useRef({ onDropA, onDropB })
  const lastSideRef = useRef<DropSide | null>(null)

  handlersRef.current = { onDropA, onDropB }

  useEffect(() => {
    if (!isTauri()) return

    let disposed = false
    let unlisten: (() => void) | undefined

    function handleEvent(event: { payload: DragDropEvent }) {
      const payload = event.payload

      if (payload.type === 'leave') {
        lastSideRef.current = null
        setDragOverSide(null)
        return
      }

      if (payload.type === 'enter' || payload.type === 'over') {
        const side = sideAtPoint(payload.position.x, payload.position.y)
        lastSideRef.current = side
        setDragOverSide(side)
        return
      }

      // drop
      const side = sideAtPoint(payload.position.x, payload.position.y) ?? lastSideRef.current
      const filePath = payload.paths[0]
      lastSideRef.current = null
      setDragOverSide(null)

      if (!side || !filePath) return

      const load = side === 'A' ? handlersRef.current.onDropA : handlersRef.current.onDropB
      void Promise.resolve(load(filePath)).catch(() => {
        // useFileLoader exposes read failures through its error state.
      })
    }

    void (async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
        if (disposed) return
        const stop = await getCurrentWebviewWindow().onDragDropEvent(handleEvent)
        if (disposed) stop()
        else unlisten = stop
      } catch {
        // No native listener available; the HTML5 drop zone remains as fallback.
      }
    })()

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  return dragOverSide
}
