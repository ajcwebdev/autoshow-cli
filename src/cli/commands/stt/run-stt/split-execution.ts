import { InternalError } from '~/utils/error-handler'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import type { AudioSegmentDescriptor, IndexedTranscriptionChunk, SplitLimitClassification, SplitPolicyTarget, Step2Metadata, SttTarget, SttTargetOptions, TranscriptionResult } from '~/types'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isRecord } from '~/utils/rest-client'
import { mergeStep2TimingMetadata } from '../workflows/timing/stt-timing-metadata'
import { splitAudioFile } from '../stt-utils/audio-splitter'
import { formatTranscriptText } from '../stt-utils/stt-utils'
import { mergeTranscriptionEvidence } from '../stt-utils/stt-evidence'
import { parseStoredTranscriptionResult, writeSttResultArtifact } from '../stt-utils/stt-result-artifacts'
import { parseStoredStep2Metadata } from '../stt-batch/stt-run-state'
import {
  DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES,
  resolveEffectiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from '../stt-split-policy'
import { logSttSegmentLifecycle, logSttSplitDecision } from '../stt-logging'
import { dispatchStt } from './dispatch'
import { classifySttSplitLimitError, resolveAdaptiveSplitSegmentDurationMinutes } from './split-limits'
import { runHostedConcurrencyRequest } from '~/cli/commands/command-shared/hosted-concurrency-coordinator'

const MAX_ADAPTIVE_SPLIT_PASSES = 4

export const resolveSplitSegmentOutputDir = (
  segmentOutputDir: string,
  segmentNumber: number
): string => `${segmentOutputDir}/segment-runs/segment_${String(segmentNumber).padStart(3, '0')}`

export const SPLIT_SEGMENT_CHECKPOINT_FILE = 'segment-checkpoint.json'
const SPLIT_SEGMENT_CHECKPOINT_VERSION = 1

// A finished segment is saved with a fingerprint of everything that shaped its request: the segment audio bytes,
// its place in the recording, the provider and model, and the target options that change the transcript. A later
// adaptive pass, recovery pass, or `resume` that plans the same segment reuses it instead of paying for that audio
// again; any difference sends the request.
export const buildSplitSegmentFingerprint = async (
  target: SttTarget,
  segment: Pick<AudioSegmentDescriptor, 'path' | 'startSeconds' | 'durationSeconds'>
): Promise<string> => {
  const audioSha256 = new Bun.CryptoHasher('sha256').update(await Bun.file(segment.path).arrayBuffer()).digest('hex')
  const identity = {
    version: SPLIT_SEGMENT_CHECKPOINT_VERSION,
    service: target.service,
    model: target.model,
    diarizationOptions: target.diarizationOptions ?? null,
    nativeSubtitles: target.nativeSubtitles ?? null,
    nativeResponseFormat: target.nativeResponseFormat ?? null,
    grokSttVerbatim: target.grokSttVerbatim ?? null,
    supadataChunkSize: target.supadataChunkSize ?? null,
    startSeconds: segment.startSeconds,
    durationSeconds: segment.durationSeconds,
    audioSha256
  }
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(identity)).digest('hex')
}

export const readSplitSegmentCheckpoint = async (
  segmentRunOutputDir: string,
  fingerprint: string
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata } | undefined> => {
  const file = Bun.file(join(segmentRunOutputDir, SPLIT_SEGMENT_CHECKPOINT_FILE))
  if (!(await file.exists())) return undefined
  try {
    const parsed: unknown = JSON.parse(await file.text())
    if (!isRecord(parsed) || parsed['version'] !== SPLIT_SEGMENT_CHECKPOINT_VERSION || parsed['fingerprint'] !== fingerprint || !isRecord(parsed['data'])) return undefined
    const result = parseStoredTranscriptionResult(parsed['data']['result'])
    const metadata = parseStoredStep2Metadata(parsed['data']['metadata'])
    if (!result || !metadata || metadata.transcriptionModel.trim().length === 0
      || !Number.isFinite(metadata.processingTime) || metadata.processingTime < 0
      || !Number.isFinite(metadata.tokenCount) || metadata.tokenCount < 0) return undefined
    return { result, metadata }
  } catch {
    return undefined
  }
}

export const writeSplitSegmentCheckpoint = async (
  segmentRunOutputDir: string,
  fingerprint: string,
  data: { result: TranscriptionResult, metadata: Step2Metadata }
): Promise<void> => {
  await Bun.write(
    join(segmentRunOutputDir, SPLIT_SEGMENT_CHECKPOINT_FILE),
    `${JSON.stringify({ version: SPLIT_SEGMENT_CHECKPOINT_VERSION, fingerprint, data })}\n`
  )
}

