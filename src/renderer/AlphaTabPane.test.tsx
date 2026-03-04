import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, screen } from '@testing-library/react'
import { AlphaTabPane } from './AlphaTabPane'

let mockLoad: ReturnType<typeof vi.fn>
let mockDestroy: ReturnType<typeof vi.fn>
let mockPostRenderOn: ReturnType<typeof vi.fn>
let mockUnsubscribe: ReturnType<typeof vi.fn>
let mockScoreLoadedOn: ReturnType<typeof vi.fn>
let mockScoreLoadedUnsubscribe: ReturnType<typeof vi.fn>
let mockRenderStartedOn: ReturnType<typeof vi.fn>
let mockRenderStartedUnsubscribe: ReturnType<typeof vi.fn>
let capturedOptions: Record<string, unknown> | null
let capturedPostRenderHandler: (() => void) | null
let capturedScoreLoadedHandler: ((score: unknown) => void) | null
let capturedRenderStartedHandler: ((isResize: boolean) => void) | null

vi.mock('@coderline/alphatab', () => {
  const LayoutMode = { Page: 0, Horizontal: 1, Parchment: 2 }
  const StaveProfile = { Default: 0, ScoreTab: 1, Score: 2, Tab: 3, TabMixed: 4 }

  class AlphaTabApi {
    load: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
    renderStarted: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }
    postRenderFinished: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }
    scoreLoaded: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }

    constructor(element: HTMLElement, options: unknown) {
      capturedOptions = options as Record<string, unknown>
      // Simulate alphaTab creating .at-surface inside the container
      const surface = document.createElement('div')
      surface.className = 'at-surface'
      element.appendChild(surface)
      this.load = mockLoad
      this.destroy = mockDestroy
      this.renderStarted = { on: mockRenderStartedOn, off: vi.fn() }
      this.postRenderFinished = { on: mockPostRenderOn, off: vi.fn() }
      this.scoreLoaded = { on: mockScoreLoadedOn, off: vi.fn() }
    }
  }

  return { AlphaTabApi, LayoutMode, StaveProfile }
})

describe('AlphaTabPane', () => {
  beforeEach(() => {
    capturedOptions = null
    capturedPostRenderHandler = null
    capturedScoreLoadedHandler = null
    capturedRenderStartedHandler = null
    mockLoad = vi.fn()
    mockDestroy = vi.fn()
    mockUnsubscribe = vi.fn()
    mockScoreLoadedUnsubscribe = vi.fn()
    mockRenderStartedUnsubscribe = vi.fn()
    mockRenderStartedOn = vi.fn((handler: (isResize: boolean) => void) => {
      capturedRenderStartedHandler = handler
      return mockRenderStartedUnsubscribe
    })
    mockPostRenderOn = vi.fn((handler: () => void) => {
      capturedPostRenderHandler = handler
      return mockUnsubscribe
    })
    mockScoreLoadedOn = vi.fn((handler: (score: unknown) => void) => {
      capturedScoreLoadedHandler = handler
      return mockScoreLoadedUnsubscribe
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

  it('sets layoutMode to Horizontal', () => {
    render(<AlphaTabPane buffer={null} />)

    const display = capturedOptions!.display as Record<string, unknown>
    expect(display.layoutMode).toBe(1) // LayoutMode.Horizontal
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

  it('fires onScoreLoaded when scoreLoaded emits', () => {
    const onScoreLoaded = vi.fn()
    const fakeScore = { tracks: [{ name: 'Guitar' }] }
    render(<AlphaTabPane buffer={new ArrayBuffer(8)} onScoreLoaded={onScoreLoaded} />)

    expect(onScoreLoaded).not.toHaveBeenCalled()

    act(() => {
      capturedScoreLoadedHandler?.(fakeScore)
    })

    expect(onScoreLoaded).toHaveBeenCalledOnce()
    expect(onScoreLoaded).toHaveBeenCalledWith(fakeScore)
  })

  it('unsubscribes from scoreLoaded on unmount', () => {
    const { unmount } = render(<AlphaTabPane buffer={null} />)

    expect(mockScoreLoadedUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(mockScoreLoadedUnsubscribe).toHaveBeenCalledOnce()
  })

  it('unsubscribes from renderStarted on unmount', () => {
    const { unmount } = render(<AlphaTabPane buffer={null} />)

    expect(mockRenderStartedUnsubscribe).not.toHaveBeenCalled()
    unmount()
    expect(mockRenderStartedUnsubscribe).toHaveBeenCalledOnce()
  })

  it('portals children into .at-surface after postRenderFinished', () => {
    render(
      <AlphaTabPane buffer={null}>
        <span data-testid="child">hello</span>
      </AlphaTabPane>,
    )

    // Children not rendered before postRenderFinished (no portal target yet)
    expect(screen.queryByTestId('child')).toBeNull()

    // Simulate alphaTab completing a render
    act(() => {
      capturedPostRenderHandler?.()
    })

    // Now children are portaled into .at-surface
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByTestId('child').textContent).toBe('hello')
    expect(screen.getByTestId('child').closest('.at-surface')).not.toBeNull()
  })

  it('clears portal when renderStarted fires', () => {
    render(
      <AlphaTabPane buffer={null}>
        <span data-testid="child">hello</span>
      </AlphaTabPane>,
    )

    // Establish portal
    act(() => {
      capturedPostRenderHandler?.()
    })
    expect(screen.getByTestId('child')).toBeInTheDocument()

    // renderStarted fires (e.g. track switch about to re-render)
    act(() => {
      capturedRenderStartedHandler?.(false)
    })

    // Portal cleared — children removed from DOM
    expect(screen.queryByTestId('child')).toBeNull()
  })
})
