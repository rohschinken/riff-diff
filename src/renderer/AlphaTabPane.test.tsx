import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { AlphaTabPane } from './AlphaTabPane'

let mockLoad: ReturnType<typeof vi.fn>
let mockDestroy: ReturnType<typeof vi.fn>
let mockPostRenderOn: ReturnType<typeof vi.fn>
let mockUnsubscribe: ReturnType<typeof vi.fn>
let capturedOptions: Record<string, unknown> | null
let capturedPostRenderHandler: (() => void) | null

vi.mock('@coderline/alphatab', () => {
  const LayoutMode = { Page: 0, Horizontal: 1, Parchment: 2 }
  const StaveProfile = { Default: 0, ScoreTab: 1, Score: 2, Tab: 3, TabMixed: 4 }

  class AlphaTabApi {
    load: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    postRenderFinished: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }
    scoreLoaded: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }

    constructor(_element: HTMLElement, options: unknown) {
      capturedOptions = options as Record<string, unknown>
      this.load = mockLoad
      this.destroy = mockDestroy
      this.postRenderFinished = { on: mockPostRenderOn, off: vi.fn() }
      this.scoreLoaded = { on: vi.fn(() => vi.fn()), off: vi.fn() }
    }
  }

  return { AlphaTabApi, LayoutMode, StaveProfile }
})

describe('AlphaTabPane', () => {
  beforeEach(() => {
    capturedOptions = null
    capturedPostRenderHandler = null
    mockLoad = vi.fn()
    mockDestroy = vi.fn()
    mockUnsubscribe = vi.fn()
    mockPostRenderOn = vi.fn((handler: () => void) => {
      capturedPostRenderHandler = handler
      return mockUnsubscribe
    })
  })

  it('calls api.load() with the provided ArrayBuffer', () => {
    const buffer = new ArrayBuffer(16)
    render(<AlphaTabPane buffer={buffer} />)

    expect(mockLoad).toHaveBeenCalledOnce()
    expect(mockLoad).toHaveBeenCalledWith(buffer)
  })

  it('sets scriptFile to /alphaTab.worker.mjs', () => {
    render(<AlphaTabPane buffer={null} />)

    expect(capturedOptions).not.toBeNull()
    const core = capturedOptions!.core as Record<string, unknown>
    expect(core.scriptFile).toBe('/alphaTab.worker.mjs')
  })

  it('sets layoutMode to Horizontal and staveProfile to Tab', () => {
    render(<AlphaTabPane buffer={null} />)

    const display = capturedOptions!.display as Record<string, unknown>
    expect(display.layoutMode).toBe(1) // LayoutMode.Horizontal
    expect(display.staveProfile).toBe(3) // StaveProfile.Tab
  })

  it('disables player', () => {
    render(<AlphaTabPane buffer={null} />)

    const player = capturedOptions!.player as Record<string, unknown>
    expect(player.enablePlayer).toBe(false)
    expect(player.enableCursor).toBe(false)
  })

  it('fires onRenderFinished when postRenderFinished emits', () => {
    const onRenderFinished = vi.fn()
    render(<AlphaTabPane buffer={new ArrayBuffer(8)} onRenderFinished={onRenderFinished} />)

    expect(onRenderFinished).not.toHaveBeenCalled()

    act(() => {
      capturedPostRenderHandler?.()
    })

    expect(onRenderFinished).toHaveBeenCalledOnce()
  })

  it('calls api.destroy() on unmount', () => {
    const { unmount } = render(<AlphaTabPane buffer={null} />)

    expect(mockDestroy).not.toHaveBeenCalled()
    unmount()
    expect(mockDestroy).toHaveBeenCalledOnce()
  })

  it('does not call api.load() when buffer is null', () => {
    render(<AlphaTabPane buffer={null} />)

    expect(mockLoad).not.toHaveBeenCalled()
  })

  it('re-calls api.load() when buffer prop changes', () => {
    const bufferA = new ArrayBuffer(8)
    const bufferB = new ArrayBuffer(16)

    const { rerender } = render(<AlphaTabPane buffer={bufferA} />)

    expect(mockLoad).toHaveBeenCalledOnce()
    expect(mockLoad).toHaveBeenCalledWith(bufferA)

    // Reset to track the new instance's load call
    mockLoad.mockClear()
    mockDestroy.mockClear()

    rerender(<AlphaTabPane buffer={bufferB} />)

    // Old api destroyed, new api created and loaded
    expect(mockDestroy).toHaveBeenCalledOnce()
    expect(mockLoad).toHaveBeenCalledOnce()
    expect(mockLoad).toHaveBeenCalledWith(bufferB)
  })

  it('unsubscribes from postRenderFinished on unmount', () => {
    const { unmount } = render(<AlphaTabPane buffer={null} />)

    expect(mockUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })
})
