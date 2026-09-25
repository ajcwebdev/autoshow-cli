import { InternalError, UsageError } from '~/utils/error-handler'
import { rename } from 'node:fs/promises'
import type {
  CurrentTtsObservedTurn,
  MultiSpeakerRunMetadata,
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
import { sha256Bytes } from './script-to-audio/contract-identity'
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

const buildObservedVoice = (
  _target: TtsTarget,
  kind: 'id' | 'ref-audio',
  value: string,
  _normalizedSpeaker?: string | undefined
): CurrentTtsObservedTurn['voice'] => {
  if (kind === 'ref-audio') throw UsageError('Reference audio TTS invocation is no longer supported.')
  return { kind: 'provider-id', value, valueHash: sha256Bytes(value) }
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
  const normalizedPath = `${outputDir}/dialogue-normalized.txt`
  await Bun.write(normalizedPath, `${dialogue.normalizedText}\n`)

  const strategy = target.multiSpeakerStrategy ?? 'segment-and-concat'
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
            sourceIndex: options.ttsCanonicalTurns?.[sourceIndex]?.sourceIndex ?? sourceIndex,
            speaker: turn.speaker,
            text: turn.text,
            voice: buildObservedVoice(target, mapping.voiceKind, mapping.voice, mapping.normalizedSpeaker),
            outputPath: result.audioPath
          }
        }),
        _ttsRenderStrategy: 'native-dialogue'
      } as MultiSpeakerRunMetadata
    }
  }

  const geminiUsage: NonNullable<Step4Metadata['geminiTtsUsage']> = []
  let geminiUsageComplete = true
  const startTime = Date.now()
  const segmentsDir = `${outputDir}/segments`
  await ensureDirectory(segmentsDir)

  const runSegment = async (
    i: number,
    workspaceDir: string,
    signal: AbortSignal
  ): Promise<{ path: string, turn: CurrentTtsObservedTurn }> => {
    const turn = dialogue.turns[i] as { speaker: string, text: string, providerSegments?: readonly string[] | undefined, providerSegmentIndexes?: readonly number[] | undefined }
    const sourceIndex = options.ttsCanonicalTurns?.[i]?.sourceIndex ?? i
    const speakerMapping = getSpeakerVoice(registry, turn.speaker)
    const index = String(i + 1).padStart(3, '0')
    const segmentFileName = `segment-${index}-${sanitizeSegmentName(turn.speaker)}.wav`
    const segmentPath = `${segmentsDir}/${segmentFileName}`

    if (speakerMapping.voiceKind === 'ref-audio') throw UsageError('Reference audio TTS invocation is no longer supported.')
    const baseInvocation: TtsTargetInvocation = Object.freeze({
      sourceId: turnIds[i] as string,
      sourceIndex,
      speaker: turn.speaker,
      voice: Object.freeze({
        kind: speakerMapping.voiceKind,
        value: speakerMapping.voice
      }),
      controls: resolveTtsTurnControlOverrides(target.service, turnIds[i] as string, turnControls),
      signal
    })
    const plannedChunks = requestEvidence?.forInvocation?.(baseInvocation)?.plannedChunks
    const selectedIndexes = turn.providerSegmentIndexes
    const providerSegments = plannedChunks
      ? selectedIndexes?.length ? selectedIndexes.map(index => {
        const chunk = plannedChunks[index]
        if (chunk === undefined) throw InternalError('Selected TTS segment is missing from its resolved request plan.', { stage: 'tts:multi-speaker' })
        return chunk
      }) : [...plannedChunks]
      : turn.providerSegments?.length ? [...turn.providerSegments] : [turn.text]
    const providerSegmentIndexes = turn.providerSegmentIndexes?.length
      ? [...turn.providerSegmentIndexes]
      : providerSegments.map((_segment, providerSegmentIndex) => providerSegmentIndex)
    if (providerSegmentIndexes.length !== providerSegments.length) throw InternalError('Canonical TTS provider segment indexes do not match the selected provider segments.', { stage: 'tts:multi-speaker', retryable: false })
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
        geminiUsageComplete = false
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
        geminiUsage.push(...result.metadata.geminiTtsUsage ?? [])
        if (result.metadata.geminiTtsUsageComplete !== true) geminiUsageComplete = false
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
        sourceIndex,
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
      ...(target.service === 'gemini' ? { geminiTtsUsage: geminiUsage, geminiTtsUsageComplete: geminiUsageComplete && geminiUsage.length > 0 } : {}),
      _ttsObservedTurns: segmentResults.map((entry) => entry.turn),
      _ttsRenderStrategy: 'segmented'
    } as MultiSpeakerRunMetadata
  }
}