const persistTranscriptionStructuredArtifact = async (
  outputDir: string,
  result: TranscriptionResult
): Promise<void> => {
  await writeSttResultArtifact(outputDir, result)
}

const resolveEffectiveSegmentConcurrency = (
  target: Pick<SttTarget, 'local' | 'service'>,
  requestedConcurrency: number | undefined
): number => {
  if (target.local || target.service === 'mistral') {
    return 1
  }

  return Math.max(1, requestedConcurrency ?? DEFAULT_CLI_CONCURRENCY)
}

const mergeSplitTranscriptionChunks = (
  chunks: IndexedTranscriptionChunk[]
): { result: TranscriptionResult, metadata: Step2Metadata } => {
  const orderedChunks = [...chunks].sort((left, right) => left.segmentIndex - right.segmentIndex)
  const segmentResults = orderedChunks.map((entry) => {
    const label = (speaker: string | undefined): string | undefined => speaker ? `chunk-${entry.segmentIndex + 1}/${speaker}` : undefined
    const result = entry.data.result
    return { ...entry.data, result: { ...result,
      segments: result.segments.map(segment => ({ ...segment, speaker: label(segment.speaker) })),
      ...(result.evidence ? { evidence: { ...result.evidence,
        words: result.evidence.words?.map(word => ({ ...word, speaker: label(word.speaker) })),
        segments: result.evidence.segments?.map(segment => ({ ...segment, speaker: label(segment.speaker) }))
      } } : {})
    } }
  })

  const combinedResult = {
    text: segmentResults.map(s => s.result.text).join(' '),
    segments: segmentResults.flatMap(s => s.result.segments),
    evidence: mergeTranscriptionEvidence(segmentResults.map((segment) => segment.result.evidence))
  }

  const totalProcessingTime = segmentResults.reduce((sum, s) => sum + s.metadata.processingTime, 0)
  const totalTokenCount = segmentResults.reduce((sum, s) => sum + s.metadata.tokenCount, 0)
  const mergedTimings = mergeStep2TimingMetadata(segmentResults.map((segment) => segment.metadata.timings))
  const canMergeBilling = segmentResults.every((segment) => typeof segment.metadata.billing?.totalCost === 'number')
  const mergedBilling = canMergeBilling
    ? (() => {
        const totalCost = segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.totalCost ?? 0), 0)
        const totalCredits = segmentResults.every((segment) => typeof segment.metadata.billing?.creditsUsed === 'number')
          ? segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.creditsUsed ?? 0), 0)
          : undefined
        const totalInputTokens = segmentResults.every((segment) => typeof segment.metadata.billing?.inputTokens === 'number')
          ? segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.inputTokens ?? 0), 0)
          : undefined
        const totalOutputTokens = segmentResults.every((segment) => typeof segment.metadata.billing?.outputTokens === 'number')
          ? segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.outputTokens ?? 0), 0)
          : undefined
        const totalUsageTokens = segmentResults.every((segment) => typeof segment.metadata.billing?.totalTokens === 'number')
          ? segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.totalTokens ?? 0), 0)
          : undefined
        const totalAudioInputTokens = segmentResults.every((segment) => typeof segment.metadata.billing?.audioInputTokens === 'number')
          ? segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.audioInputTokens ?? 0), 0)
          : undefined
        const totalTextInputTokens = segmentResults.every((segment) => typeof segment.metadata.billing?.textInputTokens === 'number')
          ? segmentResults.reduce((sum, segment) => sum + (segment.metadata.billing?.textInputTokens ?? 0), 0)
          : undefined
        const explicitCreditRates = segmentResults
          .map((segment) => segment.metadata.billing?.creditRateCents)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        const sharedCreditRate = explicitCreditRates.length === segmentResults.length
          && explicitCreditRates.every((value) => Math.abs(value - explicitCreditRates[0]!) < 1e-9)
          ? explicitCreditRates[0]
          : undefined

        return {
          totalCost,
          ...(typeof totalCredits === 'number' ? { creditsUsed: totalCredits } : {}),
          ...(typeof totalInputTokens === 'number' ? { inputTokens: totalInputTokens } : {}),
          ...(typeof totalOutputTokens === 'number' ? { outputTokens: totalOutputTokens } : {}),
          ...(typeof totalUsageTokens === 'number' ? { totalTokens: totalUsageTokens } : {}),
          ...(typeof totalAudioInputTokens === 'number' ? { audioInputTokens: totalAudioInputTokens } : {}),
          ...(typeof totalTextInputTokens === 'number' ? { textInputTokens: totalTextInputTokens } : {}),
          ...(typeof sharedCreditRate === 'number'
            ? { creditRateCents: sharedCreditRate }
            : typeof totalCredits === 'number' && totalCredits > 0
              ? { creditRateCents: totalCost / totalCredits }
              : {}),
          source: segmentResults.every((segment) => segment.metadata.billing?.source === 'provider_usage')
            ? 'provider_usage' as const
            : segmentResults.every((segment) => segment.metadata.billing?.source === 'provider_quote')
            ? 'provider_quote' as const
            : 'registry_fallback' as const,
          mode: 'segment_sum' as const
        }
      })()
    : undefined

  return {
    result: combinedResult,
    metadata: {
      transcriptionService: segmentResults[0]!.metadata.transcriptionService,
      ...(segmentResults[0]!.metadata.diarizationOptions ? { diarizationOptions: segmentResults[0]!.metadata.diarizationOptions } : {}),
      transcriptionModel: segmentResults[0]!.metadata.transcriptionModel,
      processingTime: totalProcessingTime,
      tokenCount: totalTokenCount,
      ...(mergedTimings ? { timings: mergedTimings } : {}),
      ...(mergedBilling ? { billing: mergedBilling } : {})
    }
  }
}

