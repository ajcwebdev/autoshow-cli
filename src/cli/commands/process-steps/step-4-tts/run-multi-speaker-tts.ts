import { rename } from 'node:fs/promises'
import type {
  CurrentTtsObservedTurn,
  MultiSpeakerRunMetadata,
  ProtectedAssetRef,
  Step4Metadata,
  TtsOptions,
  TtsRequestEvidenceScope,
  TtsTarget,
  TtsTargetInvocation,
} from '~/types'
import { ensureDirectory } from '~/utils/cli-utils'
import { runDialogueWorkSelector } from './dialogue-work-selector'
import { concatAndConvertToWav } from './tts-utils/audio-utils'
import { finalizeTtsRun } from './tts-utils/finalize-tts-run'
import { bindHostedTtsChunkScheduler, normalizeHostedTtsChunkConcurrency } from './tts-utils/hosted-tts-chunk-scheduler'
import { TTS_CHUNK_CHARACTER_LIMITS } from './tts-utils/tts-chunking'
import { resolveGeminiDialogueStrategyForText } from './tts-services/tts-gemini/gemini-tts-config'
import { sha256Bytes } from './script-to-audio/contract-identity'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from './voice-assets/mistral-request-reference-policy'
import {
  normalizeDialogueText,
  parseSpeakerVoiceMappings,
  resolveDialogueFormat,
  formatSpeakerVoiceSummary,
  getSpeakerVoice,
} from './dialogue-normalizer'
import {
  normalizeTtsTurnControls,
  resolveTtsTurnControlOverrides,
} from './tts-targets/tts-invocation-controls'

const sanitizeSegmentName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'speaker'

const cloneProtectedAssetRef = (asset: ProtectedAssetRef): Readonly<ProtectedAssetRef> => Object.freeze({
  storeId: asset.storeId,
  assetId: asset.assetId,
  sha256: asset.sha256
})

const buildObservedVoice = (
  target: TtsTarget,
  kind: 'id' | 'ref-audio',
  value: string,
  normalizedSpeaker?: string | undefined
): CurrentTtsObservedTurn['voice'] => kind === 'ref-audio'
  ? (() => {
      const protectedAsset = (normalizedSpeaker ? target.protectedSpeakerVoiceAssets?.[normalizedSpeaker] : undefined)
        ?? target.protectedVoiceAsset
      return {
      kind: 'reference-asset',
      valueHash: protectedAsset?.sha256 ?? sha256Bytes(value),
      ...(protectedAsset
        ? { protectedAsset: cloneProtectedAssetRef(protectedAsset), authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION }
        : {})
      }
    })()
  : {
      kind: 'provider-id',
      value,
      valueHash: sha256Bytes(value)
    }

