import { useEffect, useRef } from 'react'
import { AlphaTabApi, LayoutMode, StaveProfile } from '@coderline/alphatab'

export interface AlphaTabPaneProps {
  buffer: ArrayBuffer | null
  onRenderFinished?: (api: AlphaTabApi) => void
}

export function AlphaTabPane({ buffer, onRenderFinished }: AlphaTabPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const api = new AlphaTabApi(containerRef.current, {
      core: {
        scriptFile: '/alphaTab.worker.mjs',
      },
      display: {
        layoutMode: LayoutMode.Horizontal,
        staveProfile: StaveProfile.Tab,
      },
      player: {
        enablePlayer: false,
        enableCursor: false,
      },
    })

    const unsubscribe = api.postRenderFinished.on(() => {
      onRenderFinished?.(api)
    })

    if (buffer !== null) {
      api.load(buffer)
    }

    return () => {
      unsubscribe()
      api.destroy()
    }
  }, [buffer, onRenderFinished])

  return (
    <div ref={containerRef} className="w-full h-full overflow-auto" />
  )
}