const runSplitTranscription = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  options: SttTargetOptions,
  splitSegmentDurationMinutes?: number,
  workingOutputDir?: string
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const segmentOutputDir = workingOutputDir ?? outputDir
  if (workingOutputDir !== undefined) {
    await mkdir(workingOutputDir, { recursive: true })
  }

  const effectiveSegmentDurationMinutes = splitSegmentDurationMinutes
    ?? resolveEffectiveSplitSegmentDurationMinutes(resolveSttSplitPolicy(target), DEFAULT_SPLIT_SEGMENT_DURATION_MINUTES, {
      audioFileSizeBytes: Bun.file(audioPath).size,
      audioDurationSeconds: options.audioDurationSeconds
    })
  const segmentDescriptors = await splitAudioFile(audioPath, segmentOutputDir, effectiveSegmentDurationMinutes)
  const totalDurationSeconds = segmentDescriptors.reduce((sum, segment) => sum + segment.durationSeconds, 0)
  const segmentConcurrency = resolveEffectiveSegmentConcurrency(target, options.sttSegmentConcurrency)
  const results: IndexedTranscriptionChunk[] = []
  let nextIndex = 0
  let failure: unknown

  const runWorker = async (): Promise<void> => {
    while (failure === undefined) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= segmentDescriptors.length) {
        return
      }

      const segmentDescriptor = segmentDescriptors[currentIndex]!
      const offsetMinutes = segmentDescriptor.startSeconds / 60
      const segmentRunOutputDir = resolveSplitSegmentOutputDir(segmentOutputDir, segmentDescriptor.segmentNumber)

      try {
        await mkdir(segmentRunOutputDir, { recursive: true })
        const fingerprint = await buildSplitSegmentFingerprint(target, segmentDescriptor)
        const checkpoint = await readSplitSegmentCheckpoint(segmentRunOutputDir, fingerprint)
        if (checkpoint) {
          logSttSegmentLifecycle({
            provider: target.service,
            action: 'reused',
            segmentNumber: segmentDescriptor.segmentNumber,
            totalSegments: segmentDescriptor.totalSegments,
            model: target.model
          })
          results.push({ segmentIndex: currentIndex, data: checkpoint })
          continue
        }
        const runSegment = async () => await dispatchStt(
          target,
          segmentDescriptor.path,
          segmentRunOutputDir,
          offsetMinutes,
          {
            ...options,
            audioDurationSeconds: segmentDescriptor.durationSeconds
          },
          segmentDescriptor.segmentNumber,
          segmentDescriptor.totalSegments,
          {
            segmentStartSeconds: segmentDescriptor.startSeconds,
            segmentDurationSeconds: segmentDescriptor.durationSeconds,
            totalDurationSeconds
          }
        )
        const data = !target.local && options.hostedConcurrencyCoordinator
          ? await runHostedConcurrencyRequest({
              coordinator: options.hostedConcurrencyCoordinator,
              admission: {
                provider: target.service,
                workClass: 'stt-segment',
                configuredLimit: segmentConcurrency,
                workId: `${target.service}:${target.model}:${outputDir}`,
                unitIndex: currentIndex,
                context: { segmentNumber: segmentDescriptor.segmentNumber }
              }
            }, async () => await runSegment())
          : await runSegment()
        await writeSplitSegmentCheckpoint(segmentRunOutputDir, fingerprint, data)
        results.push({ segmentIndex: currentIndex, data })
      } catch (error) {
        failure = error
        return
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(segmentConcurrency, segmentDescriptors.length) }, async () => {
      await runWorker()
    })
  )

  if (failure !== undefined) {
    throw failure
  }

  const combined = mergeSplitTranscriptionChunks(results)
  if (!target.local && options.hostedConcurrencyCoordinator) {
    combined.metadata.hostedConcurrency = options.hostedConcurrencyCoordinator.snapshot()
  }
  await Bun.write(`${outputDir}/transcription.txt`, formatTranscriptText(combined.result.segments))
  await persistTranscriptionStructuredArtifact(outputDir, combined.result)
  return combined
}

