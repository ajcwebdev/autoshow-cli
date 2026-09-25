import type { ResolvedTtsChunk, AttemptSlot, AttemptTurn, CreateCurrentTtsRenderAttemptOptions, PlannedInputs, ProviderRenderStrategy, TtsTargetInvocation, TtsTargetSelection } from '~/types'
import { geminiNativeEligible, planGeminiNativeGroups } from '../tts-services/tts-gemini/gemini-dialogue-plan'
import { UsageError } from '~/utils/error-handler'
import { planProviderTtsChunks } from '../tts-utils/tts-provider-chunk-policy'
import { getSpeakerVoice, isMultiSpeakerRequested, normalizeDialogueFromOptions, parseSpeakerVoiceMappings } from '../dialogue-normalizer'
import { planElevenLabsNativeDialogueBatches } from '../tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { createTtsTargetSelection } from '../tts-targets/tts-target-selection'
import { normalizeTtsTurnControls, resolveTtsTurnControlOverrides } from '../tts-targets/tts-invocation-controls'
import { createGenericTtsDialoguePlan, createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from './generic-dialogue-plan'
import { hashCanonicalTtsValue, sha256Bytes, canonicalTtsJson } from './contract-identity'
import { validateGenericTtsDialoguePlan, validateGenericTtsSourceIdentity } from './contract-validation'
import { EPOCH } from './attempt-shared'
import { chunkLimit, prepareSegmentedTurnText } from './comic-segmented-audio'
import { buildProviderSerializerDescriptor, createProviderRequestSettings, createTypedProviderSettings, providerSerializerVoiceField, resolveEffectiveProviderControls } from './provider-serializer-registry'
import { defaultVoiceValue, flattenPlanTurns, plannedCost, voiceBinding } from './attempt-planning-shared'

export const resolveGenericTurns = (
  options: CreateCurrentTtsRenderAttemptOptions,
  dialoguePlan: ReturnType<typeof createGenericTtsDialoguePlan>,
  capabilityFixtureHash: string,
  registry: ReturnType<typeof parseSpeakerVoiceMappings> | undefined,
  normalizedTurnControls: ReturnType<typeof normalizeTtsTurnControls>,
  selection: TtsTargetSelection
): AttemptTurn[] => {
  const canonicalTurns = flattenPlanTurns(dialoguePlan)
  return canonicalTurns.map((canonical, sourceIndex) => {
    const mapping = registry ? getSpeakerVoice(registry, canonical.originalSpeakerLabel) : undefined
    const value = mapping?.voice ?? options.target.voice?.trim() ?? defaultVoiceValue(options.target)
    const protectedAsset = mapping?.voiceKind === 'ref-audio'
      ? options.target.protectedSpeakerVoiceAssets?.[mapping.normalizedSpeaker]
      : !mapping
        ? options.target.protectedVoiceAsset
        : undefined
    if (mapping?.voiceKind === 'ref-audio' || options.target.protectedVoiceAsset) {
      throw UsageError('Reference audio TTS invocation is no longer supported.')
    }
    const kind = 'provider-id'
    const invocation: TtsTargetInvocation = Object.freeze({
      sourceId: canonical.turnId,
      sourceIndex,
      speaker: canonical.originalSpeakerLabel,
      voice: Object.freeze({ kind: 'id' as const, value }),
      controls: resolveTtsTurnControlOverrides(options.target.service, canonical.turnId, normalizedTurnControls)
    })
    const effectiveControls = resolveEffectiveProviderControls(options.target, invocation, options.target.service === 'gemini' && canonical.delivery ? { ...selection, geminiInstructions: canonical.delivery.description } : selection)
    const settings = createTypedProviderSettings(options.target, effectiveControls, protectedAsset)
    const bound = voiceBinding(options.target, kind, value, settings, capabilityFixtureHash, protectedAsset)
    return { sourceIndex, canonical, ...bound, controls: settings, effectiveControls }
  })
}

export const resolveGenericNativeGroups = (
  turns: AttemptTurn[],
  registry: ReturnType<typeof parseSpeakerVoiceMappings>,
  elevenLabsNative: boolean
): Array<{ turnIds: string[], providerTexts: string[] }> => {
  if (elevenLabsNative) {
    return planElevenLabsNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  return []
}

export const planGenericInputs = (options: CreateCurrentTtsRenderAttemptOptions, capabilityFixtureHash: string): PlannedInputs => {
  const fallbackSource = createInlineTtsSourceIdentity(options.sourceText)
  const sourceIdentity = options.sourceIdentity ?? fallbackSource
  if (sourceIdentity.sourceKind === 'inline' && sourceIdentity.contentSha256 !== sha256Bytes(options.sourceText)) {
    throw UsageError('Generic inline TTS source identity does not match the exact selected source bytes.')
  }
  validateGenericTtsSourceIdentity(sourceIdentity)
  const expectedPlan = isMultiSpeakerRequested(options.ttsOptions)
    ? createGenericTtsDialoguePlan(sourceIdentity, options.sourceText, options.ttsOptions, EPOCH)
    : createSingleTurnTtsDialoguePlan(sourceIdentity, options.sourceText, EPOCH)
  const dialoguePlan = options.dialoguePlan ?? expectedPlan
  validateGenericTtsDialoguePlan(dialoguePlan)
  if (canonicalTtsJson(dialoguePlan.sourceIdentity) !== canonicalTtsJson(sourceIdentity)) throw UsageError('Generic TTS dialogue plan does not bind the exact supplied source identity.')
  if (canonicalTtsJson(dialoguePlan.nodes) !== canonicalTtsJson(expectedPlan.nodes)) throw UsageError('Generic TTS dialogue plan does not exactly match normalized turn IDs, source indexes, speakers, text, delivery, and effects.')

  const registry = isMultiSpeakerRequested(options.ttsOptions) ? parseSpeakerVoiceMappings(options.ttsOptions.ttsSpeakers) : undefined
  const canonicalTurns = flattenPlanTurns(dialoguePlan)
  const normalizedTurnControls = normalizeTtsTurnControls(
    options.ttsOptions.ttsTurnControls,
    canonicalTurns.map((turn) => turn.turnId)
  )
  const hasProviderTurnControls = canonicalTurns.some((turn) => {
    const keys = Object.keys(normalizedTurnControls?.[turn.turnId]?.[options.target.service] ?? {})
    return keys.length > 0
  })
  const selection = createTtsTargetSelection(options.ttsOptions)
  const turns = resolveGenericTurns(options, dialoguePlan, capabilityFixtureHash, registry, normalizedTurnControls, selection)

  const normalizedDialogue = registry ? normalizeDialogueFromOptions(options.sourceText, options.ttsOptions) : undefined
  const hasNativeBlockingIntent = canonicalTurns.some(turn => turn.delivery !== undefined || turn.effect !== undefined)
  const elevenLabsNative = options.target.service === 'elevenlabs' && options.target.model === 'eleven_v3' && registry !== undefined && !hasProviderTurnControls && !hasNativeBlockingIntent
  const geminiNative = options.target.service === 'gemini' && registry !== undefined && geminiNativeEligible(options.target.model, turns, options.target.transport === 'gemini-stream' ? 'pcm' : 'wav')
  const native = elevenLabsNative || geminiNative
  const strategy: ProviderRenderStrategy = native ? 'native-dialogue' : 'segmented'
  const limit = chunkLimit(options.target)

  const nativeGroups = geminiNative ? planGeminiNativeGroups(options.target.model, turns) : native && registry
    ? resolveGenericNativeGroups(turns, registry, elevenLabsNative)
    : []
  const slotGroups: Array<{ turnIds: string[], providerTexts: string[], chunks?: ResolvedTtsChunk[] }> = native
    ? nativeGroups
    : turns.map((turn) => {
      const chunks = planProviderTtsChunks({ provider: options.target.service, model: options.target.model,
        text: prepareSegmentedTurnText(turn.canonical.canonicalText, options.target, turn.canonical.delivery?.description).providerText,
        voice: turn.voice.value, speaker: turn.canonical.originalSpeakerLabel,
        style: turn.effectiveControls['instructions'] as string | undefined,
        characterLimit: limit, chunking: options.ttsOptions.ttsChunking })
      return { turnIds: [turn.canonical.turnId], providerTexts: chunks.map(chunk => chunk.text), chunks }
    })

  let includesSetup = true
  const slots: AttemptSlot[] = []
  const batches = slotGroups.map((group, batchIndex) => {
    const batchId = `batch-${String(batchIndex + 1).padStart(3, '0')}-${hashCanonicalTtsValue(group.turnIds).slice(0, 12)}`
    const primaryTurn = turns.find((turn) => turn.canonical.turnId === group.turnIds[0]) as AttemptTurn
    const primaryVoiceValue = primaryTurn.voice.value ?? primaryTurn.voice.valueHash
    const contract = buildProviderSerializerDescriptor(options.target, primaryVoiceValue, primaryTurn.effectiveControls, strategy)
    const generationSlots = group.providerTexts.map((providerText, slotIndex) => {
      const cost = plannedCost(options.target, [...providerText].length, includesSetup, (primaryTurn.effectiveControls['speed'] as number | undefined) ?? (options.target.service === 'soniox' ? 1 : undefined))
      includesSetup = false
      const slot = { batchId, generationSlotId: `${batchId}-slot-${String(slotIndex + 1).padStart(3, '0')}`, slotIndex, turnIds: group.turnIds, providerText, chunk: group.chunks?.[slotIndex], plannedCost: cost, expectedRequestControlsHash: hashCanonicalTtsValue(contract.controls), expectedEndpointKind: contract.endpointKind, expectedSerializerVersion: contract.serializerVersion, expectedVoiceField: providerSerializerVoiceField(options.target, strategy, primaryTurn.voice.kind) }
      slots.push(slot)
      return { generationSlotId: slot.generationSlotId, slotIndex, requestedTakeCount: 1, plannedCost: cost }
    })
    const controls = createProviderRequestSettings(primaryTurn.controls)
    controls.values['serializerControlsHash'] = hashCanonicalTtsValue(contract.controls)
    const amountByCurrency = new Map<string, number>()
    for (const slot of generationSlots) for (const amount of slot.plannedCost.amounts) amountByCurrency.set(amount.currency, (amountByCurrency.get(amount.currency) ?? 0) + amount.amount)
    return { batchId, orderedTurnIds: group.turnIds, requestControls: controls, generationSlots, takeSelectionPolicy: 'sole-take' as const, continuation: { kind: 'none' as const }, plannedCost: { amounts: [...amountByCurrency].map(([currency, amount]) => ({ currency, amount })) } }
  })
  if (turns.length === 0 || slots.length === 0) throw UsageError('TTS render planning requires at least one normalized turn and generation slot.')
  return { sourceIdentity, dialoguePlan, turns, batches, slots, strategy, normalizedText: normalizedDialogue?.normalizedText ?? options.sourceText }
}
