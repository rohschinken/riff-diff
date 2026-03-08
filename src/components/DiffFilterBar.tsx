import type { CSSProperties } from 'react'
import type { DiffFilters, DiffResult } from '../diff/types'

export interface DiffFilterBarProps {
  filters: DiffFilters
  onFiltersChange: (filters: DiffFilters) => void
  summary: DiffResult['summary'] | null
}

interface PillConfig {
  key: keyof DiffFilters
  label: string
  activeClass: string
  activeStyle?: CSSProperties
  testId: string
  getCount: (summary: DiffResult['summary']) => number
}

const PILLS: PillConfig[] = [
  {
    key: 'showChanged',
    label: 'Changed Rhytmic Events',
    activeClass: 'bg-diff-changed text-gray-900',
    testId: 'filter-changed',
    getCount: (s) => s.changed,
  },
  {
    key: 'showAddedRemoved',
    label: 'Added/Removed Bars',
    activeClass: 'text-white',
    activeStyle: { background: 'linear-gradient(135deg, #22c55e 0%, #22c55e 50%, #ef4444 50%, #ef4444 100%)' },
    testId: 'filter-added-removed',
    getCount: (s) => s.addedBars + s.removedBars,
  },
  {
    key: 'showTempoTimeSig',
    label: 'Tempo/Time Changes',
    activeClass: 'bg-diff-meta text-white',
    testId: 'filter-temposig',
    getCount: (s) => s.tempoChanges + s.timeSigChanges,
  },
]

export function DiffFilterBar({ filters, onFiltersChange, summary }: DiffFilterBarProps) {
  const disabled = summary === null

  return (
    <div data-testid="diff-filter-bar" className="flex items-center gap-2">
      {PILLS.map((pill) => {
        const active = filters[pill.key]
        const count = summary ? pill.getCount(summary) : 0
        return (
          <button
            key={pill.key}
            data-testid={pill.testId}
            style={active && pill.activeStyle ? pill.activeStyle : undefined}
            className={`text-xs font-semibold px-3 py-1 rounded-full transition-all duration-150 ${
              active ? pill.activeClass : 'bg-chrome-bg-subtle text-chrome-text-muted'
            } ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer hover:opacity-90 hover:shadow-sm'}`}
            onClick={() => {
              if (!disabled) {
                onFiltersChange({ ...filters, [pill.key]: !active })
              }
            }}
            disabled={disabled}
          >
            {pill.label} {count}
          </button>
        )
      })}
    </div>
  )
}
