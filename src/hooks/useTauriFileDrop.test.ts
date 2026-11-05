import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTauriFileDrop, sideAtPoint, usesPhysicalDropPosition } from './useTauriFileDrop'

type NativeHandler = (event: { payload: any }) => void
type LoadPath = (filePath: string) => Promise<void>

function dropZone(side: 'A' | 'B'): HTMLElement {
  const element = document.createElement('div')
  element.setAttribute('data-drop-side', side)
  document.body.appendChild(element)
  return element
}

describe('useTauriFileDrop', () => {
  let handler: NativeHandler | null
  let onDragDropEvent: ReturnType<typeof vi.fn>
  let getCurrentWebviewWindow: ReturnType<typeof vi.fn>
  let unlisten: ReturnType<typeof vi.fn>
  let onDropA: Mock<LoadPath>
  let onDropB: Mock<LoadPath>

  beforeEach(() => {
    (window as any).__TAURI_INTERNALS__ = {}
    handler = null
    unlisten = vi.fn()
    onDragDropEvent = vi.fn(async (h: NativeHandler) => {
      handler = h
      return unlisten
    })
    getCurrentWebviewWindow = vi.fn(() => ({ onDragDropEvent }))
    vi.doMock('@tauri-apps/api/webviewWindow', () => ({ getCurrentWebviewWindow }))
    onDropA = vi.fn<LoadPath>().mockResolvedValue(undefined)
    onDropB = vi.fn<LoadPath>().mockResolvedValue(undefined)
  })

  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.doUnmock('@tauri-apps/api/webviewWindow')
    document.body.innerHTML = ''
  })

  async function mount() {
    const hook = renderHook(() => useTauriFileDrop({ onDropA, onDropB }))
    await waitFor(() => expect(onDragDropEvent).toHaveBeenCalled())
    return hook
  }

  function pointAt(element: Element | null) {
    return vi.spyOn(document, 'elementFromPoint').mockReturnValue(element)
  }

  // Mimics the A/B split: the top half is pane A, the bottom half is pane B.
  function mockPaneSplit(zoneA: HTMLElement, zoneB: HTMLElement) {
    return vi.spyOn(document, 'elementFromPoint').mockImplementation((_x, y) =>
      y >= 500 ? zoneB : zoneA
    )
  }

  it('does not register a native listener outside Tauri', async () => {
    delete (window as any).__TAURI_INTERNALS__

    const { result } = renderHook(() => useTauriFileDrop({ onDropA, onDropB }))
    await act(async () => { await Promise.resolve() })

    expect(getCurrentWebviewWindow).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('tracks the pane under the pointer on enter and over', async () => {
    const { result } = await mount()
    const zoneA = dropZone('A')
    const zoneB = dropZone('B')

    pointAt(zoneA)
    act(() => handler!({ payload: { type: 'enter', paths: ['/song.gp'], position: { x: 10, y: 10 } } }))
    expect(result.current).toBe('A')

    pointAt(zoneB)
    act(() => handler!({ payload: { type: 'over', position: { x: 10, y: 10 } } }))
    expect(result.current).toBe('B')
  })

  it('clears the drag state on leave', async () => {
    const { result } = await mount()
    const zoneA = dropZone('A')

    pointAt(zoneA)
    act(() => handler!({ payload: { type: 'enter', paths: ['/song.gp'], position: { x: 10, y: 10 } } }))
    expect(result.current).toBe('A')

    act(() => handler!({ payload: { type: 'leave' } }))
    expect(result.current).toBeNull()
  })

  it('loads the dropped path into pane A', async () => {
    const { result } = await mount()
    const zoneA = dropZone('A')

    pointAt(zoneA)
    act(() => handler!({ payload: { type: 'drop', paths: ['/home/me/song.gp'], position: { x: 10, y: 10 } } }))

    expect(onDropA).toHaveBeenCalledWith('/home/me/song.gp')
    expect(onDropB).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('loads the dropped path into pane B', async () => {
    await mount()
    const zoneB = dropZone('B')

    pointAt(zoneB)
    act(() => handler!({ payload: { type: 'drop', paths: ['/home/me/song.gp8'], position: { x: 10, y: 10 } } }))

    expect(onDropB).toHaveBeenCalledWith('/home/me/song.gp8')
    expect(onDropA).not.toHaveBeenCalled()
  })

  it('routes a Linux logical-coordinate drop to pane B', async () => {
    await mount()
    const zoneA = dropZone('A')
    const zoneB = dropZone('B')
    mockPaneSplit(zoneA, zoneB)
    // GTK reports logical pixels even on HiDPI displays; dividing by the
    // device pixel ratio would incorrectly collapse pane B into pane A.
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' })
    vi.stubGlobal('devicePixelRatio', 2)

    act(() => handler!({
      payload: { type: 'drop', paths: ['/home/me/bottom.gp'], position: { x: 100, y: 700 } },
    }))

    expect(onDropB).toHaveBeenCalledWith('/home/me/bottom.gp')
    expect(onDropA).not.toHaveBeenCalled()
  })

  it('routes a macOS logical-coordinate drop to pane B', async () => {
    await mount()
    const zoneA = dropZone('A')
    const zoneB = dropZone('B')
    mockPaneSplit(zoneA, zoneB)
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15',
    })
    vi.stubGlobal('devicePixelRatio', 2)

    act(() => handler!({
      payload: { type: 'drop', paths: ['/Users/me/bottom.gp'], position: { x: 100, y: 700 } },
    }))

    expect(onDropB).toHaveBeenCalledWith('/Users/me/bottom.gp')
    expect(onDropA).not.toHaveBeenCalled()
  })

  it('converts Windows physical-coordinate drops before hit-testing', async () => {
    await mount()
    const zoneA = dropZone('A')
    const zoneB = dropZone('B')
    mockPaneSplit(zoneA, zoneB)
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    })
    vi.stubGlobal('devicePixelRatio', 2)

    act(() => handler!({
      payload: { type: 'drop', paths: ['C:\\Music\\bottom.gp'], position: { x: 200, y: 1400 } },
    }))

    expect(onDropB).toHaveBeenCalledWith('C:\\Music\\bottom.gp')
    expect(onDropA).not.toHaveBeenCalled()
  })

  it('uses the last hovered pane when the drop position misses a zone', async () => {
    await mount()
    const zoneA = dropZone('A')

    pointAt(zoneA)
    act(() => handler!({ payload: { type: 'enter', paths: ['/song.gp'], position: { x: 10, y: 10 } } }))
    pointAt(null)
    act(() => handler!({ payload: { type: 'drop', paths: ['/song.gp'], position: { x: 10, y: 10 } } }))

    expect(onDropA).toHaveBeenCalledWith('/song.gp')
  })

  it('ignores drops outside both panes', async () => {
    const { result } = await mount()

    pointAt(null)
    act(() => handler!({ payload: { type: 'enter', paths: ['/song.gp'], position: { x: 10, y: 10 } } }))
    expect(result.current).toBeNull()

    act(() => handler!({ payload: { type: 'drop', paths: ['/song.gp'], position: { x: 10, y: 10 } } }))
    expect(onDropA).not.toHaveBeenCalled()
    expect(onDropB).not.toHaveBeenCalled()
  })

  it('uses the first path when several files are dropped', async () => {
    await mount()
    const zoneB = dropZone('B')

    pointAt(zoneB)
    act(() => handler!({
      payload: { type: 'drop', paths: ['/first.gp', '/second.gp'], position: { x: 10, y: 10 } },
    }))

    expect(onDropB).toHaveBeenCalledTimes(1)
    expect(onDropB).toHaveBeenCalledWith('/first.gp')
  })

  it('removes the native listener on unmount', async () => {
    const { unmount } = await mount()
    unmount()
    expect(unlisten).toHaveBeenCalled()
  })
})

