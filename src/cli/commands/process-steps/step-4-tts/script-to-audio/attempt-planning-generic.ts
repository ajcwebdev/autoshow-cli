import type { AttemptSlot, AttemptTurn, CreateCurrentTtsRenderAttemptOptions, PlannedInputs, ProviderRenderStrategy, TtsTargetInvocation, TtsTargetSelection } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { splitTextIntoChunks } from '../tts-utils/audio-utils'
import { TTS_CHUNK_CHARACTER_LIMITS } from '../tts-utils/tts-chunking'
import { getSpeakerVoice, isMultiSpeakerRequested, normalizeDialogueFromOptions, normalizeDialogueText, parseSpeakerVoiceMappings, resolveDialogueFormat } from '../dialogue-normalizer'
import { resolveGeminiDialogueStrategyForText, splitGeminiNativeDialogueText } from '../tts-services/tts-gemini/gemini-tts-config'
import { planElevenLabsNativeDialogueBatches } from '../tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { planHumeNativeUtteranceBatches } from '../tts-services/hume/hume-native-utterances'
import { isFishNativeDialogueModel, planFishNativeDialogueBatches } from '../tts-services/fish/fish-tts-request'
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
    if (
      mapping?.voiceKind === 'ref-audio'
      && (!protectedAsset || mapping.voice !== `ref_audio:${protectedAsset.assetId}`)
    ) {
      throw UsageError(`Reference-audio speaker ${mapping.speaker} does not bind its exact protected asset before render planning.`)
    }
    const kind = mapping?.voiceKind === 'ref-audio' || (!mapping && options.target.protectedVoiceAsset)
      ? 'reference-asset'
      : 'provider-id'
    const invocation: TtsTargetInvocation = Object.freeze({
      sourceId: canonical.turnId,
      sourceIndex,
      speaker: canonical.originalSpeakerLabel,
      voice: Object.freeze(mapping?.voiceKind === 'ref-audio'
        ? {
            kind: 'ref-audio' as const,
            value,
            ...(protectedAsset ? { protectedAsset, authorizationRef: 'explicit-cli:mistral-request-reference-v1' } : {})
          }
        : { kind: 'id' as const, value }),
      controls: resolveTtsTurnControlOverrides(options.target.service, canonical.turnId, normalizedTurnControls)
    })
    const effectiveControls = resolveEffectiveProviderControls(options.target, invocation, selection)
    const settings = createTypedProviderSettings(options.target, effectiveControls, protectedAsset)
    const bound = voiceBinding(options.target, kind, value, settings, capabilityFixtureHash, protectedAsset)
    return { sourceIndex, canonical, ...bound, controls: settings, effectiveControls }
  })
}

