import { describe, expect, test } from 'bun:test'
import {
  CONTINUITY_BLOOPER_CATEGORIES,
  CONTINUITY_HARD_KEYS,
  CONTINUITY_QA_JSON_SCHEMA,
  deriveContinuityHardKeys,
  deriveContinuityLabelKeys,
  hasContinuityHardFailure,
  parseContinuityJudgeResult
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/continuity-qa'
import type { ContinuityJudgeResult } from '~/types'
import { setupContinuityContractFixtures } from './comic-continuity-contract-fixtures'
const { continuityResult } = setupContinuityContractFixtures()


describe('continuity judge schema and hard rules', () => {
  test('parses a schema-valid judgment and normalizes the bookkeeping numbers to the audit plan', () => {
    const parsed = parseContinuityJudgeResult(JSON.stringify(continuityResult({ panelNumber: 9, anchorPanel: 9, predecessorPanel: 9 })), { panelNumber: 2, anchorPanel: 1, predecessorPanel: null })
    expect(parsed.panelNumber).toBe(2)
    expect(parsed.anchorPanel).toBe(1)
    expect(parsed.predecessorPanel).toBeNull()
    expect(parsed.blooperCategory).toBe('none')
    expect(parsed.castAudit).toHaveLength(2)
  })

  test('rejects malformed judgments with exact-key and enum discipline', () => {
    const expected = { panelNumber: 2, anchorPanel: 1, predecessorPanel: 1 }
    expect(() => parseContinuityJudgeResult('{not json', expected)).toThrow('Continuity judge returned invalid JSON')
    expect(() => parseContinuityJudgeResult(JSON.stringify({ ...continuityResult(), extra: true }), expected)).toThrow('missing, unexpected, or invalid fields')
    const { notes: _notes, ...missingNotes } = continuityResult()
    expect(() => parseContinuityJudgeResult(JSON.stringify(missingNotes), expected)).toThrow('missing, unexpected, or invalid fields')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ blooperCategory: 'desk-drift' as ContinuityJudgeResult['blooperCategory'] })), expected)).toThrow('blooperCategory')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ castAudit: [{ characterKey: 'hero', status: 'occluded' as 'present', note: 'x' }] })), expected)).toThrow('castAudit')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ observedStageState: '   ' })), expected)).toThrow('empty observedStageState')
    expect(() => parseContinuityJudgeResult(JSON.stringify(continuityResult({ characters: [{ characterKey: '', screenSide: 'left', posture: 'seated', relativePlacement: 'x', wardrobe: 'y' }] })), expected)).toThrow('without a characterKey')
  })

  test('the OpenAI subset JSON schema mirrors the strict valibot schema', () => {
    expect(CONTINUITY_QA_JSON_SCHEMA.additionalProperties).toBe(false)
    expect([...(CONTINUITY_QA_JSON_SCHEMA.required as readonly string[])].sort()).toEqual(Object.keys(CONTINUITY_QA_JSON_SCHEMA.properties).sort())
    expect([...CONTINUITY_QA_JSON_SCHEMA.properties.blooperCategory.enum]).toEqual([...CONTINUITY_BLOOPER_CATEGORIES])
    expect([...CONTINUITY_BLOOPER_CATEGORIES]).toEqual([...CONTINUITY_HARD_KEYS, 'none'])
    expect(CONTINUITY_QA_JSON_SCHEMA.properties.predecessorPanel.anyOf.map(item => item.type)).toEqual(['integer', 'null'])
    expect(CONTINUITY_QA_JSON_SCHEMA.properties.castAudit.items.additionalProperties).toBe(false)
    expect(CONTINUITY_QA_JSON_SCHEMA.properties.furnitureOrientation.required).toEqual(['versusAnchor', 'versusPredecessor'])
  })

  test('derives implied hard keys from the category, the cast audit, the axis, and the furniture orientation', () => {
    expect(deriveContinuityHardKeys(continuityResult())).toEqual([])
    expect(hasContinuityHardFailure(continuityResult())).toBe(false)
    expect(deriveContinuityHardKeys(continuityResult({ blooperCategory: 'seat-swap' }))).toEqual(['seat-swap'])
    expect(deriveContinuityHardKeys(continuityResult({ axisStatus: 'crossed' }))).toEqual(['side-flip'])
    expect(deriveContinuityHardKeys(continuityResult({ castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'Rival stands at the door.' }] }))).toEqual(['intruder'])
    expect(deriveContinuityHardKeys(continuityResult({ castAudit: [{ characterKey: 'hero', status: 'vanished', note: 'Hero is gone.' }] }))).toEqual(['vanishing-crowd'])
    expect(deriveContinuityHardKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'mirrored', versusPredecessor: 'same' } }))).toEqual(['furniture-spin'])
    expect(deriveContinuityHardKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'not-assessable', versusPredecessor: 'rotated' } }))).toEqual(['furniture-spin'])
    expect(deriveContinuityHardKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'same', versusPredecessor: 'redesigned' } }))).toEqual([])
    const combined = deriveContinuityHardKeys(continuityResult({ blooperCategory: 'wardrobe-swap', axisStatus: 'crossed', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }, { characterKey: 'hero', status: 'vanished', note: 'y' }], furnitureOrientation: { versusAnchor: 'rotated', versusPredecessor: 'same' } }))
    expect(combined).toEqual(['side-flip', 'furniture-spin', 'intruder', 'vanishing-crowd', 'wardrobe-swap'])
    expect(hasContinuityHardFailure(continuityResult({ blooperCategory: 'intruder' }))).toBe(true)
  })

  test('derives labels-join keys from the category and the cast audit only, never from the axis or the furniture orientation', () => {
    expect(deriveContinuityLabelKeys(continuityResult())).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ axisStatus: 'crossed' }))).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'mirrored', versusPredecessor: 'same' } }))).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ furnitureOrientation: { versusAnchor: 'not-assessable', versusPredecessor: 'rotated' } }))).toEqual([])
    expect(deriveContinuityLabelKeys(continuityResult({ blooperCategory: 'side-flip' }))).toEqual(['side-flip'])
    expect(deriveContinuityLabelKeys(continuityResult({ blooperCategory: 'furniture-spin' }))).toEqual(['furniture-spin'])
    expect(deriveContinuityLabelKeys(continuityResult({ castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }] }))).toEqual(['intruder'])
    expect(deriveContinuityLabelKeys(continuityResult({ castAudit: [{ characterKey: 'hero', status: 'vanished', note: 'y' }] }))).toEqual(['vanishing-crowd'])
    const combined = continuityResult({ blooperCategory: 'wardrobe-swap', axisStatus: 'crossed', castAudit: [{ characterKey: 'rival', status: 'intruding', note: 'x' }], furnitureOrientation: { versusAnchor: 'rotated', versusPredecessor: 'same' } })
    expect(deriveContinuityLabelKeys(combined)).toEqual(['intruder', 'wardrobe-swap'])
    expect(deriveContinuityHardKeys(combined)).toEqual(['side-flip', 'furniture-spin', 'intruder', 'wardrobe-swap'])
  })
})
