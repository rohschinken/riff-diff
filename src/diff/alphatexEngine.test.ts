import { importer, Settings } from '@coderline/alphatab/core'
import { diffScoresAlphaTex } from './alphatexEngine'
import { resolveDiffEngine } from './engineSelector'
import type { DiffResult } from './types'

const settings = new Settings()

function score(tex: string) {
  const imp = new importer.AlphaTexImporter()
  imp.initFromString(tex, settings)
  return imp.readScore()
}

function statuses(result: DiffResult, measureIndex: number) {
  return result.measures[measureIndex].beatDiffs.map(b => b.status)
}

describe('diffScoresAlphaTex', () => {
  it('reports identical scores as fully equal', () => {
    const tex = '\\ts 4 4\n:4 3.2 5.2 | :8 7.2 9.2'
    const result = diffScoresAlphaTex(score(tex), score(tex), 0, 0)

    expect(result.measures).toHaveLength(2)
    expect(result.summary.changed).toBe(0)
    expect(result.summary.addedBars).toBe(0)
    expect(result.summary.removedBars).toBe(0)
    expect(statuses(result, 0)).toEqual(['equal', 'equal'])
    expect(statuses(result, 1)).toEqual(['equal', 'equal'])
  })

  it('detects a changed fret within a bar', () => {
    const a = score('\\ts 4 4\n:4 3.2 5.2 | :8 7.2 9.2')
    const b = score('\\ts 4 4\n:4 3.2 8.2 | :8 7.2 9.2')
    const result = diffScoresAlphaTex(a, b, 0, 0)

    expect(statuses(result, 0)).toEqual(['equal', 'changed'])
    expect(statuses(result, 1)).toEqual(['equal', 'equal'])
    expect(result.summary.changed).toBe(1)
  })

  it('flags effects-only differences while keeping the beat equal', () => {
    const a = score('\\ts 4 4\n:4 3.2 5.2 | :8 7.2 9.2')
    const b = score('\\ts 4 4\n:4 3.2{st} 5.2 | :8 7.2 9.2')
    const result = diffScoresAlphaTex(a, b, 0, 0)

    const beat = result.measures[0].beatDiffs[0]
    expect(beat.status).toBe('equal')
    expect(beat.hasEffectsDiff).toBe(true)
    expect(result.measures[0].beatDiffs[1].hasEffectsDiff).toBeFalsy()
  })

  it('reports note additions inside a changed chord', () => {
    const a = score('\\ts 4 4\n:4 (3.2 5.2) | :8 7.2 9.2')
    const b = score('\\ts 4 4\n:4 (3.2 5.2 6.2) | :8 7.2 9.2')
    const result = diffScoresAlphaTex(a, b, 0, 0)

    const beat = result.measures[0].beatDiffs[0]
    expect(beat.status).toBe('changed')
    expect(beat.noteDiffs?.filter(n => n.status === 'noteAdded')).toHaveLength(1)
    expect(beat.noteDiffs?.filter(n => n.status === 'noteEqual')).toHaveLength(2)
  })

  it('aligns an added bar without flagging unrelated bars', () => {
    const a = score('\\ts 4 4\n:4 3.2 5.2 | :8 7.2 9.2')
    const b = score('\\ts 4 4\n:4 3.2 5.2 | :4 1.2 2.2 | :8 7.2 9.2')
    const result = diffScoresAlphaTex(a, b, 0, 0)

    expect(result.summary.addedBars).toBe(1)
    expect(result.measures).toHaveLength(3)
    const added = result.measures.find(m => m.measureIndexA === null)
    expect(added?.measureIndexB).toBe(1)
    expect(statuses(result, 0)).toEqual(['equal', 'equal'])
  })

  it('reports tempo changes without flagging every beat', () => {
    const a = score('\\tempo (120) \\ts 4 4\n:4 3.2 5.2 | :8 7.2 9.2')
    const b = score('\\tempo (140) \\ts 4 4\n:4 3.2 5.2 | :8 7.2 9.2')
    const result = diffScoresAlphaTex(a, b, 0, 0)

    expect(result.measures[0].tempoDiff).toEqual({ tempoA: 120, tempoB: 140 })
    expect(result.summary.changed).toBe(0)
    expect(result.summary.tempoChanges).toBeGreaterThan(0)
  })

  it('reports time signature changes', () => {
    const a = score('\\ts 4 4\n:4 3.2 5.2')
    const b = score('\\ts 3 4\n:4 3.2 5.2')
    const result = diffScoresAlphaTex(a, b, 0, 0)

    expect(result.measures[0].timeSigDiff).toEqual({ sigA: '4/4', sigB: '3/4' })
    expect(result.summary.timeSigChanges).toBe(1)
  })
})

describe('resolveDiffEngine', () => {
  afterEach(() => localStorage.clear())

  it('defaults to the custom engine', () => {
    expect(resolveDiffEngine()).toBe('custom')
  })

  it('opts into the alphatex engine via localStorage', () => {
    localStorage.setItem('riff-diff-engine', 'alphatex')
    expect(resolveDiffEngine()).toBe('alphatex')
  })
})
