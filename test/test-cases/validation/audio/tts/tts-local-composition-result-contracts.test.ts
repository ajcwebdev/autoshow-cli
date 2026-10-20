import { describe, expect, test } from 'bun:test'
import type { AttemptContext } from '~/types'
import { buildLocalCompositionRenderResult } from '~/cli/commands/audio/tts/script-to-audio/attempt-finalize'
import { hashCanonicalRecordWithout } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'

// Recorded from the implementation before the payload was built once, so a refactor that drops,
// renames or alters a hashed field changes this value.
const GOLDEN_RESULT_IDENTITY = 'd9750b1bdbbf95b6c6943e537029f198fc5a084114ba68c566c62ac72587f3a3'

const RENDER_ROOT = 'tts-renders/render-a'

const batchFile = (slot: 'slot-1' | 'slot-2', turnId: string, amount: number) => ({
  path: `${RENDER_ROOT}/batches/${slot}/provider-batch-result.json`,
  sha256: `${slot}-sha256`,
  value: {
    batchId: `batch-${slot}`,
    generationSlotId: slot,
    batchResultId: `result-${slot}`,
    requestedTurnIds: [turnId],
    observedRequests: [{ invocationId: 'invocation-1', requestOrdinal: slot === 'slot-1' ? 1 : 2, turns: [{ turnId }] }],
    outputs: [{ outputId: `output-${slot}`, artifactRef: `audio/${slot}.wav` }],
    generatedBatch: { batchId: `batch-${slot}`, slotIds: [slot] },
    createdResources: [],
    retryAttempts: [],
    cost: { planned: { amounts: [{ currency: 'USD', amount }] } }
  }
})

const fixture = () => {
  const purePlan = {
    renderPlanId: 'render-plan-a',
    renderIdentity: 'render-identity-a',
    plannedRenderCost: { amounts: [{ currency: 'USD', amount: 0.03 }] },
    planned: {
      slots: [{ generationSlotId: 'slot-1' }, { generationSlotId: 'slot-2' }],
      turns: [{ canonical: { turnId: 'turn-1' } }, { canonical: { turnId: 'turn-2' } }]
    }
  } as unknown as AttemptContext['purePlan']
  // Deliberately out of plan order: the builder must sort by plan slot.
  const recovered = [batchFile('slot-2', 'turn-2', 0.02), batchFile('slot-1', 'turn-1', 0.01)] as unknown as AttemptContext['recoveredBatchFiles']
  return { purePlan, recovered }
}

describe('local-composition render result contracts', () => {
  test('the result identity is unchanged from the recorded golden value', () => {
    const { purePlan, recovered } = fixture()
    const { renderResult } = buildLocalCompositionRenderResult(purePlan, RENDER_ROOT, recovered)
    expect(renderResult.resultIdentity).toBe(GOLDEN_RESULT_IDENTITY)
  })

  test('the identity hashes exactly the serialized fields other than itself', () => {
    const { purePlan, recovered } = fixture()
    const { renderResult, batchResultFiles } = buildLocalCompositionRenderResult(purePlan, RENDER_ROOT, recovered)

    expect(renderResult.resultIdentity).toBe(hashCanonicalRecordWithout(renderResult as unknown as Record<string, unknown>, ['resultIdentity']))
    expect(batchResultFiles.map((file) => file.value.generationSlotId)).toEqual(['slot-1', 'slot-2'])
    expect(renderResult.batchResults.map((ref) => ref.artifactRef)).toEqual([
      'batches/slot-1/provider-batch-result.json',
      'batches/slot-2/provider-batch-result.json'
    ])
    expect(renderResult.cost.cumulativeRenderHistory.planned).toEqual({ amounts: [{ currency: 'USD', amount: 0.03 }] })
  })

  test('changing a recovered output or planned cost changes the identity', () => {
    const { purePlan, recovered } = fixture()
    const baseline = buildLocalCompositionRenderResult(purePlan, RENDER_ROOT, recovered).renderResult.resultIdentity

    const changedOutput = fixture()
    ;(changedOutput.recovered[0]!.value.outputs[0] as { outputId: string }).outputId = 'output-slot-2-replaced'
    const changedCost = fixture()
    changedCost.recovered[1]!.value.cost.planned.amounts[0]!.amount = 0.5

    expect(buildLocalCompositionRenderResult(changedOutput.purePlan, RENDER_ROOT, changedOutput.recovered).renderResult.resultIdentity).not.toBe(baseline)
    expect(buildLocalCompositionRenderResult(changedCost.purePlan, RENDER_ROOT, changedCost.recovered).renderResult.resultIdentity).not.toBe(baseline)
  })
})
