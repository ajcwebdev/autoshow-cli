import { normalizeDialogueSpeakerKey } from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import { planCurrentTtsRenderIdentity } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
  attachMistralProtectedReference,
  attachMistralProtectedSpeakerReferences,
  promoteMistralProtectedSpeakerReferences
} from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-protected-reference-binding'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import {
  MISTRAL_REQUEST_REFERENCE_STORE_ID,
  MISTRAL_REQUEST_REFERENCE_STORE_ROOT
} from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import { deriveGenerationResumeModelFields, TTS_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import type { GenerationResumeProviderIdentity, PipelineManifestItem, ProtectedAssetRef, ProtectedVoiceAssetStore, ResumeTarget, TtsOptions, TtsTarget } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { clearProviderModelFields } from '../generation-resume'
import { loadMistralResumeEvidence, materializedSpeakerBinding, protectedReferenceVoice } from './mistral-resume-evidence'
import { resolveTtsResumeSourceContext } from './tts-resume-source-context'

const TTS_MODEL_FIELDS = deriveGenerationResumeModelFields(TTS_GENERATION_SELECTION)

const defaultResumeProtectedStore = createProtectedVoiceAssetStore({
  storeId: MISTRAL_REQUEST_REFERENCE_STORE_ID,
  root: MISTRAL_REQUEST_REFERENCE_STORE_ROOT
})

export const protectedRecoveryOnlyTargets = new WeakSet<TtsTarget>()

type ReconstructionCandidate = Readonly<{
  options: TtsOptions
  target: TtsTarget
  speakerMappings?: string[] | undefined
}>

const matchesRetainedPlan = (
  retained:
    | { kind: 'branch', branchPlanId: string }
    | { kind: 'render', renderPlanId: string, renderIdentity: string }
    | undefined,
  planned: ReturnType<typeof planCurrentTtsRenderIdentity>
): boolean => retained?.kind === 'branch'
  ? retained.branchPlanId === planned.branchPlanId
  : retained?.kind === 'render'
    ? retained.renderPlanId === planned.renderPlanId && retained.renderIdentity === planned.renderIdentity
    : false

const collectStandaloneCandidates = (
  provider: GenerationResumeProviderIdentity,
  baseOptions: TtsOptions,
  asset: ProtectedAssetRef,
  protectedStore: ProtectedVoiceAssetStore
): ReconstructionCandidate[] => {
  const options = { ...baseOptions, ttsSpeakers: undefined }
  attachMistralProtectedReference(options, {
    materialization: 'materialized',
    protectedAsset: asset,
    sourceExtension: '',
    resolve: async () => await protectedStore.resolve(asset)
  })
  return collectTtsTargets(options)
    .filter((target) => target.targetKey === provider.targetKey)
    .map((target) => ({ options, target }))
}

const collectDialogueCandidates = (
  provider: GenerationResumeProviderIdentity,
  baseOptions: TtsOptions,
  voices: Awaited<ReturnType<typeof loadMistralResumeEvidence>>['voices'],
  turns: Array<{ originalSpeakerLabel: string }>,
  protectedStore: ProtectedVoiceAssetStore
): ReconstructionCandidate[] => {
  if (voices.length !== turns.length) return []
  const speakerVoice = new Map<string, { mapping: string, protectedAsset?: ProtectedAssetRef | undefined }>()
  for (const [index, voice] of voices.entries()) {
    const turn = turns[index]
    if (!turn) throw UsageError('Stored Mistral voice evidence does not align with the item dialogue turns.')
    const speakerKey = normalizeDialogueSpeakerKey(turn.originalSpeakerLabel)
    const reference = protectedReferenceVoice(voice)
    const mapping = reference
      ? `${turn.originalSpeakerLabel}=ref_audio:${reference.protectedAsset.assetId}`
      : voice.kind === 'remote-resource'
        ? `${turn.originalSpeakerLabel}=${voice.resourceId}`
        : undefined
    if (!mapping) throw UsageError('Stored Mistral dialogue voice kind cannot be reconstructed safely for resume.')
    const prior = speakerVoice.get(speakerKey)
    if (prior && prior.mapping.split('=').slice(1).join('=') !== mapping.split('=').slice(1).join('=')) {
      throw UsageError(`Stored Mistral speaker ${turn.originalSpeakerLabel} has conflicting retained voices.`)
    }
    speakerVoice.set(speakerKey, { mapping, ...(reference ? { protectedAsset: reference.protectedAsset } : {}) })
  }
  const speakerMappings = [...speakerVoice.values()].map((entry) => entry.mapping)
  const protectedEntries = [...speakerVoice.entries()].flatMap(([speakerKey, entry]) => (
    entry.protectedAsset ? [{ speakerKey, protectedAsset: entry.protectedAsset }] : []
  ))
  if (protectedEntries.length === 0) return []
  const candidates: ReconstructionCandidate[] = []
  for (const ttsDialogueFormat of ['labeled', 'screenplay'] as const) {
    const options = { ...baseOptions, ttsSpeakers: speakerMappings, ttsDialogueFormat }
    attachMistralProtectedSpeakerReferences(options, {
      materialization: 'non-materialized',
      entries: protectedEntries.map((entry) => ({ ...entry, sourceExtension: '' }))
    })
    promoteMistralProtectedSpeakerReferences(options, materializedSpeakerBinding(protectedEntries, protectedStore))
    try {
      for (const target of collectTtsTargets(options).filter((entry) => entry.targetKey === provider.targetKey)) {
        candidates.push({ options, target, speakerMappings })
      }
    } catch {
    }
  }
  return candidates
}

export const resolveStoredMistralTtsTargetsForResume = async (
  providers: GenerationResumeProviderIdentity[],
  opts: TtsOptions,
  target: ResumeTarget,
  item: PipelineManifestItem,
  input: string,
  protectedStore: ProtectedVoiceAssetStore = defaultResumeProtectedStore
): Promise<TtsTarget[]> => {
  if (providers.length === 0) return []
  const targetKeys = new Set(providers.flatMap((provider) => provider.targetKey ? [provider.targetKey] : []))
  const sourceContext = await resolveTtsResumeSourceContext(target.dir, input, item.providers, targetKeys)
  if (!sourceContext.dialoguePlan) throw UsageError('Stored generic TTS resume source is missing its dialogue plan.')
  const turns = sourceContext.dialoguePlan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)
  const resolved: TtsTarget[] = []
  for (const provider of providers) {
    if (!provider.targetKey) throw UsageError(`Stored Mistral TTS target ${provider.model} is missing its operation-scoped target identity.`)
    const state = item.providers.find((entry) => entry.targetKey === provider.targetKey)
    if (!state) throw UsageError(`Stored Mistral TTS target ${provider.model} has no canonical provider state.`)
    const evidence = await loadMistralResumeEvidence(target.dir, state, protectedStore)
    if (evidence.references.length === 0) {
      const options = { ...opts, mistralTtsModels: [provider.model] }
      resolved.push(...collectTtsTargets(options).filter((entry) => entry.targetKey === provider.targetKey))
      continue
    }
    const retained = sourceContext.retainedPlanIdentities.get(provider.targetKey)
    const baseOptions = clearProviderModelFields({ ...opts }, TTS_MODEL_FIELDS) as TtsOptions
    baseOptions.mistralTtsModels = [provider.model]
    baseOptions.mistralTtsVoice = undefined
    const candidates = evidence.uniqueAssets.length === 1 && evidence.references.length === evidence.voices.length
      ? collectStandaloneCandidates(provider, baseOptions, evidence.uniqueAssets[0] as ProtectedAssetRef, protectedStore)
      : []
    const findExact = (): ReconstructionCandidate | undefined => candidates.find((candidate) => {
      try {
        return matchesRetainedPlan(retained, planCurrentTtsRenderIdentity({
          target: candidate.target,
          sourceText: input,
          ttsOptions: candidate.options,
          sourceIdentity: sourceContext.sourceIdentity,
          dialoguePlan: sourceContext.dialoguePlan
        }))
      } catch {
        return false
      }
    })
    let exact = findExact()
    if (!exact) {
      candidates.push(...collectDialogueCandidates(provider, baseOptions, evidence.voices, turns, protectedStore))
      exact = findExact()
    }
    if (!exact) {
      throw UsageError('Stored protected Mistral voice bindings cannot reconstruct the exact retained branch/render semantics. Rebuild this output with standalone `tts`; resume will not rebind or repurchase reference synthesis.')
    }
    if (exact.speakerMappings) {
      opts.ttsSpeakers = exact.speakerMappings
      opts.ttsDialogueFormat = exact.options.ttsDialogueFormat
    }
    protectedRecoveryOnlyTargets.add(exact.target)
    resolved.push(exact.target)
  }
  return resolved
}
