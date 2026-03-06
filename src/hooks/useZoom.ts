import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'riff-diff-zoom'
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
const DEFAULT_ZOOM = 1.0

function readStored(): number {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return DEFAULT_ZOOM
  const parsed = parseFloat(stored)
  if (isNaN(parsed) || !ZOOM_STEPS.includes(parsed)) return DEFAULT_ZOOM
  return parsed
}

export function useZoom() {
  const [zoomLevel, setZoomLevel] = useState<number>(readStored)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(zoomLevel))
  }, [zoomLevel])

  const stepIndex = ZOOM_STEPS.indexOf(zoomLevel)

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => {
      const idx = ZOOM_STEPS.indexOf(prev)
      return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : prev
    })
  }, [])

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const idx = ZOOM_STEPS.indexOf(prev)
      return idx > 0 ? ZOOM_STEPS[idx - 1] : prev
    })
  }, [])

  const resetZoom = useCallback(() => {
    setZoomLevel(DEFAULT_ZOOM)
  }, [])

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    canZoomIn: stepIndex < ZOOM_STEPS.length - 1,
    canZoomOut: stepIndex > 0,
  }
}
