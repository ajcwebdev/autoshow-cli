import type { MistralProtectedReferenceBinding, MistralProtectedSpeakerReferenceBinding, MistralTtsModel, TtsTarget, TtsTargetSelection } from '~/types'
import { validateMistralTtsModel } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import { runMistralTts } from './run-mistral-tts'
import { UsageError, InternalError } from '~/utils/error-handler'
import { resolveTtsTargetInvocationVoice } from '../../tts-targets/multi-speaker-capability'
import { normalizeDialogueSpeakerKey } from '../../dialogue-normalizer'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '../../voice-assets/mistral-request-reference-policy'
import { resolveTtsTargetInvocationControls } from '../../tts-targets/tts-invocation-controls'

const MISTRAL_PRICE_PLANNING_VOICE = 'price-planning-placeholder'

export const collectMistralTtsTargets = (
  selection: TtsTargetSelection,
  protectedReference?: MistralProtectedReferenceBinding | undefined,
  protectedSpeakerReferences?: MistralProtectedSpeakerReferenceBinding | undefined,
  context: {
    pricePlanning?: boolean | undefined
    skipMissingVoice?: boolean | undefined
  } = {}
): TtsTarget[] => {
  const targets: TtsTarget[] = []
  for (const rawModel of selection.mistralModels) {
    const model: MistralTtsModel = validateMistralTtsModel(rawModel)
    const voiceId = selection.mistralVoiceId
    const pricePlanningOnly = context.pricePlanning === true
      && !voiceId
      && !protectedReference
      && !protectedSpeakerReferences
      && !selection.multiSpeakerRequested
    if (voiceId && (protectedReference || protectedSpeakerReferences)) {
      throw UsageError('Mistral TTS requires exactly one voice source. Use either --mistral-tts-voice or --mistral-tts-ref-audio, not both.')
    }
    if (protectedReference && protectedSpeakerReferences) {
      throw UsageError('Standalone Mistral reference audio cannot be combined with per-speaker dialogue references.')
    }
    if (!voiceId && !protectedReference && !selection.multiSpeakerRequested && context.skipMissingVoice === true && !pricePlanningOnly) {
      continue
    }
    if (!voiceId && !protectedReference && !selection.multiSpeakerRequested && !pricePlanningOnly) {
      throw UsageError(
        'Mistral TTS synthesis requires an existing voice ID or an explicitly authorized unnamed request reference.',
        'Pass --mistral-tts-voice with an existing voice, or use standalone --mistral-tts-ref-audio so the reference crosses protected ingestion before target collection.'
      )
    }

    const speakerReferenceByKey = new Map(protectedSpeakerReferences?.entries.map((entry) => [entry.speakerKey, entry]) ?? [])
    const protectedSpeakerVoiceAssets = Object.freeze(Object.fromEntries(
      [...speakerReferenceByKey].map(([speakerKey, entry]) => [speakerKey, entry.protectedAsset])
    ))

    targets.push({
      service: 'mistral',
      model,
      ...(protectedReference ? { protectedVoiceAsset: protectedReference.protectedAsset } : {}),
      ...(speakerReferenceByKey.size > 0 ? { protectedSpeakerVoiceAssets } : {}),
      ...(voiceId
        ? { voice: voiceId }
        : protectedReference
          ? { voice: `ref_audio:${protectedReference.protectedAsset.assetId}` }
          : pricePlanningOnly
            ? { voice: MISTRAL_PRICE_PLANNING_VOICE }
          : {}),
      run: async (text, outputDir, opts, invocation, requestEvidence) => {
        if (pricePlanningOnly) {
          throw InternalError('A price-only Mistral TTS planning target cannot execute synthesis.', { stage: 'tts:mistral' })
        }
        const invocationVoice = resolveTtsTargetInvocationVoice('mistral', invocation)
        const controls = resolveTtsTargetInvocationControls('mistral', invocation, {
          responseFormat: 'wav',
        })
        const speakerReference = invocationVoice?.kind === 'ref-audio'
          ? speakerReferenceByKey.get(normalizeDialogueSpeakerKey(invocation?.speaker ?? ''))
          : undefined
        const invocationAsset = invocationVoice?.kind === 'ref-audio' ? invocationVoice.protectedAsset : undefined
        if (invocationVoice?.kind === 'ref-audio' && (
          !speakerReference
          || invocationVoice.value !== `ref_audio:${speakerReference.protectedAsset.assetId}`
          || invocationVoice.authorizationRef !== MISTRAL_CLI_REFERENCE_AUTHORIZATION
          || invocationAsset?.storeId !== speakerReference.protectedAsset.storeId
          || invocationAsset?.assetId !== speakerReference.protectedAsset.assetId
          || invocationAsset?.sha256 !== speakerReference.protectedAsset.sha256
        )) {
          throw UsageError(
            'Mistral dialogue reference invocation does not bind its exact protected speaker asset.',
            'Pass each SPEAKER=path mapping explicitly to standalone `tts`; raw paths and copied invocation identities are rejected.'
          )
        }
        const resolvedVoiceId = invocationVoice?.kind === 'id' ? invocationVoice.value : voiceId
        let protectedRefAudioPath: string | undefined
        let activeProtectedReference: { protectedAsset: { assetId: string }, sourceExtension: string } | undefined
        if (invocationVoice?.kind === 'ref-audio') {
          const materializedSpeakerReference = protectedSpeakerReferences?.materialization === 'materialized'
            ? protectedSpeakerReferences.entries.find((entry) => entry.speakerKey === normalizeDialogueSpeakerKey(invocation?.speaker ?? ''))
            : undefined
          if (!materializedSpeakerReference) {
            throw InternalError('A non-materialized Mistral speaker reference plan cannot execute synthesis.', { stage: 'tts:mistral' })
          }
          protectedRefAudioPath = await materializedSpeakerReference.resolve()
          activeProtectedReference = materializedSpeakerReference
        } else if (!invocationVoice && protectedReference) {
          if (protectedReference.materialization !== 'materialized') {
            throw InternalError('A non-materialized Mistral reference plan cannot execute synthesis.', { stage: 'tts:mistral' })
          }
          protectedRefAudioPath = await protectedReference.resolve()
          activeProtectedReference = protectedReference
        }
        return await runMistralTts(text, outputDir, {
          model,
          voiceId: resolvedVoiceId,
          refAudioPath: protectedRefAudioPath,
          responseFormat: controls.responseFormat,
          ...(activeProtectedReference ? {
            protectedReference: {
              assetId: activeProtectedReference.protectedAsset.assetId,
              sourceExtension: activeProtectedReference.sourceExtension
            }
          } : {}),
          chunkConcurrency: opts.ttsChunkConcurrency,
          chunkScheduler: opts.hostedTtsChunkScheduler,
          abortSignal: invocation?.signal,
          requestEvidence
        })
      }
    })
  }
  return targets
}
