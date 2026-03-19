import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MetadataOverlay } from './MetadataOverlay'

// Minimal Score-like mocks
function makeStaff(overrides: Partial<{ tuning: number[]; isPercussion: boolean; capo: number }> = {}) {
  return {
    tuning: overrides.tuning ?? [64, 59, 55, 50, 45, 40],
    isPercussion: overrides.isPercussion ?? false,
    capo: overrides.capo ?? 0,
  }
}

function makeTrack(overrides: Partial<{ index: number; name: string; playbackInfo: { program: number }; staves: ReturnType<typeof makeStaff>[] }> = {}) {
  return {
    index: overrides.index ?? 0,
    name: overrides.name ?? 'Track 1',
    playbackInfo: overrides.playbackInfo ?? { program: 25 },
    staves: overrides.staves ?? [makeStaff()],
  }
}

function makeScore(overrides: Partial<{
  title: string; subTitle: string; artist: string; album: string
  music: string; words: string; tab: string; copyright: string
  instructions: string; notices: string; tracks: ReturnType<typeof makeTrack>[]
}> = {}) {
  return {
    title: overrides.title ?? 'Test Song',
    subTitle: overrides.subTitle ?? '',
    artist: overrides.artist ?? 'Test Artist',
    album: overrides.album ?? '',
    music: overrides.music ?? '',
    words: overrides.words ?? '',
    tab: overrides.tab ?? '',
    copyright: overrides.copyright ?? '',
    instructions: overrides.instructions ?? '',
    notices: overrides.notices ?? '',
    tracks: overrides.tracks ?? [makeTrack()],
  }
}

describe('MetadataOverlay', () => {
  it('renders nothing when both scores are null', () => {
    const { container } = render(<MetadataOverlay scoreA={null} scoreB={null} onClose={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders overlay when at least one score is provided', () => {
    render(<MetadataOverlay scoreA={makeScore() as any} scoreB={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('metadata-overlay')).toBeDefined()
  })

  it('close button calls onClose', () => {
    const onClose = vi.fn()
    render(<MetadataOverlay scoreA={makeScore() as any} scoreB={makeScore() as any} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('metadata-close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    render(<MetadataOverlay scoreA={makeScore() as any} scoreB={makeScore() as any} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('metadata-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('displays score field labels', () => {
    render(<MetadataOverlay scoreA={makeScore() as any} scoreB={makeScore() as any} onClose={vi.fn()} />)
    expect(screen.getByText('Title')).toBeDefined()
    expect(screen.getByText('Artist')).toBeDefined()
  })

  it('highlights differing fields', () => {
    const a = makeScore({ title: 'Song A' })
    const b = makeScore({ title: 'Song B' })
    render(<MetadataOverlay scoreA={a as any} scoreB={b as any} onClose={vi.fn()} />)
    const row = screen.getByTestId('field-Title')
    expect(row.className).toContain('diff-highlight')
  })

  it('does not highlight matching fields', () => {
    const a = makeScore({ title: 'Same' })
    const b = makeScore({ title: 'Same' })
    render(<MetadataOverlay scoreA={a as any} scoreB={b as any} onClose={vi.fn()} />)
    const row = screen.getByTestId('field-Title')
    expect(row.className).not.toContain('diff-highlight')
  })

  it('renders track sections with names', () => {
    const a = makeScore({ tracks: [makeTrack({ name: 'Guitar' })] })
    const b = makeScore({ tracks: [makeTrack({ name: 'Lead Guitar' })] })
    render(<MetadataOverlay scoreA={a as any} scoreB={b as any} onClose={vi.fn()} />)
    expect(screen.getByText(/Guitar \/ Lead Guitar/)).toBeDefined()
  })

  it('shows dash for missing side when only one score loaded', () => {
    const a = makeScore({ title: 'My Song' })
    render(<MetadataOverlay scoreA={a as any} scoreB={null} onClose={vi.fn()} />)
    // File B column should show '—' for title
    const row = screen.getByTestId('field-Title')
    expect(row.textContent).toContain('—')
  })
})
