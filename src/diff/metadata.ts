import type { model } from '@coderline/alphatab'

type Score = model.Score

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiNoteToName(midi: number): string {
  const note = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

export function formatTuning(tuning: number[]): string {
  if (tuning.length === 0) return ''
  // alphaTab stores tuning high-to-low (string 1 = highest). Display low-to-high.
  return [...tuning].reverse().map(midiNoteToName).join(' ')
}

// General MIDI instrument names (program 0–127)
const GM_INSTRUMENTS = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
  'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
  'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
  'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
  'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
  'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass',
  'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
  'Choir Aahs', 'Voice Oohs', 'Synth Choir', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
  'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax',
  'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
  'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
  'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
  'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
  'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto',
  'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock',
  'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet',
  'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
] as const

export function gmInstrumentName(program: number): string {
  if (program < 0 || program >= GM_INSTRUMENTS.length) return 'Unknown'
  return GM_INSTRUMENTS[program]
}

export interface FieldComparison {
  label: string
  valueA: string
  valueB: string
  differs: boolean
}

export interface TrackComparison {
  trackIndex: number
  nameA: string
  nameB: string
  fields: FieldComparison[]
}

export interface MetadataComparison {
  scoreFields: FieldComparison[]
  tracks: TrackComparison[]
}

const SCORE_FIELDS: { label: string; key: keyof Pick<Score, 'title' | 'subTitle' | 'artist' | 'album' | 'music' | 'words' | 'tab' | 'copyright' | 'instructions' | 'notices'> }[] = [
  { label: 'Title', key: 'title' },
  { label: 'Subtitle', key: 'subTitle' },
  { label: 'Artist', key: 'artist' },
  { label: 'Album', key: 'album' },
  { label: 'Composer', key: 'music' },
  { label: 'Lyricist', key: 'words' },
  { label: 'Tabbed by', key: 'tab' },
  { label: 'Copyright', key: 'copyright' },
  { label: 'Instructions', key: 'instructions' },
  { label: 'Notices', key: 'notices' },
]

export function compareMetadata(scoreA: Score, scoreB: Score): MetadataComparison {
  const scoreFields: FieldComparison[] = SCORE_FIELDS.map(({ label, key }) => {
    const valueA = String(scoreA[key] ?? '')
    const valueB = String(scoreB[key] ?? '')
    return { label, valueA, valueB, differs: valueA !== valueB }
  })

  const maxTracks = Math.max(scoreA.tracks.length, scoreB.tracks.length)
  const tracks: TrackComparison[] = []

  for (let i = 0; i < maxTracks; i++) {
    const trackA = scoreA.tracks[i] ?? null
    const trackB = scoreB.tracks[i] ?? null
    const nameA = trackA?.name ?? '—'
    const nameB = trackB?.name ?? '—'

    const fields: FieldComparison[] = []

    // Instrument (percussion tracks ignore program number — channel 10 determines drums)
    const staffA = trackA?.staves[0] ?? null
    const staffB = trackB?.staves[0] ?? null
    const instrA = trackA ? (staffA?.isPercussion ? 'Drums' : gmInstrumentName(trackA.playbackInfo.program)) : '—'
    const instrB = trackB ? (staffB?.isPercussion ? 'Drums' : gmInstrumentName(trackB.playbackInfo.program)) : '—'
    fields.push({ label: 'Instrument', valueA: instrA, valueB: instrB, differs: instrA !== instrB })

    // Tuning
    const tuningA = staffA ? (staffA.isPercussion ? 'Percussion' : formatTuning(staffA.tuning)) : '—'
    const tuningB = staffB ? (staffB.isPercussion ? 'Percussion' : formatTuning(staffB.tuning)) : '—'
    fields.push({ label: 'Tuning', valueA: tuningA, valueB: tuningB, differs: tuningA !== tuningB })

    // Capo (only if non-zero on either side)
    const capoA = staffA?.capo ?? 0
    const capoB = staffB?.capo ?? 0
    if (capoA !== 0 || capoB !== 0) {
      const capoValA = capoA > 0 ? `Fret ${capoA}` : 'None'
      const capoValB = capoB > 0 ? `Fret ${capoB}` : 'None'
      fields.push({ label: 'Capo', valueA: capoValA, valueB: capoValB, differs: capoA !== capoB })
    }

    tracks.push({ trackIndex: i, nameA, nameB, fields })
  }

  return { scoreFields, tracks }
}
