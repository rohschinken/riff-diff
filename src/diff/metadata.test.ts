import { describe, it, expect } from 'vitest'
import { midiNoteToName, gmInstrumentName, formatTuning, compareMetadata } from './metadata'

// --- Minimal mock helpers for alphaTab Score-like objects ---

function makeStaff(overrides: {
  tuning?: number[]
  isPercussion?: boolean
  capo?: number
  stringTuning?: { name: string }
} = {}) {
  return {
    tuning: overrides.tuning ?? [64, 59, 55, 50, 45, 40],
    isPercussion: overrides.isPercussion ?? false,
    capo: overrides.capo ?? 0,
    stringTuning: overrides.stringTuning ?? { name: 'Standard' },
  }
}

function makeTrack(overrides: {
  index?: number
  name?: string
  playbackInfo?: { program: number }
  staves?: ReturnType<typeof makeStaff>[]
} = {}) {
  return {
    index: overrides.index ?? 0,
    name: overrides.name ?? 'Track 1',
    playbackInfo: overrides.playbackInfo ?? { program: 25 },
    staves: overrides.staves ?? [makeStaff()],
  }
}

function makeScore(overrides: {
  title?: string
  subTitle?: string
  artist?: string
  album?: string
  music?: string
  words?: string
  tab?: string
  copyright?: string
  instructions?: string
  notices?: string
  tracks?: ReturnType<typeof makeTrack>[]
} = {}) {
  return {
    title: overrides.title ?? '',
    subTitle: overrides.subTitle ?? '',
    artist: overrides.artist ?? '',
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

// --- Tests ---

describe('midiNoteToName', () => {
  it('converts E2 (low E guitar)', () => {
    expect(midiNoteToName(40)).toBe('E2')
  })

  it('converts E4 (high E guitar)', () => {
    expect(midiNoteToName(64)).toBe('E4')
  })

  it('converts C4 (middle C)', () => {
    expect(midiNoteToName(60)).toBe('C4')
  })

  it('converts C-1 (MIDI 0)', () => {
    expect(midiNoteToName(0)).toBe('C-1')
  })

  it('converts sharps correctly (C#3 = MIDI 49)', () => {
    expect(midiNoteToName(49)).toBe('C#3')
  })
})

describe('formatTuning', () => {
  it('formats standard guitar tuning (high-to-low input) as low-to-high', () => {
    expect(formatTuning([64, 59, 55, 50, 45, 40])).toBe('E2 A2 D3 G3 B3 E4')
  })

  it('returns empty string for empty array', () => {
    expect(formatTuning([])).toBe('')
  })

  it('formats 4-string bass tuning', () => {
    expect(formatTuning([43, 38, 33, 28])).toBe('E1 A1 D2 G2')
  })
})

describe('gmInstrumentName', () => {
  it('returns Acoustic Grand Piano for program 0', () => {
    expect(gmInstrumentName(0)).toBe('Acoustic Grand Piano')
  })

  it('returns Acoustic Guitar (steel) for program 25', () => {
    expect(gmInstrumentName(25)).toBe('Acoustic Guitar (steel)')
  })

  it('returns Unknown for out-of-range program', () => {
    expect(gmInstrumentName(128)).toBe('Unknown')
  })

  it('returns Unknown for negative program', () => {
    expect(gmInstrumentName(-1)).toBe('Unknown')
  })
})

describe('compareMetadata', () => {
  it('detects differing title', () => {
    const a = makeScore({ title: 'Song A' })
    const b = makeScore({ title: 'Song B' })
    const result = compareMetadata(a as any, b as any)
    const titleField = result.scoreFields.find(f => f.label === 'Title')
    expect(titleField).toBeDefined()
    expect(titleField!.valueA).toBe('Song A')
    expect(titleField!.valueB).toBe('Song B')
    expect(titleField!.differs).toBe(true)
  })

  it('marks matching fields as not differing', () => {
    const a = makeScore({ artist: 'Same Artist' })
    const b = makeScore({ artist: 'Same Artist' })
    const result = compareMetadata(a as any, b as any)
    const artistField = result.scoreFields.find(f => f.label === 'Artist')
    expect(artistField!.differs).toBe(false)
  })

  it('compares all 10 score-level fields', () => {
    const a = makeScore()
    const b = makeScore()
    const result = compareMetadata(a as any, b as any)
    expect(result.scoreFields.length).toBe(10)
    const labels = result.scoreFields.map(f => f.label)
    expect(labels).toContain('Title')
    expect(labels).toContain('Subtitle')
    expect(labels).toContain('Artist')
    expect(labels).toContain('Album')
    expect(labels).toContain('Composer')
    expect(labels).toContain('Lyricist')
    expect(labels).toContain('Tabbed by')
    expect(labels).toContain('Copyright')
    expect(labels).toContain('Instructions')
    expect(labels).toContain('Notices')
  })

  it('compares track tuning correctly', () => {
    const a = makeScore({
      tracks: [makeTrack({ staves: [makeStaff({ tuning: [64, 59, 55, 50, 45, 40] })] })],
    })
    // Drop D tuning: low E (40) → D (38)
    const b = makeScore({
      tracks: [makeTrack({ staves: [makeStaff({ tuning: [64, 59, 55, 50, 45, 38] })] })],
    })
    const result = compareMetadata(a as any, b as any)
    expect(result.tracks.length).toBe(1)
    const tuningField = result.tracks[0].fields.find(f => f.label === 'Tuning')
    expect(tuningField!.differs).toBe(true)
    expect(tuningField!.valueA).toBe('E2 A2 D3 G3 B3 E4')
    expect(tuningField!.valueB).toBe('D2 A2 D3 G3 B3 E4')
  })

  it('handles different track counts', () => {
    const a = makeScore({
      tracks: [
        makeTrack({ index: 0, name: 'Guitar' }),
        makeTrack({ index: 1, name: 'Bass' }),
      ],
    })
    const b = makeScore({
      tracks: [makeTrack({ index: 0, name: 'Guitar' })],
    })
    const result = compareMetadata(a as any, b as any)
    expect(result.tracks.length).toBe(2)
    expect(result.tracks[1].nameA).toBe('Bass')
    expect(result.tracks[1].nameB).toBe('—')
  })

  it('handles percussion tracks', () => {
    const a = makeScore({
      tracks: [makeTrack({ name: 'Drums', staves: [makeStaff({ isPercussion: true })] })],
    })
    const b = makeScore({
      tracks: [makeTrack({ name: 'Drums', staves: [makeStaff({ isPercussion: true })] })],
    })
    const result = compareMetadata(a as any, b as any)
    const tuningField = result.tracks[0].fields.find(f => f.label === 'Tuning')
    expect(tuningField!.valueA).toBe('Percussion')
    expect(tuningField!.valueB).toBe('Percussion')
    const instrField = result.tracks[0].fields.find(f => f.label === 'Instrument')
    expect(instrField!.valueA).toBe('Drums')
    expect(instrField!.valueB).toBe('Drums')
  })

  it('includes capo field when non-zero in either side', () => {
    const a = makeScore({
      tracks: [makeTrack({ staves: [makeStaff({ capo: 2 })] })],
    })
    const b = makeScore({
      tracks: [makeTrack({ staves: [makeStaff({ capo: 0 })] })],
    })
    const result = compareMetadata(a as any, b as any)
    const capoField = result.tracks[0].fields.find(f => f.label === 'Capo')
    expect(capoField).toBeDefined()
    expect(capoField!.valueA).toBe('Fret 2')
    expect(capoField!.valueB).toBe('None')
    expect(capoField!.differs).toBe(true)
  })

  it('omits capo field when zero on both sides', () => {
    const a = makeScore({
      tracks: [makeTrack({ staves: [makeStaff({ capo: 0 })] })],
    })
    const b = makeScore({
      tracks: [makeTrack({ staves: [makeStaff({ capo: 0 })] })],
    })
    const result = compareMetadata(a as any, b as any)
    const capoField = result.tracks[0].fields.find(f => f.label === 'Capo')
    expect(capoField).toBeUndefined()
  })
})