const buildSplitRetryDecision = (
  target: SplitPolicyTarget,
  classification: SplitLimitClassification,
  segmentDurationMinutes: number,
  audioFileSizeBytes: number,
  audioDurationSeconds: number | undefined
): Pick<ReturnType<typeof resolveTranscriptionSplitDecision>, 'reasons' | 'segmentDurationMinutes'> => {
  const policy = resolveSttSplitPolicy(target)
  const reasons = classification.reason === 'attachment_cap' && policy.attachmentCapBytes !== undefined
    ? [{
        kind: 'attachment_cap' as const,
        attachmentCapBytes: policy.attachmentCapBytes,
        audioFileSizeBytes
      }]
    : classification.reason === 'duration_cap' && classification.durationCapSeconds !== undefined && audioDurationSeconds !== undefined
      ? [{
          kind: 'duration_cap' as const,
          maxDurationSeconds: classification.durationCapSeconds,
          audioDurationSeconds
        }]
      : classification.reason === 'request_budget' && policy.requestBudgetSeconds !== undefined && audioDurationSeconds !== undefined
        ? [{
            kind: 'request_budget' as const,
            requestBudgetSeconds: policy.requestBudgetSeconds,
            audioDurationSeconds
          }]
        : []

  return {
    reasons,
    segmentDurationMinutes
  }
}

const logAdaptiveSplitRetryDecision = (
  target: SplitPolicyTarget,
  audioPath: string,
  classification: SplitLimitClassification,
  segmentDurationMinutes: number,
  audioFileSizeBytes: number,
  audioDurationSeconds: number | undefined
): void => {
  logSttSplitDecision( target, buildSplitRetryDecision(
    target,
    classification,
    segmentDurationMinutes,
    audioFileSizeBytes,
    audioDurationSeconds
  ), {
    trigger: 'retry',
    retryReason: classification.reason,
    audioPath,
    audioFileSizeBytes,
    audioDurationSeconds
  })
}

export const runAdaptiveSplitTranscription = async (
  target: SttTarget,
  audioPath: string,
  outputDir: string,
  options: SttTargetOptions,
  initialSegmentDurationMinutes: number,
  audioFileSizeBytes: number,
  initialRetryClassification?: SplitLimitClassification | undefined
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  let segmentDurationMinutes = initialSegmentDurationMinutes
  if (initialRetryClassification !== undefined) {
    logAdaptiveSplitRetryDecision(
      target,
      audioPath,
      initialRetryClassification,
      segmentDurationMinutes,
      audioFileSizeBytes,
      options.audioDurationSeconds
    )
  }

  for (let pass = 1; pass <= MAX_ADAPTIVE_SPLIT_PASSES; pass += 1) {
    const workingOutputDir = `${outputDir}/split-attempts/pass_${String(pass).padStart(3, '0')}`

    try {
      return await runSplitTranscription(target, audioPath, outputDir, {
        ...options,
        asyncLifecycle: undefined
      }, segmentDurationMinutes, workingOutputDir)
    } catch (error) {
      const classification = classifySttSplitLimitError(target, error)
      const nextSegmentDurationMinutes = classification !== undefined
        ? resolveAdaptiveSplitSegmentDurationMinutes(segmentDurationMinutes, error)
        : undefined

      if (
        classification === undefined
        || nextSegmentDurationMinutes === undefined
        || pass >= MAX_ADAPTIVE_SPLIT_PASSES
      ) {
        throw error
      }

      segmentDurationMinutes = nextSegmentDurationMinutes
      logAdaptiveSplitRetryDecision(
        target,
        audioPath,
        classification,
        segmentDurationMinutes,
        audioFileSizeBytes,
        options.audioDurationSeconds
      )
    }
  }

  throw InternalError('Adaptive split transcription ended without a result', { stage: 'stt:split' })
}
