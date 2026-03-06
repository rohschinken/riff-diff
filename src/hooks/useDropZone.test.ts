import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDropZone } from './useDropZone'

function createDragEvent(files: File[] = []): {
  preventDefault: ReturnType<typeof vi.fn>
  stopPropagation: ReturnType<typeof vi.fn>
  dataTransfer: { files: File[] }
} {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { files },
  }
}

describe('useDropZone', () => {
  let loadFromFile: (file: File) => Promise<void>

  beforeEach(() => {
    loadFromFile = vi.fn().mockResolvedValue(undefined)
  })

  it('isDragOver starts false', () => {
    const { result } = renderHook(() => useDropZone(loadFromFile))
    expect(result.current.isDragOver).toBe(false)
  })

  it('onDragEnter sets isDragOver to true', () => {
    const { result } = renderHook(() => useDropZone(loadFromFile))
    act(() => result.current.dropHandlers.onDragEnter(createDragEvent() as any))
    expect(result.current.isDragOver).toBe(true)
  })

  it('onDragLeave sets isDragOver to false', () => {
    const { result } = renderHook(() => useDropZone(loadFromFile))
    act(() => result.current.dropHandlers.onDragEnter(createDragEvent() as any))
    act(() => result.current.dropHandlers.onDragLeave(createDragEvent() as any))
    expect(result.current.isDragOver).toBe(false)
  })

  it('onDrop calls loadFromFile with the dropped file', () => {
    const file = new File(['content'], 'song.gp', { type: 'application/octet-stream' })
    const { result } = renderHook(() => useDropZone(loadFromFile))
    act(() => result.current.dropHandlers.onDrop(createDragEvent([file]) as any))
    expect(loadFromFile).toHaveBeenCalledWith(file)
  })

  it('onDrop resets isDragOver to false', () => {
    const file = new File(['content'], 'song.gp', { type: 'application/octet-stream' })
    const { result } = renderHook(() => useDropZone(loadFromFile))
    act(() => result.current.dropHandlers.onDragEnter(createDragEvent() as any))
    expect(result.current.isDragOver).toBe(true)
    act(() => result.current.dropHandlers.onDrop(createDragEvent([file]) as any))
    expect(result.current.isDragOver).toBe(false)
  })

  it('onDragOver calls preventDefault', () => {
    const { result } = renderHook(() => useDropZone(loadFromFile))
    const event = createDragEvent()
    act(() => result.current.dropHandlers.onDragOver(event as any))
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('onDrop calls preventDefault', () => {
    const file = new File(['content'], 'song.gp', { type: 'application/octet-stream' })
    const { result } = renderHook(() => useDropZone(loadFromFile))
    const event = createDragEvent([file])
    act(() => result.current.dropHandlers.onDrop(event as any))
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('nested enter/leave: enter twice, leave once keeps isDragOver true', () => {
    const { result } = renderHook(() => useDropZone(loadFromFile))
    act(() => result.current.dropHandlers.onDragEnter(createDragEvent() as any))
    act(() => result.current.dropHandlers.onDragEnter(createDragEvent() as any))
    act(() => result.current.dropHandlers.onDragLeave(createDragEvent() as any))
    expect(result.current.isDragOver).toBe(true)
    act(() => result.current.dropHandlers.onDragLeave(createDragEvent() as any))
    expect(result.current.isDragOver).toBe(false)
  })

  it('empty dataTransfer.files does not call loadFromFile', () => {
    const { result } = renderHook(() => useDropZone(loadFromFile))
    act(() => result.current.dropHandlers.onDrop(createDragEvent([]) as any))
    expect(loadFromFile).not.toHaveBeenCalled()
  })
})