export const runMultiSpeakerTts = async (
  text: string,
  outputDir: string,
  target: TtsTarget,
  options: TtsOptions,
  requestEvidence?: TtsRequestEvidenceScope | undefined
): Promise<{ audioPath: string, metadata: Step4Metadata }> => {
  const registry = parseSpeakerVoiceMappings(options.ttsSpeakers)
  const format = resolveDialogueFormat(options)
  const dialogue = options.ttsCanonicalTurns
    ? {
        turns: options.ttsCanonicalTurns.map(turn => ({ speaker: turn.speaker, text: turn.text, providerSegments: turn.providerSegments, providerSegmentIndexes: turn.providerSegmentIndexes })),
        normalizedText: options.ttsCanonicalTurns.map(turn => `${turn.speaker}: ${turn.text}`).join('\n'),
        spokenCharacterCount: options.ttsCanonicalTurns.reduce((sum, turn) => sum + [...turn.text].length, 0),
      }
    : normalizeDialogueText(text, format, registry)
  const turnIds = options.ttsCanonicalTurns
    ? options.ttsCanonicalTurns.map(turn => turn.turnId)
    : dialogue.turns.map((_turn, sourceIndex) => `dialogue-turn-${String(sourceIndex + 1).padStart(3, '0')}`)
  const turnControls = normalizeTtsTurnControls(options.ttsTurnControls, turnIds)
  const hasProviderTurnControls = turnIds.some(sourceId => {
    const keys = Object.keys(turnControls?.[sourceId]?.[target.service] ?? {})
    return keys.length > 0 && !(target.service === 'hume' && keys.every(key => key === 'speed' || key === 'trailingSilence'))
  })
  const normalizedPath = `${outputDir}/dialogue-normalized.txt`
  await Bun.write(normalizedPath, `${dialogue.normalizedText}\n`)

  const strategy = target.service === 'gemini'
    ? hasProviderTurnControls
      ? 'segmented'
      : resolveGeminiDialogueStrategyForText(
        dialogue.normalizedText,
        registry,
        TTS_CHUNK_CHARACTER_LIMITS.gemini,
        'auto'
      )
    : target.multiSpeakerStrategy ?? 'segment-and-concat'
  if (strategy === 'native') {
    const result = await target.run(dialogue.normalizedText, outputDir, options, undefined, requestEvidence)
    return {
      ...result,
      metadata: {
        ...result.metadata,
        _ttsObservedTurns: dialogue.turns.map((turn, sourceIndex) => {
          const mapping = getSpeakerVoice(registry, turn.speaker)
          return {
            turnId: turnIds[sourceIndex] as string,
            sourceIndex,
            speaker: turn.speaker,
            text: turn.text,
            voice: buildObservedVoice(target, mapping.voiceKind, mapping.voice, mapping.normalizedSpeaker),
            outputPath: result.audioPath
          }
        }),
        _ttsRenderStrategy: target.service === 'hume' ? 'native-utterances' : 'native-dialogue'
      } as MultiSpeakerRunMetadata
    }
  }

  const startTime = Date.now()
  const segmentsDir = `${outputDir}/segments`
  await ensureDirectory(segmentsDir)

  const runSegment = async (
    i: number,
    workspaceDir: string,
    signal: AbortSignal
  ): Promise<{ path: string, turn: CurrentTtsObservedTurn }> => {
    const turn = dialogue.turns[i] as { speaker: string, text: string, providerSegments?: readonly string[] | undefined, providerSegmentIndexes?: readonly number[] | undefined }
    const speakerMapping = getSpeakerVoice(registry, turn.speaker)
    const index = String(i + 1).padStart(3, '0')
    const segmentFileName = `segment-${index}-${sanitizeSegmentName(turn.speaker)}.wav`
    const segmentPath = `${segmentsDir}/${segmentFileName}`

    const protectedAsset = speakerMapping.voiceKind === 'ref-audio'
      ? target.protectedSpeakerVoiceAssets?.[speakerMapping.normalizedSpeaker] ?? target.protectedVoiceAsset
      : undefined
    const invocationProtectedAsset = protectedAsset ? cloneProtectedAssetRef(protectedAsset) : undefined
    const baseInvocation: TtsTargetInvocation = Object.freeze({
      sourceId: turnIds[i] as string,
      sourceIndex: i,
      speaker: turn.speaker,
      voice: Object.freeze({
        kind: speakerMapping.voiceKind,
        value: speakerMapping.voice,
        ...(invocationProtectedAsset
          ? { protectedAsset: invocationProtectedAsset, authorizationRef: MISTRAL_CLI_REFERENCE_AUTHORIZATION }
          : {})
      }),
      controls: resolveTtsTurnControlOverrides(target.service, turnIds[i] as string, turnControls),
      signal
    })
    const providerSegments = turn.providerSegments?.length ? [...turn.providerSegments] : [turn.text]
    const providerSegmentIndexes = turn.providerSegmentIndexes?.length
      ? [...turn.providerSegmentIndexes]
      : providerSegments.map((_segment, providerSegmentIndex) => providerSegmentIndex)
    if (providerSegmentIndexes.length !== providerSegments.length) throw new Error('Canonical TTS provider segment indexes do not match the selected provider segments.')
    const providerSegmentPaths: string[] = []
    let observedSpeaker: string | undefined
    for (const [selectedSegmentIndex, providerText] of providerSegments.entries()) {
      const providerSegmentIndex = providerSegmentIndexes[selectedSegmentIndex] as number
      const invocation: TtsTargetInvocation = Object.freeze({ ...baseInvocation, providerSegmentIndex })
      const invocationEvidence = requestEvidence?.forInvocation?.(invocation) ?? requestEvidence
      const recovered = await invocationEvidence?.recoverCompletedOutputs?.()
      const providerSegmentWorkspace = `${workspaceDir}/provider-segment-${String(providerSegmentIndex + 1).padStart(3, '0')}`
      await ensureDirectory(providerSegmentWorkspace)
      if (recovered) {
        signal.throwIfAborted()
        providerSegmentPaths.push(await concatAndConvertToWav(
          [...recovered.paths],
          providerSegmentWorkspace,
          `${target.service}-recovered-provider-segment-${String(providerSegmentIndex + 1).padStart(3, '0')}`,
          signal,
          options.ttsMasteringProfile
        ))
      } else {
        signal.throwIfAborted()
        const baseJob = options.hostedTtsChunkJobContext
        const segmentJob = {
          ...baseJob,
          jobId: `${baseJob?.jobId ?? `tts-${target.service}`}-turn-${i}-segment-${providerSegmentIndex}`,
          turnIndex: i,
          segmentIndex: providerSegmentIndex,
          originalOrder: (baseJob?.originalOrder ?? 0) + i / 1_000 + providerSegmentIndex / 1_000_000
        }
        const segmentOptions: TtsOptions = options.hostedTtsChunkScheduler
          ? {
              ...options,
              hostedTtsChunkJobContext: segmentJob,
              hostedTtsChunkScheduler: bindHostedTtsChunkScheduler(
                options.hostedTtsChunkScheduler,
                { job: segmentJob, scopeLabel: options.hostedTtsLaneScopeLabel }
              )
            }
          : options
        const result = await target.run(providerText, providerSegmentWorkspace, segmentOptions, invocation, invocationEvidence)
        providerSegmentPaths.push(result.audioPath)
        observedSpeaker = result.metadata.speaker?.trim() ?? observedSpeaker
      }
    }
    const turnAudioPath = await concatAndConvertToWav(
      providerSegmentPaths,
      workspaceDir,
      `${target.service}-turn-${index}`,
      signal,
      options.ttsMasteringProfile
    )
    await rename(turnAudioPath, segmentPath)
    const observedVoice = speakerMapping.voiceKind === 'id' && observedSpeaker
      ? observedSpeaker
      : speakerMapping.voice
    return {
      path: segmentPath,
      turn: {
        turnId: baseInvocation.sourceId,
        sourceIndex: i,
        speaker: turn.speaker,
        text: turn.text,
        voice: buildObservedVoice(target, speakerMapping.voiceKind, observedVoice, speakerMapping.normalizedSpeaker),
        outputPath: segmentPath
      }
    }
  }

  const concurrency = normalizeHostedTtsChunkConcurrency(options.ttsChunkConcurrency)
  const segmentResults = await runDialogueWorkSelector({
    concurrency,
    workspaceRoot: segmentsDir,
    work: dialogue.turns.map((turn, index) => ({
      workspaceName: `.work-${String(index + 1).padStart(3, '0')}-${sanitizeSegmentName(turn.speaker)}`,
      run: async (workspaceDir, signal) => await runSegment(index, workspaceDir, signal)
    }))
  })

  const segmentPaths = segmentResults.map((result) => result.path)
  const audioPath = await concatAndConvertToWav(segmentPaths, outputDir, target.service, undefined, options.ttsMasteringProfile)
  const result = finalizeTtsRun({
    service: target.service,
    model: target.model,
    speaker: formatSpeakerVoiceSummary(registry),
    audioPath,
    chunkCount: dialogue.turns.length,
    startTime
  })
  return {
    ...result,
    metadata: {
      ...result.metadata,
      _ttsObservedTurns: segmentResults.map((entry) => entry.turn),
      _ttsRenderStrategy: 'segmented'
    } as MultiSpeakerRunMetadata
  }
}
