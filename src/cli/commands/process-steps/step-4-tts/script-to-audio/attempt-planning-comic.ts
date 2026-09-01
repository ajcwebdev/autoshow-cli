import type { AttemptSlot, AttemptTurn, CreateCurrentTtsRenderAttemptOptions, PlannedInputs, ProviderRenderStrategy, ResolvedVoiceBinding, TtsTargetInvocation, TtsTargetSelection } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { createTtsTargetSelection } from '../tts-targets/tts-target-selection'
import { normalizeTtsTurnControls, resolveTtsTurnControlOverrides } from '../tts-targets/tts-invocation-controls'
import { planElevenLabsNativeDialogueBatches } from '../tts-services/tts-elevenlabs/elevenlabs-native-dialogue'
import { planHumeNativeUtteranceBatches } from '../tts-services/hume/hume-native-utterances'
import { canonicalTtsJson, hashCanonicalTtsValue, sha256Bytes } from './contract-identity'
import { segmentedSlotGroup } from './comic-segmented-audio'
import { buildProviderSerializerDescriptor, createProviderRequestSettings, createTypedProviderSettings, providerSerializerVoiceField, resolveEffectiveProviderControls } from './provider-serializer-registry'
import { flattenPlanTurns, plannedCost, sumCosts } from './attempt-planning-shared'

export const resolveComicTurns = (
  options: CreateCurrentTtsRenderAttemptOptions,
  context: NonNullable<CreateCurrentTtsRenderAttemptOptions['comicContext']>,
  canonicalTurns: ReturnType<typeof flattenPlanTurns>,
  normalizedTurnControls: ReturnType<typeof normalizeTtsTurnControls>,
  selection: TtsTargetSelection,
  entriesById: Map<string, (typeof context.voiceSnapshot.entries)[number]>
): AttemptTurn[] => {
  return canonicalTurns.map((canonical, sourceIndex) => {
    const entryId = context.snapshotEntryIdByTurnId[canonical.turnId]
    const entry = entryId ? entriesById.get(entryId) : undefined
    if (!entry || entry.provider !== options.target.service || entry.providerModel !== options.target.model || entry.subjectKey !== canonical.subjectKey) {
      throw UsageError(`Comic turn ${canonical.turnId} has no exact approved snapshot binding for ${options.target.service}/${options.target.model}.`)
    }
    const providerVoice = entry.providerVoice
    if (providerVoice.provider !== options.target.service) throw UsageError(`Comic snapshot voice for ${canonical.turnId} belongs to another provider.`)
    if (providerVoice.kind === 'shared-library-resource') throw UsageError(`Comic snapshot voice for ${canonical.turnId} must be imported into an account resource before synthesis.`)
    const protectedAsset = providerVoice.kind === 'reference-asset' ? providerVoice.protectedAsset : undefined
    const voice = providerVoice.kind === 'reference-asset'
      ? { kind: 'reference-asset' as const, valueHash: providerVoice.protectedAsset.sha256 }
      : providerVoice.kind === 'local-model-voice'
        ? { kind: 'local-model-voice' as const, value: providerVoice.voiceLocator, valueHash: sha256Bytes(providerVoice.voiceLocator) }
        : { kind: 'provider-id' as const, value: providerVoice.resourceId, valueHash: sha256Bytes(providerVoice.resourceId) }
    const invocation: TtsTargetInvocation = Object.freeze({
      sourceId: canonical.turnId,
      sourceIndex,
      speaker: context.providerSpeakerLabelByTurnId[canonical.turnId] ?? canonical.originalSpeakerLabel,
      voice: Object.freeze(providerVoice.kind === 'reference-asset'
        ? { kind: 'ref-audio' as const, value: `ref_audio:${providerVoice.protectedAsset.assetId}`, protectedAsset: providerVoice.protectedAsset, authorizationRef: providerVoice.authorizationRef }
        : { kind: 'id' as const, value: voice.value as string }),
      controls: resolveTtsTurnControlOverrides(options.target.service, canonical.turnId, normalizedTurnControls)
    })
    const effectiveControls = resolveEffectiveProviderControls(options.target, invocation, selection)
    const controls = createTypedProviderSettings(options.target, effectiveControls, protectedAsset)
    const binding: Extract<ResolvedVoiceBinding, { kind: 'approved-snapshot' }> = {
      kind: 'approved-snapshot',
      snapshotId: context.voiceSnapshot.snapshotId,
      entryId: entry.entryId,
      entryHash: entry.entryHash,
      providerVoice,
      providerModel: entry.providerModel,
      ...(entry.providerRevision ? { providerRevision: entry.providerRevision } : {}),
      settingsSchema: entry.settingsSchema,
      synthesisSettings: entry.synthesisSettings,
      capabilityFixtureHash: entry.capabilityFixtureHash,
    }
    return { sourceIndex, canonical, voice, binding, controls, effectiveControls }
  })
}

