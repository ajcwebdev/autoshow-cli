import { describe, expect, test } from 'bun:test'
import {
  CONTINUITY_ESTIMATED_INPUT_UNITS_PER_PANEL,
  CONTINUITY_ESTIMATED_OUTPUT_UNITS_PER_PANEL
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/continuity-qa'
import { estimateQaOnlyPanelAuditPrice } from '~/cli/commands/visuals/comic/comic-utils/qa-only-price-estimate'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { setupContinuityContractFixtures } from './comic-continuity-contract-fixtures'
const { JUDGE_MODEL, createSceneFixture } = setupContinuityContractFixtures()


describe('QA-only continuity price estimate', () => {
  test('prices one 9,000-input, 1,500-output unit call per panel on the QA model and drops page judge calls under --continuity-only', async () => {
    const sceneSlug = `continuity-price-${crypto.randomUUID()}`
    await createSceneFixture(sceneSlug, [{ number: 1, characterKeys: ['hero', 'rival'] }, { number: 2, characterKeys: ['hero'] }, { number: 3, characterKeys: ['hero'] }])
    expect(CONTINUITY_ESTIMATED_INPUT_UNITS_PER_PANEL).toBe(9000)
    expect(CONTINUITY_ESTIMATED_OUTPUT_UNITS_PER_PANEL).toBe(1500)
    const only = await captureLogEvents(async () => {
      await estimateQaOnlyPanelAuditPrice({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, continuityQa: true, continuityOnly: true })
    })
    expect(only.events.every(event => event.category === 'pricing')).toBe(true)
    const onlyDetails = only.events.find(event => event.message === 'Comic - Price Estimate: generate-images (QA-only)')
    expect(onlyDetails?.metadata).toMatchObject({ mode: 'qa-only', canonicalPanels: 3, judgeModel: JUDGE_MODEL, judgeCalls: 0, pageJudgeCalls: 0, continuityQa: true, continuityOnly: true, continuityJudgeCalls: 3, continuityInputUnits: 27_000, continuityOutputUnits: 4_500, imageGenerationCalls: 0, imageRepairCalls: 0 })
    expect(onlyDetails?.metadata?.['continuityCost']).toBeCloseTo(0.27, 10)
    expect(onlyDetails?.metadata?.['estimatedTotal']).toBeCloseTo(0.27, 10)
    expect((onlyDetails?.metadata?.['details'] as Record<string, unknown>)['Continuity judge calls']).toBe(3)
    expect((onlyDetails?.metadata?.['details'] as Record<string, unknown>)['Heuristic continuity units']).toBe('27,000 input + 4,500 output')
    expect(only.events.some(event => event.message === 'Total: ~$0.27')).toBe(true)
    expect(only.events.some(event => event.message.startsWith('QA-only price mode performs no provider calls or writes'))).toBe(true)

    const beside = await captureLogEvents(async () => {
      await estimateQaOnlyPanelAuditPrice({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2, 3], continuityQa: true })
    })
    const besideDetails = beside.events.find(event => event.message === 'Comic - Price Estimate: generate-images (QA-only)')
    expect(besideDetails?.metadata).toMatchObject({ canonicalPanels: 2, judgeCalls: 2, pageJudgeCalls: 2, continuityOnly: false, continuityJudgeCalls: 2, continuityInputUnits: 18_000, continuityOutputUnits: 3_000 })
    expect(besideDetails?.metadata?.['estimatedTotal']).toBeCloseTo(0.302, 10)
    expect(beside.events.some(event => event.message === 'Total: ~$0.30')).toBe(true)

    const plain = await captureLogEvents(async () => {
      await estimateQaOnlyPanelAuditPrice({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: JUDGE_MODEL, maxRepairs: 0, panels: [2] })
    })
    const plainDetails = plain.events.find(event => event.message === 'Comic - Price Estimate: generate-images (QA-only)')
    expect(plainDetails?.metadata).toMatchObject({ judgeCalls: 1 })
    expect(plainDetails?.metadata?.['continuityJudgeCalls']).toBeUndefined()
    expect(plain.events.some(event => event.message === 'Total: ~$0.06')).toBe(true)
  })
})
