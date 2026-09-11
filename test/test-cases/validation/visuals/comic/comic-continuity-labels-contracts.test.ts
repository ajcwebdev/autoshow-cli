import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { computeContinuityKeyMetrics, joinContinuityLabels, parseContinuityLabels, readContinuityLabels } from '~/cli/commands/visuals/comic/comic-utils/continuity-labels'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { setupContinuityContractFixtures } from './comic-continuity-contract-fixtures'
const { temporaryDirectories, entryFor, labelsFile, verdicts } = setupContinuityContractFixtures()


describe('continuity labels join and precision arithmetic', () => {
  test('validates the labels file shape and scene binding', () => {
    expect(parseContinuityLabels(labelsFile('scene', { trustedAnchorPanel: 2 }), { sceneSlug: 'scene' }).trustedAnchorPanel).toBe(2)
    expect(() => parseContinuityLabels({ ...labelsFile('scene'), extra: 1 })).toThrow('Invalid continuity labels')
    expect(() => parseContinuityLabels(labelsFile('scene', { pairs: [{ panels: [1, 2], verdicts: { ...verdicts(), 'desk-drift': true } as ReturnType<typeof verdicts> }] }))).toThrow('desk-drift')
    expect(() => parseContinuityLabels(labelsFile('other'), { sceneSlug: 'scene' })).toThrow('labels are for scene "other"')
    expect(() => parseContinuityLabels(labelsFile('scene', { pairs: [{ panels: [2, 2], verdicts: verdicts() }] }))).toThrow('must name two different panels')
    expect(() => parseContinuityLabels(labelsFile('scene', { pairs: [{ panels: [1, 2], verdicts: verdicts() }, { panels: [1, 2], verdicts: verdicts(['intruder']) }] }))).toThrow('more than once')
    expect(() => parseContinuityLabels({ ...labelsFile('scene'), schemaVersion: 2 })).toThrow('schemaVersion')
  })

  test('joins labeled pairs to judged panels and computes precision and recall per key', () => {
    const entries = [
      entryFor(2, 1, 1, { blooperCategory: 'intruder', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }] }),
      entryFor(3, 1, 2, { axisStatus: 'crossed', furnitureOrientation: { versusAnchor: 'rotated', versusPredecessor: 'same' } }),
      entryFor(4, 1, 3, { blooperCategory: 'seat-swap' }),
    ]
    expect(entries[1]?.hardKeys).toEqual(['side-flip', 'furniture-spin'])
    const join = joinContinuityLabels(labelsFile('scene', {
      labeler: 'Erik', date: '2026-09-03', trustedAnchorPanel: 1,
      pairs: [
        { panels: [1, 2], verdicts: verdicts(['intruder']) },
        { panels: [2, 3], verdicts: verdicts(['intruder']) },
        { panels: [1, 3], verdicts: verdicts(['side-flip']) },
        { panels: [3, 4], verdicts: verdicts() },
        { panels: [5, 6], verdicts: verdicts(['intruder']) },
        { panels: [2, 4], verdicts: verdicts() },
      ],
    }), entries)
    expect(join).toMatchObject({ labeler: 'Erik', date: '2026-09-03', trustedAnchorPanel: 1, labeledPairs: 6, matchedPairs: 4 })
    expect(join.unmatchedPairs).toEqual([
      { panels: [5, 6], reason: 'panel 6 was not judged' },
      { panels: [2, 4], reason: 'panel 4 was judged against anchor 1 and predecessor 3, not panel 2' },
    ])
    const byKey = Object.fromEntries(join.byKey.map(metrics => [metrics.key, metrics]))
    expect(byKey['intruder']).toEqual({ key: 'intruder', truePositives: 1, falsePositives: 0, falseNegatives: 1, trueNegatives: 2, precision: 1, recall: 0.5 })
    expect(byKey['side-flip']).toEqual({ key: 'side-flip', truePositives: 0, falsePositives: 0, falseNegatives: 1, trueNegatives: 3, precision: null, recall: 0 })
    expect(byKey['seat-swap']).toEqual({ key: 'seat-swap', truePositives: 0, falsePositives: 1, falseNegatives: 0, trueNegatives: 3, precision: 0, recall: null })
    expect(byKey['furniture-spin']).toEqual({ key: 'furniture-spin', truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 4, precision: null, recall: null })
    expect(byKey['wardrobe-swap']).toMatchObject({ truePositives: 0, falsePositives: 0, falseNegatives: 0, trueNegatives: 4, precision: null, recall: null })
    expect(computeContinuityKeyMetrics('side-flip', [{ labeled: true, judged: true }, { labeled: true, judged: true }, { labeled: false, judged: true }])).toMatchObject({ precision: 0.6667, recall: 1 })
  })

  test('reads a labels file from disk and rejects a missing or malformed one', async () => {
    const directory = await makeTempDir('autoshow-continuity-labels-')
    temporaryDirectories.push(directory)
    const path = join(directory, 'continuity-labels.json')
    await Bun.write(path, JSON.stringify(labelsFile('scene', { trustedAnchorPanel: 3 })))
    expect((await readContinuityLabels(path, { sceneSlug: 'scene' })).trustedAnchorPanel).toBe(3)
    await expect(readContinuityLabels(join(directory, 'missing.json'))).rejects.toThrow('was not found')
    await Bun.write(path, '{oops')
    await expect(readContinuityLabels(path)).rejects.toThrow('not valid JSON')
  })

  test('refuses an unlabeled template whose verdicts are schema placeholders', async () => {
    const directory = await makeTempDir('autoshow-continuity-labels-template-')
    temporaryDirectories.push(directory)
    const path = join(directory, 'continuity-labels.json')
    const template = { ...labelsFile('scene', { labeler: 'TEMPLATE - NOT LABELED', date: '' }), labeled: false, pairs: [{ panels: [1, 2] as [number, number], verdicts: verdicts() }] }
    // The template still parses: only reading it as ground truth for precision and recall is refused.
    expect(parseContinuityLabels(template).labeled).toBe(false)
    await Bun.write(path, JSON.stringify(template))
    await expect(readContinuityLabels(path)).rejects.toThrow('are an unlabeled template rather than human ground truth')
    await Bun.write(path, JSON.stringify({ ...template, labeled: true, labeler: 'Anthony', date: '2026-09-02' }))
    expect((await readContinuityLabels(path)).labeled).toBe(true)
    // A file written before the field existed is still ground truth.
    await Bun.write(path, JSON.stringify(labelsFile('scene')))
    expect((await readContinuityLabels(path)).labeled).toBeUndefined()
  })
})
