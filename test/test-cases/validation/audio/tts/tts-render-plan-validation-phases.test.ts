import { describe, expect, test } from 'bun:test'
import { computeRenderIdentity, hashCanonicalRecordWithout, hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { validateProviderRenderPlanIdentity } from '~/cli/commands/audio/tts/script-to-audio/contract-validation-plan'
import { planCurrentTtsReadiness } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { ProviderRenderPlan } from '~/types'

const fixture = (): ProviderRenderPlan => {
  const ttsOptions = buildOptsFromFlags({ 'openai-tts': 'gpt-4o-mini-tts-2025-12-15', 'tts-dialogue-format': 'labeled', 'tts-speaker': ['Alice=alloy', 'Bob=onyx'] })
  const target = collectTtsTargets(ttsOptions)[0]!
  return structuredClone(planCurrentTtsReadiness({ target, sourceText: 'Alice: First line.\nBob: Second line.', ttsOptions }).renderPlan)
}

const resign = (plan: ProviderRenderPlan): ProviderRenderPlan => {
  plan.renderPlanId = hashCanonicalRecordWithout(plan as unknown as Record<string, unknown>, ['renderPlanId', 'renderIdentity'])
  plan.renderIdentity = computeRenderIdentity({ renderPlanId: plan.renderPlanId, targetKey: plan.targetKey, strategy: plan.strategy, voiceContextKey: plan.voiceContextKey, synthesisSettingsHash: plan.synthesisSettingsHash, outputProfileHash: plan.outputProfileHash })
  return plan
}

const turns = (plan: ProviderRenderPlan) => plan.nodes.flatMap(node => node.kind === 'turn' ? [node.turn] : node.turns)

describe('ordered provider render-plan validation', () => {
  test('accepts current and legacy segmented output identities', () => {
    const plan = fixture()
    expect(validateProviderRenderPlanIdentity(plan)).toBe(plan)
    plan.outputProfileHash = hashCanonicalTtsValue(plan.requestedOutput)
    expect(validateProviderRenderPlanIdentity(resign(plan))).toBe(plan)
  })

  const mutations: Array<[string, (plan: ProviderRenderPlan) => void, string]> = [
    ['target identity', plan => { plan.targetKey = 'invalid' }, 'targetKey'],
    ['capability identity', plan => { plan.capabilityFixtureHash = 'invalid' }, 'capability, settings, and output identities'],
    ['resolved text', plan => { turns(plan)[0]!.canonicalText = 'changed' }, 'exact canonical turn text'],
    ['voice target', plan => { turns(plan)[0]!.voice.providerModel = 'another-model' }, 'voice binding does not match'],
    ['batch coverage', plan => { plan.batches[0]!.orderedTurnIds = ['unknown-turn'] }, 'batch turn coverage'],
    ['slot index', plan => { plan.batches[0]!.generationSlots[0]!.slotIndex = 2 }, 'contiguous zero-based indexes'],
    ['continuation order', plan => { plan.batches[0]!.continuation = { kind: 'prior-batch-selection', predecessorBatchId: plan.batches[0]!.batchId } }, 'earlier batch'],
    ['transient bindings', plan => { plan.voiceContext = { kind: 'transient', bindingIdentityHashes: [] } }, 'exactly match its turn bindings'],
    ['approved context', plan => { plan.voiceContext = { kind: 'approved-snapshot', snapshotId: 'snapshot' } }, 'does not match its snapshot'],
  ]
  for (const [label, mutate, error] of mutations) {
    test(`rejects tampered ${label} after recomputing outer hashes`, () => {
      const plan = fixture()
      mutate(plan)
      expect(() => validateProviderRenderPlanIdentity(resign(plan))).toThrow(error)
    })
  }

  test('checks plan hash before turn and batch errors', () => {
    const plan = fixture()
    turns(plan)[0]!.canonicalText = ''
    plan.batches = []
    expect(() => validateProviderRenderPlanIdentity(plan)).toThrow('invalid renderPlanId')
    resign(plan)
    plan.renderIdentity = 'wrong'
    expect(() => validateProviderRenderPlanIdentity(plan)).toThrow('invalid voice-aware renderIdentity')
  })

  test('accepts hybrid partial coverage while rejecting unknown resubmitted turns', () => {
    const base = fixture()
    const [reused, resubmitted] = turns(base)
    const hash = 'a'.repeat(64)
    const plan: ProviderRenderPlan = {
      ...base, strategy: 'hybrid', outputProfileHash: hashCanonicalTtsValue(base.requestedOutput),
      batches: [{ ...base.batches[0]!, orderedTurnIds: [resubmitted!.turnId] }],
      repair: {
        schemaVersion: 1, baseTargetKey: base.targetKey, baseSourceIdentityHash: hash, baseDialoguePlanId: hash, baseRenderIdentity: hash, baseRenderPlanId: hash, baseResultIdentity: hash, baseResultRef: 'result.json', baseResultSha256: hash,
        reusedOutputs: [{ baseBatchResultId: 'batch', outputId: 'output', artifactRef: 'output.wav', sha256: hash, sourceTurnIds: [reused!.turnId], coveredCanonicalRanges: [{ turnId: reused!.turnId, start: 0, end: 1, indexUnit: 'unicode-scalar-value', canonicalTextSliceHash: hash, preparedProviderTextSliceHash: hash, bindingIdentityHash: hash, providerControlsHash: hash, requestedOutputHash: hash }] }],
        resubmittedTurnIds: [resubmitted!.turnId]
      }
    }
    expect(validateProviderRenderPlanIdentity(resign(plan))).toBe(plan)
    plan.batches[0]!.orderedTurnIds = ['unknown']
    expect(() => validateProviderRenderPlanIdentity(resign(plan))).toThrow('references an unknown turn')
  })
})
