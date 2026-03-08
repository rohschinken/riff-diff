import { useEffect, useRef, useState, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { AlphaTabApi, LayoutMode, SystemsLayoutMode } from '@coderline/alphatab'
import type { model } from '@coderline/alphatab'

type Score = model.Score

export interface AlphaTabPaneHandle {
  getScrollContainer: () => HTMLDivElement | null
}

export interface AlphaTabPaneProps {
  buffer: ArrayBuffer | null
  scale?: number
  uniformBarWidth?: number | null
  onRenderStarted?: () => void
  onRenderFinished?: (api: AlphaTabApi, contentWidth: number, barWidths: number[]) => void
  onScoreLoaded?: (score: Score) => void
  children?: ReactNode
}

export const AlphaTabPane = forwardRef<AlphaTabPaneHandle, AlphaTabPaneProps>(
  function AlphaTabPane({ buffer, scale = 1.0, uniformBarWidth, onRenderStarted, onRenderFinished, onScoreLoaded, children }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const initialScaleRef = useRef(scale)
  const onRenderStartedRef = useRef(onRenderStarted)
  const onRenderFinishedRef = useRef(onRenderFinished)
  const onScoreLoadedRef = useRef(onScoreLoaded)
  const [surfaceEl, setSurfaceEl] = useState<HTMLElement | null>(null)

  const uniformBarWidthRef = useRef(uniformBarWidth)

  onRenderStartedRef.current = onRenderStarted
  onRenderFinishedRef.current = onRenderFinished
  onScoreLoadedRef.current = onScoreLoaded
  uniformBarWidthRef.current = uniformBarWidth

  useImperativeHandle(ref, () => ({
    getScrollContainer: () => containerRef.current,
  }), [])

  useEffect(() => {
    if (!containerRef.current) return

    const api = new AlphaTabApi(containerRef.current, {
      core: {
        fontDirectory: `${import.meta.env.BASE_URL}font/`,
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

    // Suppress stale render errors from alphaTab's internal BoundsLookup.fromJson.
    // When phantom bars are inserted between a render start and its completion,
    // the bounds data references the old score structure, causing a crash in
    // fromJson. This is benign — the next render produces correct bounds.
    // The .bind(this) in alphaTab's constructor makes method-level patching
    // impossible, so we use a global error handler scoped to this API instance.
    const staleRenderHandler = (e: ErrorEvent) => {
      // Match the fromJson crash across browser error message formats:
      // Firefox: "can't access property "id", bounds.beat is undefined"
      // Firefox: "can't access property "id" of undefined"
      // Chrome:  "Cannot read properties of undefined (reading 'id')"
      if (
        e.filename?.includes('alphaTab') &&
        (e.message?.includes("'id'") || e.message?.includes('"id"'))
      ) {
        e.preventDefault()
      }
    }
    window.addEventListener('error', staleRenderHandler)

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
      // Extract per-bar widths from boundsLookup, normalized to unscaled units.
      // realBounds.w includes the zoom scale, but displayWidth is in logical units.
      const currentScale = api.settings.display.scale
      const barWidths: number[] = []
      const lookup = api.boundsLookup
      if (lookup) {
        for (const system of lookup.staffSystems) {
          for (const mb of system.bars) {
            barWidths[mb.index] = mb.realBounds.w / currentScale
          }
        }
      }
      // If uniform bar width is set and bars don't match, apply and re-render
      const targetWidth = uniformBarWidthRef.current
      if (targetWidth && api.score) {
        let needsRerender = false
        for (const track of api.tracks) {
          for (const staff of track.staves) {
            for (const bar of staff.bars) {
              if (bar.displayWidth !== targetWidth) {
                bar.displayWidth = targetWidth
                needsRerender = true
              }
            }
          }
        }
        if (needsRerender) {
          api.settings.display.systemsLayoutMode = SystemsLayoutMode.UseModelLayout
          api.updateSettings()
          api.render()
          return  // skip callback; the re-render will call it with correct widths
        }
      }
      onRenderFinishedRef.current?.(api, contentWidth, barWidths)
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
      window.removeEventListener('error', staleRenderHandler)
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

  // Re-render when uniform bar width changes
  const prevUniformBarWidthRef = useRef(uniformBarWidth)
  useEffect(() => {
    if (uniformBarWidth === prevUniformBarWidthRef.current) return
    prevUniformBarWidthRef.current = uniformBarWidth
    const api = apiRef.current
    if (!api?.score) return
    // The postRenderFinished handler will apply the new width
    api.render()
  }, [uniformBarWidth])

  return (
    <div ref={containerRef} className="w-full h-full overflow-x-hidden overflow-y-auto">
      {surfaceEl && children ? createPortal(children, surfaceEl) : null}
    </div>
  )
  },
)
