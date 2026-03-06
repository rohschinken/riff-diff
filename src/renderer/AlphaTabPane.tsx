import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { AlphaTabApi, LayoutMode } from '@coderline/alphatab'
import type { model } from '@coderline/alphatab'

type Score = model.Score

export interface AlphaTabPaneHandle {
  getScrollContainer: () => HTMLDivElement | null
}

export interface AlphaTabPaneProps {
  buffer: ArrayBuffer | null
  scale?: number
  onRenderStarted?: () => void
  onRenderFinished?: (api: AlphaTabApi, contentWidth: number) => void
  onScoreLoaded?: (score: Score) => void
  children?: ReactNode
}

export const AlphaTabPane = forwardRef<AlphaTabPaneHandle, AlphaTabPaneProps>(
  function AlphaTabPane({ buffer, scale = 1.0, onRenderStarted, onRenderFinished, onScoreLoaded, children }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const initialScaleRef = useRef(scale)
  const onRenderStartedRef = useRef(onRenderStarted)
  const onRenderFinishedRef = useRef(onRenderFinished)
  const onScoreLoadedRef = useRef(onScoreLoaded)
  const [surfaceEl, setSurfaceEl] = useState<HTMLElement | null>(null)

  onRenderStartedRef.current = onRenderStarted
  onRenderFinishedRef.current = onRenderFinished
  onScoreLoadedRef.current = onScoreLoaded

  useImperativeHandle(ref, () => ({
    getScrollContainer: () => containerRef.current,
  }), [])

  useEffect(() => {
    if (!containerRef.current) return

    const api = new AlphaTabApi(containerRef.current, {
      core: {
        scriptFile: '/alphaTab.worker.mjs',
        fontDirectory: '/font/',
      },
      display: {
        layoutMode: LayoutMode.Horizontal,
        scale,
      },
      player: {
        enablePlayer: false,
        enableCursor: false,
      },
    })

    // Clear portal BEFORE alphaTab modifies DOM on re-render (e.g. track switch).
    // renderStarted fires synchronously before the async worker render,
    // so flushSync ensures React unmounts portal children before any DOM changes.
    const unsubRenderStarted = api.renderStarted.on(() => {
      flushSync(() => {
        setSurfaceEl(null)
      })
      onRenderStartedRef.current?.()
    })

    const unsubRender = api.postRenderFinished.on(() => {
      const surface = containerRef.current?.querySelector('.at-surface') as HTMLElement | null
      setSurfaceEl(surface)
      // Compute actual content width from children's rightmost edge.
      // alphaTab sets the surface width independently of zoom scale,
      // so scrollWidth is only accurate when children overflow the surface.
      let contentWidth = 0
      if (surface) {
        for (let i = 0; i < surface.children.length; i++) {
          const child = surface.children[i] as HTMLElement
          const right = child.offsetLeft + child.offsetWidth
          if (right > contentWidth) contentWidth = right
        }
        // alphaTab sets surface width independently of zoom, so at >100%
        // children overflow the surface and the container can't scroll far enough.
        // Fix by expanding the surface to match the actual content extent.
        contentWidth += 30
        if (contentWidth > surface.offsetWidth) {
          surface.style.width = contentWidth + 'px'
        }
      }
      onRenderFinishedRef.current?.(api, contentWidth)
    })

    const unsubScore = api.scoreLoaded.on((score: Score) => {
      onScoreLoadedRef.current?.(score)
    })

    apiRef.current = api
    initialScaleRef.current = scale

    if (buffer !== null) {
      api.load(buffer)
    }

    return () => {
      apiRef.current = null
      unsubRenderStarted()
      unsubRender()
      unsubScore()
      setSurfaceEl(null)
      api.destroy()
    }
  }, [buffer])

  // Update zoom scale without recreating the API
  useEffect(() => {
    // Skip if this is the initial mount (API creation effect already set scale)
    if (scale === initialScaleRef.current) return
    const api = apiRef.current
    if (!api) return
    api.settings.display.scale = scale
    api.updateSettings()
    api.render()
    initialScaleRef.current = scale
  }, [scale])

  return (
    <div ref={containerRef} className="w-full h-full overflow-x-hidden overflow-y-auto">
      {surfaceEl && children ? createPortal(children, surfaceEl) : null}
    </div>
  )
  },
)