export const resolveComicNativeGroups = (
  context: NonNullable<CreateCurrentTtsRenderAttemptOptions['comicContext']>,
  turns: AttemptTurn[],
  elevenLabsNative: boolean,
  humeNative: boolean
): Array<{ turnIds: string[], providerTexts: string[] }> => {
  if (elevenLabsNative) {
    return planElevenLabsNativeDialogueBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: context.providerSpeakerLabelByTurnId[turn.canonical.turnId] ?? turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: turn.voice.value ?? turn.voice.valueHash }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  if (humeNative) {
    return planHumeNativeUtteranceBatches(turns.map(turn => ({ turnId: turn.canonical.turnId, subjectKey: turn.canonical.subjectKey, speaker: context.providerSpeakerLabelByTurnId[turn.canonical.turnId] ?? turn.canonical.originalSpeakerLabel, canonicalText: turn.canonical.canonicalText, voiceId: turn.voice.value ?? turn.voice.valueHash }))).map(batch => ({ turnIds: batch.turns.map(turn => turn.turnId), providerTexts: [batch.providerText] }))
  }
  return []
}

export const planComicInputs = (options: CreateCurrentTtsRenderAttemptOptions, _capabilityFixtureHash?: string): PlannedInputs => {
  const context = options.comicContext!
  if (context.operation !== 'comic-audio') throw UsageError('Comic render context requires operation comic-audio.')
  if (canonicalTtsJson(context.sourceIdentity) !== canonicalTtsJson(context.dialoguePlan.sourceIdentity)) throw UsageError('Comic dialogue plan does not bind the exact source identity.')
  if (context.dialoguePlan.dialoguePlanId !== hashCanonicalTtsValue({
    schemaVersion: context.dialoguePlan.schemaVersion,
    sceneRunIdentity: context.dialoguePlan.sceneRunIdentity,
    sourceIdentity: context.dialoguePlan.sourceIdentity,
    structuredScript: context.dialoguePlan.structuredScript,
    createdAt: context.dialoguePlan.createdAt,
    pacing: context.dialoguePlan.pacing,
    nodes: context.dialoguePlan.nodes,
  })) throw UsageError('Comic dialogue plan identity is invalid.')
  if (context.voiceSnapshot.dialoguePlanId !== context.dialoguePlan.dialoguePlanId || context.voiceSnapshot.sceneRunIdentity !== context.dialoguePlan.sceneRunIdentity) throw UsageError('Comic voice snapshot does not bind the selected scene/dialogue plan.')

  const canonicalTurns = flattenPlanTurns(context.dialoguePlan)
  const normalizedTurnControls = normalizeTtsTurnControls(
    options.ttsOptions.ttsTurnControls,
    canonicalTurns.map(turn => turn.turnId)
  )
  const selection = createTtsTargetSelection(options.ttsOptions)
  const entriesById = new Map(context.voiceSnapshot.entries.map(entry => [entry.entryId, entry] as const))
  const turns = resolveComicTurns(options, context, canonicalTurns, normalizedTurnControls, selection, entriesById)

  const normalizedText = canonicalTurns.map(turn => `${context.providerSpeakerLabelByTurnId[turn.turnId] ?? turn.originalSpeakerLabel}: ${turn.canonicalText}`).join('\n')
  const hasOverlapIntent = context.dialoguePlan.nodes.some(node => node.kind === 'overlap')
  const hasDeliveryOrEffect = canonicalTurns.some(turn => turn.delivery !== undefined || turn.effect !== undefined)
  const hasSegmentedOnlyIntent = hasOverlapIntent || hasDeliveryOrEffect
  const hasTurnControls = canonicalTurns.some(turn => {
    const keys = Object.keys(normalizedTurnControls?.[turn.turnId]?.[options.target.service] ?? {})
    return keys.length > 0 && !(options.target.service === 'hume' && keys.every(key => key === 'speed' || key === 'trailingSilence'))
  })
  const elevenLabsNative = options.target.service === 'elevenlabs' && options.target.model === 'eleven_v3' && !hasTurnControls
  const humeNative = options.target.service === 'hume' && options.target.model === 'octave-2' && !hasTurnControls && canonicalTurns.reduce((sum, turn) => sum + [...turn.canonicalText].length, 0) <= 5000
  const nativeEligible = canonicalTurns.length > 0 && !hasSegmentedOnlyIntent && (elevenLabsNative || humeNative)
  if (context.modePreference === 'native' && !nativeEligible) throw UsageError('Comic native mode requires a provider-native eligible target whose speaker, direction, control, and request limits can be represented exactly.')
  const native = context.modePreference !== 'segmented' && nativeEligible
  const strategy: ProviderRenderStrategy = native ? humeNative ? 'native-utterances' : 'native-dialogue' : 'segmented'
  const nativeGroups = native
    ? resolveComicNativeGroups(context, turns, elevenLabsNative, humeNative)
    : []
  const slotGroups: Array<{ turnIds: string[], providerTexts: string[], timingSegmentIndexes?: number[] | undefined }> = native
    ? nativeGroups
    : turns.map(turn => segmentedSlotGroup(turn, options.target))

  let includesSetup = true
  const slots: AttemptSlot[] = []
  const batches = slotGroups.map((group, batchIndex) => {
    const batchId = `batch-${String(batchIndex + 1).padStart(3, '0')}-${hashCanonicalTtsValue(group.turnIds).slice(0, 12)}`
    const primaryTurn = turns.find(turn => turn.canonical.turnId === group.turnIds[0]) as AttemptTurn
    const contract = buildProviderSerializerDescriptor(options.target, primaryTurn.voice.value ?? primaryTurn.voice.valueHash, primaryTurn.effectiveControls, strategy)
    const generationSlots = group.providerTexts.map((providerText, slotIndex) => {
      const cost = plannedCost(options.target, [...providerText].length, includesSetup)
      includesSetup = false
      const timingSegmentIndex = group.timingSegmentIndexes?.[slotIndex]
      const slot = { batchId, generationSlotId: `${batchId}-slot-${String(slotIndex + 1).padStart(3, '0')}`, slotIndex, turnIds: group.turnIds, providerText, plannedCost: cost, expectedRequestControlsHash: hashCanonicalTtsValue(contract.controls), expectedEndpointKind: contract.endpointKind, expectedSerializerVersion: contract.serializerVersion, expectedVoiceField: providerSerializerVoiceField(options.target, strategy, primaryTurn.voice.kind), ...(timingSegmentIndex !== undefined ? { timingSegmentIndex } : {}) }
      slots.push(slot)
      return { generationSlotId: slot.generationSlotId, slotIndex, requestedTakeCount: 1, plannedCost: cost }
    })
    const requestControls = createProviderRequestSettings(primaryTurn.controls)
    requestControls.values['serializerControlsHash'] = hashCanonicalTtsValue(contract.controls)
    return { batchId, orderedTurnIds: group.turnIds, requestControls, generationSlots, takeSelectionPolicy: 'sole-take' as const, continuation: { kind: 'none' as const }, plannedCost: sumCosts(generationSlots.map(slot => slot.plannedCost)) }
  })
  if (turns.length === 0 || slots.length === 0) throw UsageError('Comic render planning requires at least one dialogue turn and generation slot.')
  return { sourceIdentity: context.sourceIdentity, dialoguePlan: context.dialoguePlan, turns, batches, slots, strategy, normalizedText }
}
