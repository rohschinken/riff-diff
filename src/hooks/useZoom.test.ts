import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useZoom } from './useZoom'

describe('useZoom', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to zoom level 1.0', () => {
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(1.0)
  })

  it('zoomIn increases to next step (1.25)', () => {
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomIn())
    expect(result.current.zoomLevel).toBe(1.25)
  })

  it('zoomOut decreases to previous step (0.75)', () => {
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomOut())
    expect(result.current.zoomLevel).toBe(0.75)
  })

  it('resetZoom returns to 1.0', () => {
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomIn())
    act(() => result.current.zoomIn())
    expect(result.current.zoomLevel).toBe(1.5)
    act(() => result.current.resetZoom())
    expect(result.current.zoomLevel).toBe(1.0)
  })

  it('canZoomIn is false at max zoom (2.0)', () => {
    const { result } = renderHook(() => useZoom())
    // Go to max: 1.0 -> 1.25 -> 1.5 -> 2.0
    act(() => result.current.zoomIn())
    act(() => result.current.zoomIn())
    act(() => result.current.zoomIn())
    expect(result.current.zoomLevel).toBe(2.0)
    expect(result.current.canZoomIn).toBe(false)
  })

  it('canZoomOut is false at min zoom (0.25)', () => {
    const { result } = renderHook(() => useZoom())
    // Go to min: 1.0 -> 0.75 -> 0.5 -> 0.25
    act(() => result.current.zoomOut())
    act(() => result.current.zoomOut())
    act(() => result.current.zoomOut())
    expect(result.current.zoomLevel).toBe(0.25)
    expect(result.current.canZoomOut).toBe(false)
  })

  it('persists zoom level to localStorage', () => {
    const { result } = renderHook(() => useZoom())
    act(() => result.current.zoomIn())
    expect(localStorage.getItem('riff-diff-zoom')).toBe('1.25')
  })

  it('reads initial value from localStorage', () => {
    localStorage.setItem('riff-diff-zoom', '0.5')
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(0.5)
  })

  it('defaults to 1.0 for invalid localStorage value', () => {
    localStorage.setItem('riff-diff-zoom', 'banana')
    const { result } = renderHook(() => useZoom())
    expect(result.current.zoomLevel).toBe(1.0)
  })
})