export const resolveGenericNativeGroups = (
  options: CreateCurrentTtsRenderAttemptOptions,
  turns: AttemptTurn[],
  registry: ReturnType<typeof parseSpeakerVoiceMappings>,
  limit: number,
  geminiNative: boolean,
  elevenLabsNative: boolean,
  humeNative: boolean,
  fishNative: boolean,
  normalizedDialogue: ReturnType<typeof normalizeDialogueFromOptions> | undefined
): Array<{ turnIds: string[], providerTexts: string[] }> => {
  if (geminiNative) {
    let nativeTurnCursor = 0
    const groups = splitGeminiNativeDialogueText(normalizedDialogue?.normalizedText ?? '', registry, limit).map((providerText) => {
      const chunkDialogue = normalizeDialogueText(providerText, resolveDialogueFormat(options.ttsOptions), registry)
      const groupedTurns = turns.slice(nativeTurnCursor, nativeTurnCursor + chunkDialogue.turns.length)
      if (
        groupedTurns.length !== chunkDialogue.turns.length
        || groupedTurns.some((turn, index) => turn.canonical.canonicalText !== chunkDialogue.turns[index]?.text || turn.canonical.subjectKey !== chunkDialogue.turns[index]?.speaker)
      ) throw UsageError('Gemini native dialogue partition did not preserve exact normalized turn boundaries.')
      nativeTurnCursor += groupedTurns.length
      return { turnIds: groupedTurns.map((turn) => turn.canonical.turnId), providerTexts: [providerText] }
    })
    if (nativeTurnCursor !== turns.length) throw UsageError('Gemini native dialogue partition omitted normalized turns.')
    return groups
  }
  if (elevenLabsNative) {
    return planElevenLabsNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  if (humeNative) {
    return planHumeNativeUtteranceBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  if (fishNative) {
    return planFishNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: getSpeakerVoice(registry, turn.canonical.originalSpeakerLabel).voice, delivery: turn.canonical.delivery?.description }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
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
    return keys.length > 0 && !(options.target.service === 'hume' && keys.every(key => key === 'speed' || key === 'trailingSilence'))
  })
  const selection = createTtsTargetSelection(options.ttsOptions)
  const turns = resolveGenericTurns(options, dialoguePlan, capabilityFixtureHash, registry, normalizedTurnControls, selection)

  const normalizedDialogue = registry ? normalizeDialogueFromOptions(options.sourceText, options.ttsOptions) : undefined
  const hasNativeBlockingIntent = canonicalTurns.some(turn => turn.delivery !== undefined || turn.effect !== undefined)
  const geminiNative = options.target.service === 'gemini' && registry
    ? !hasProviderTurnControls && !hasNativeBlockingIntent && resolveGeminiDialogueStrategyForText(normalizedDialogue?.normalizedText ?? '', registry, TTS_CHUNK_CHARACTER_LIMITS.gemini, 'auto') === 'native'
    : false
  const elevenLabsNative = options.target.service === 'elevenlabs' && options.target.model === 'eleven_v3' && registry !== undefined && !hasProviderTurnControls && !hasNativeBlockingIntent
  const humeNative = options.target.service === 'hume' && options.target.model === 'octave-2' && registry !== undefined && !hasProviderTurnControls && !hasNativeBlockingIntent && canonicalTurns.reduce((sum, turn) => sum + [...turn.canonicalText].length, 0) <= 5000
  const fishNative = options.target.service === 'fish' && isFishNativeDialogueModel(options.target.model) && registry !== undefined && !hasProviderTurnControls
  const native = geminiNative || elevenLabsNative || humeNative || fishNative
  const strategy: ProviderRenderStrategy = native ? humeNative ? 'native-utterances' : 'native-dialogue' : 'segmented'
  const limit = chunkLimit(options.target)

  const nativeGroups = native && registry
    ? resolveGenericNativeGroups(options, turns, registry, limit, geminiNative, elevenLabsNative, humeNative, fishNative, normalizedDialogue)
    : []
  const slotGroups: Array<{ turnIds: string[], providerTexts: string[] }> = native
    ? nativeGroups
    : turns.map((turn) => ({ turnIds: [turn.canonical.turnId], providerTexts: splitTextIntoChunks(prepareSegmentedTurnText(turn.canonical.canonicalText, options.target, turn.canonical.delivery?.description).providerText, limit) }))

  let includesSetup = true
  const slots: AttemptSlot[] = []
  const batches = slotGroups.map((group, batchIndex) => {
    const batchId = `batch-${String(batchIndex + 1).padStart(3, '0')}-${hashCanonicalTtsValue(group.turnIds).slice(0, 12)}`
    const primaryTurn = turns.find((turn) => turn.canonical.turnId === group.turnIds[0]) as AttemptTurn
    const primaryVoiceValue = primaryTurn.voice.value ?? primaryTurn.voice.valueHash
    const contract = buildProviderSerializerDescriptor(options.target, primaryVoiceValue, primaryTurn.effectiveControls, strategy)
    const generationSlots = group.providerTexts.map((providerText, slotIndex) => {
      const cost = plannedCost(options.target, [...providerText].length, includesSetup)
      includesSetup = false
      const slot = { batchId, generationSlotId: `${batchId}-slot-${String(slotIndex + 1).padStart(3, '0')}`, slotIndex, turnIds: group.turnIds, providerText, plannedCost: cost, expectedRequestControlsHash: hashCanonicalTtsValue(contract.controls), expectedEndpointKind: contract.endpointKind, expectedSerializerVersion: contract.serializerVersion, expectedVoiceField: providerSerializerVoiceField(options.target, strategy, primaryTurn.voice.kind) }
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
