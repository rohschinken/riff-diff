import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { AlphaTabApi, LayoutMode } from '@coderline/alphatab'
import type { model } from '@coderline/alphatab'

type Score = model.Score

export interface AlphaTabPaneProps {
  buffer: ArrayBuffer | null
  onRenderFinished?: (api: AlphaTabApi) => void
  onScoreLoaded?: (score: Score) => void
  children?: ReactNode
}

export function AlphaTabPane({ buffer, onRenderFinished, onScoreLoaded, children }: AlphaTabPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onRenderFinishedRef = useRef(onRenderFinished)
  const onScoreLoadedRef = useRef(onScoreLoaded)
  const [surfaceEl, setSurfaceEl] = useState<HTMLElement | null>(null)

  onRenderFinishedRef.current = onRenderFinished
  onScoreLoadedRef.current = onScoreLoaded

  useEffect(() => {
    if (!containerRef.current) return

    const api = new AlphaTabApi(containerRef.current, {
      core: {
        scriptFile: '/alphaTab.worker.mjs',
      },
      display: {
        layoutMode: LayoutMode.Horizontal,
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
    })

    const unsubRender = api.postRenderFinished.on(() => {
      const surface = containerRef.current?.querySelector('.at-surface') as HTMLElement | null
      setSurfaceEl(surface)
      onRenderFinishedRef.current?.(api)
    })

    const unsubScore = api.scoreLoaded.on((score: Score) => {
      onScoreLoadedRef.current?.(score)
    })

    if (buffer !== null) {
      api.load(buffer)
    }

    return () => {
      unsubRenderStarted()
      unsubRender()
      unsubScore()
      setSurfaceEl(null)
      api.destroy()
    }
  }, [buffer])

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto">
      {surfaceEl && children ? createPortal(children, surfaceEl) : null}
    </div>
  )
}