describe('sideAtPoint', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('does not scale logical coordinates from GTK or WKWebView', () => {
    const zoneB = dropZone('B')
    const elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockReturnValue(zoneB)

    expect(sideAtPoint(200, 700, 2, false)).toBe('B')
    expect(elementFromPoint).toHaveBeenCalledWith(200, 700)
  })

  it('converts physical coordinates from WebView2 to CSS pixels before hit-testing', () => {
    const zoneA = dropZone('A')
    const elementFromPoint = vi.spyOn(document, 'elementFromPoint').mockReturnValue(zoneA)

    expect(sideAtPoint(200, 100, 2, true)).toBe('A')
    expect(elementFromPoint).toHaveBeenCalledWith(100, 50)
  })

  it('falls back to drop-zone bounds when elementFromPoint misses', () => {
    const zoneB = dropZone('B')
    vi.spyOn(zoneB, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 100, bottom: 100,
      x: 0, y: 0, width: 100, height: 100,
      toJSON: () => ({}),
    })
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(null)

    expect(sideAtPoint(50, 50, 1, false)).toBe('B')
    expect(sideAtPoint(150, 150, 1, false)).toBeNull()
  })
})

describe('usesPhysicalDropPosition', () => {
  it('is only true for Windows/WebView2', () => {
    expect(usesPhysicalDropPosition('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(true)
    expect(usesPhysicalDropPosition('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false)
    expect(usesPhysicalDropPosition('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')).toBe(false)
  })
})
