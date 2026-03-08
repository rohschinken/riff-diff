import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiffFilterBar } from './DiffFilterBar'
import { DEFAULT_DIFF_FILTERS } from '../diff/types'
import type { DiffResult, DiffFilters } from '../diff/types'

// --- Helpers ---

function makeSummary(
  overrides?: Partial<DiffResult['summary']>,
): DiffResult['summary'] {
  return {
    equal: 10,
    added: 3,
    removed: 2,
    changed: 5,
    addedBars: 2,
    removedBars: 1,
    tempoChanges: 1,
    timeSigChanges: 1,
    totalMeasures: 20,
    ...overrides,
  }
}

function renderBar(overrides?: {
  filters?: DiffFilters
  onFiltersChange?: (filters: DiffFilters) => void
  summary?: DiffResult['summary'] | null
}) {
  const props = {
    filters: overrides?.filters ?? DEFAULT_DIFF_FILTERS,
    onFiltersChange: overrides?.onFiltersChange ?? vi.fn(),
    summary: overrides?.summary !== undefined ? overrides.summary : makeSummary(),
  }
  return { ...render(<DiffFilterBar {...props} />), props }
}

describe('DiffFilterBar rendering', () => {
  it('renders all three filter buttons', () => {
    renderBar()
    expect(screen.getByTestId('filter-changed')).toBeDefined()
    expect(screen.getByTestId('filter-added-removed')).toBeDefined()
    expect(screen.getByTestId('filter-temposig')).toBeDefined()
  })

  it('displays correct count for Changed', () => {
    renderBar({ summary: makeSummary({ changed: 9 }) })
    expect(screen.getByTestId('filter-changed').textContent).toBe('Changed Rhytmic Events 9')
  })

  it('displays combined count for Added/Removed', () => {
    renderBar({ summary: makeSummary({ addedBars: 7, removedBars: 4 }) })
    expect(screen.getByTestId('filter-added-removed').textContent).toBe('Added/Removed Bars 11')
  })

  it('displays combined count for Tempo/Sig', () => {
    renderBar({ summary: makeSummary({ tempoChanges: 3, timeSigChanges: 2 }) })
    expect(screen.getByTestId('filter-temposig').textContent).toBe('Tempo/Time Changes 5')
  })

  it('renders the container with data-testid', () => {
    renderBar()
    expect(screen.getByTestId('diff-filter-bar')).toBeDefined()
  })
})

describe('DiffFilterBar toggle behavior', () => {
  it('clicking Changed calls onFiltersChange with showChanged: false', () => {
    const onFiltersChange = vi.fn()
    renderBar({ onFiltersChange })
    fireEvent.click(screen.getByTestId('filter-changed'))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_FILTERS,
      showChanged: false,
    })
  })

  it('clicking Added/Removed calls onFiltersChange with showAddedRemoved: false', () => {
    const onFiltersChange = vi.fn()
    renderBar({ onFiltersChange })
    fireEvent.click(screen.getByTestId('filter-added-removed'))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_FILTERS,
      showAddedRemoved: false,
    })
  })

  it('clicking inactive filter re-enables it', () => {
    const onFiltersChange = vi.fn()
    renderBar({
      filters: { ...DEFAULT_DIFF_FILTERS, showAddedRemoved: false },
      onFiltersChange,
    })
    fireEvent.click(screen.getByTestId('filter-added-removed'))
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_FILTERS,
      showAddedRemoved: true,
    })
  })
})

describe('DiffFilterBar visual states', () => {
  it('active buttons have colored class, inactive have grey', () => {
    renderBar({
      filters: { ...DEFAULT_DIFF_FILTERS, showAddedRemoved: false },
    })
    const addedRemoved = screen.getByTestId('filter-added-removed')
    const changed = screen.getByTestId('filter-changed')
    expect(addedRemoved.className).toContain('bg-chrome-bg-subtle')
    expect(changed.className).toContain('bg-diff-changed')
  })

  it('counts update when summary changes', () => {
    const onFiltersChange = vi.fn() as unknown as (filters: DiffFilters) => void
    const { rerender } = renderBar({ summary: makeSummary({ changed: 3 }), onFiltersChange })
    expect(screen.getByTestId('filter-changed').textContent).toBe('Changed Rhytmic Events 3')

    rerender(
      <DiffFilterBar
        filters={DEFAULT_DIFF_FILTERS}
        onFiltersChange={onFiltersChange}
        summary={makeSummary({ changed: 10 })}
      />,
    )
    expect(screen.getByTestId('filter-changed').textContent).toBe('Changed Rhytmic Events 10')
  })
})

describe('DiffFilterBar disabled state', () => {
  it('shows count 0 and disabled pills when summary is null', () => {
    renderBar({ summary: null })
    const changed = screen.getByTestId('filter-changed')
    expect(changed.textContent).toBe('Changed Rhytmic Events 0')
    expect(changed.className).toContain('opacity-50')
  })

  it('disabled pills do not fire onFiltersChange on click', () => {
    const onFiltersChange = vi.fn()
    renderBar({ summary: null, onFiltersChange })
    fireEvent.click(screen.getByTestId('filter-changed'))
    expect(onFiltersChange).not.toHaveBeenCalled()
  })
})
