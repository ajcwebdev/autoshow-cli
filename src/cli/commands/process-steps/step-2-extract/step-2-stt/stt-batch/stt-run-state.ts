import { isRecord } from '~/utils/rest-client'
import { join } from 'node:path'
import type { ExistingSttRun, Step2Metadata, ProviderCompletionStatus, SttProviderFailureSummary, SttProviderState, SttProviderSuccess, SttRecordedProviderError, SttRequestedProvider, SttTarget, TranscriptionResult } from '~/types'
import { parseStep2RuntimeMetadata } from '../async-lifecycle'
import { parseStoredStep2TimingMetadata } from '../stt-timing-metadata'
import { getSttTargetDirectoryName, getSttTargetKey } from '../stt-targets'
import { readSttRunManifestEntry } from '../stt-manifest'
import { readProviderResultEntry } from '../../../manifest-utils'
import { parseStoredTranscriptionResult } from '../stt-utils/stt-result-artifacts'
import { AppError } from '~/utils/error-handler'
import {
  buildRequestedProviderList,
  collectMissingProviderTargets,
  inferStoredProviderCompletionStatus,
  parseStoredProviderArray,
  parseStoredProviderStateMap as parseStoredProviderStateEntries,
  parseStoredSuccessfulProviderKeys,
  ProviderBatchCompletionError,
  resolveProviderCompletionStatus
} from '../../step-2-shared/provider-batch-state'

const TRANSCRIPT_LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/

const STT_SERVICES = new Set<SttTarget['service']>([
  'whisper',
  'reverb',
  'deepgram',
  'deepinfra',
  'soniox',
  'speechmatics',
  'rev',
  'groq',
  'mistral',
  'assemblyai',
  'gladia',
  'happyscribe',
  'supadata',
  'scrapecreators',
  'gemini-stt',
  'together',
  'youtube-captions'
])


const isSttService = (value: unknown): value is SttTarget['service'] =>
  typeof value === 'string' && STT_SERVICES.has(value as SttTarget['service'])

const parseTranscriptText = (text: string): TranscriptionResult => {
  const segments: TranscriptionResult['segments'] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const match = line.match(TRANSCRIPT_LINE_PATTERN)
    if (!match) {
      continue
    }

    const segmentText = (match[3] ?? '').trim()
    if (segmentText.length === 0) {
      continue
    }

    segments.push({
      start: match[1] as string,
      end: match[1] as string,
      text: segmentText,
      ...(typeof match[2] === 'string' && match[2].trim().length > 0
        ? { speaker: match[2].trim() }
        : {})
    })
  }

  if (segments.length === 0) {
    const trimmed = text.trim()
    return {
      text: trimmed,
      segments: trimmed.length > 0
        ? [{ start: '00:00:00', end: '00:00:00', text: trimmed }]
        : []
    }
  }

  return {
    text: segments.map((segment) => segment.text).join(' ').trim(),
    segments
  }
}

const parseStoredStep2Metadata = (value: unknown): Step2Metadata | undefined => {
  if (!isRecord(value) || !isSttService(value['transcriptionService']) || typeof value['transcriptionModel'] !== 'string') {
    return undefined
  }

  if (typeof value['processingTime'] !== 'number' || typeof value['tokenCount'] !== 'number') {
    return undefined
  }

  const timings = parseStoredStep2TimingMetadata(value['timings'])
  const runtime = parseStep2RuntimeMetadata(value['runtime'])
  let billing: Step2Metadata['billing'] | undefined
  if (isRecord(value['billing'])) {
    const parsedBilling: NonNullable<Step2Metadata['billing']> = {}
    if (typeof value['billing']['creditsUsed'] === 'number') {
      parsedBilling.creditsUsed = value['billing']['creditsUsed']
    }
    if (typeof value['billing']['creditRateCents'] === 'number') {
      parsedBilling.creditRateCents = value['billing']['creditRateCents']
    }
    if (typeof value['billing']['inputTokens'] === 'number') {
      parsedBilling.inputTokens = value['billing']['inputTokens']
    }
    if (typeof value['billing']['outputTokens'] === 'number') {
      parsedBilling.outputTokens = value['billing']['outputTokens']
    }
    if (typeof value['billing']['totalTokens'] === 'number') {
      parsedBilling.totalTokens = value['billing']['totalTokens']
    }
    if (typeof value['billing']['audioInputTokens'] === 'number') {
      parsedBilling.audioInputTokens = value['billing']['audioInputTokens']
    }
    if (typeof value['billing']['textInputTokens'] === 'number') {
      parsedBilling.textInputTokens = value['billing']['textInputTokens']
    }
    if (typeof value['billing']['totalCost'] === 'number') {
      parsedBilling.totalCost = value['billing']['totalCost']
    }
    if (
      value['billing']['source'] === 'provider_usage'
      || value['billing']['source'] === 'provider_quote'
      || value['billing']['source'] === 'response_header'
      || value['billing']['source'] === 'registry_fallback'
    ) {
      parsedBilling.source = value['billing']['source']
    }
    if (
      value['billing']['mode'] === 'url'
      || value['billing']['mode'] === 'duration'
      || value['billing']['mode'] === 'order'
      || value['billing']['mode'] === 'token'
      || value['billing']['mode'] === 'segment_sum'
    ) {
      parsedBilling.mode = value['billing']['mode']
    }
    billing = Object.keys(parsedBilling).length > 0 ? parsedBilling : undefined
  }

  return {
    transcriptionService: value['transcriptionService'],
    transcriptionModel: value['transcriptionModel'],
    processingTime: value['processingTime'],
    tokenCount: value['tokenCount'],
    ...(value['captionKind'] === 'manual' || value['captionKind'] === 'auto'
      ? { captionKind: value['captionKind'] }
      : {}),
    ...(typeof value['captionLanguage'] === 'string' ? { captionLanguage: value['captionLanguage'] } : {}),
    ...(value['captionFormat'] === 'vtt' ? { captionFormat: value['captionFormat'] } : {}),
    ...(timings ? { timings } : {}),
    ...(runtime ? { runtime } : {}),
    ...(billing && Object.keys(billing).length > 0 ? { billing } : {})
  }
}

export const getSttProviderArtifactDir = (
  target: Pick<SttTarget, 'service' | 'model'>
): string => `providers/${getSttTargetDirectoryName(target)}`

export const toRequestedProvider = (target: SttTarget): SttRequestedProvider => ({
  service: target.service,
  model: target.model,
  local: target.local,
  ...(target.diarizationOptions ? { diarizationOptions: target.diarizationOptions } : {})
})

export const toRecordedProviderError = (
  failure: Pick<SttProviderFailureSummary, 'message' | 'skipped' | 'stage' | 'status' | 'retryAfterMs' | 'errorFile' | 'rawResponseFile'>
): SttRecordedProviderError => ({
  message: failure.message,
  ...(failure.skipped === true ? { skipped: true } : {}),
  ...(failure.stage ? { stage: failure.stage } : {}),
  ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
  ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
  ...(failure.errorFile ? { errorFile: failure.errorFile } : {}),
  ...(failure.rawResponseFile ? { rawResponseFile: failure.rawResponseFile } : {})
})

const parseStoredRequestedTarget = (value: unknown): SttTarget | undefined => {
  if (!isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  return {
    service: value['service'],
    model: value['model'],
    local: value['local'] === true,
    ...(isRecord(value['diarizationOptions']) ? { diarizationOptions: value['diarizationOptions'] as SttTarget['diarizationOptions'] } : {})
  }
}

export const parseStoredRequestedTargets = (
  entry: Record<string, unknown>
): SttTarget[] =>
  parseStoredProviderArray(entry['requestedProviders'], parseStoredRequestedTarget)

const parseStoredProviderState = (value: unknown): SttProviderState | undefined => {
  if (!isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  if (value['status'] !== 'succeeded' && value['status'] !== 'missing' && value['status'] !== 'failed' && value['status'] !== 'skipped') {
    return undefined
  }

  if (typeof value['artifactDir'] !== 'string' || typeof value['attempts'] !== 'number') {
    return undefined
  }

  const lastError = isRecord(value['lastError']) && typeof value['lastError']['message'] === 'string'
    ? {
        message: value['lastError']['message'],
        ...(value['lastError']['skipped'] === true ? { skipped: true } : {}),
        ...(typeof value['lastError']['stage'] === 'string' ? { stage: value['lastError']['stage'] } : {}),
        ...(typeof value['lastError']['status'] === 'number' ? { status: value['lastError']['status'] } : {}),
        ...(typeof value['lastError']['retryAfterMs'] === 'number' ? { retryAfterMs: value['lastError']['retryAfterMs'] } : {}),
        ...(typeof value['lastError']['errorFile'] === 'string' ? { errorFile: value['lastError']['errorFile'] } : {}),
        ...(typeof value['lastError']['rawResponseFile'] === 'string' ? { rawResponseFile: value['lastError']['rawResponseFile'] } : {})
      } satisfies SttRecordedProviderError
    : undefined

  return {
    service: value['service'],
    model: value['model'],
    local: value['local'] === true,
    artifactDir: value['artifactDir'],
    status: value['status'],
    attempts: value['attempts'],
    ...(lastError ? { lastError } : {})
  }
}

const parseStoredProviderStateMap = (
  entry: Record<string, unknown>
): Map<string, SttProviderState> =>
  parseStoredProviderStateEntries(entry['providerStates'], parseStoredProviderState)

const parseSuccessfulProviderKeys = (
  entry: Record<string, unknown>
): Set<string> =>
  parseStoredSuccessfulProviderKeys(entry['step2'], (value) => {
    if (!isRecord(value) || !isSttService(value['transcriptionService']) || typeof value['transcriptionModel'] !== 'string') {
      return undefined
    }
    return { service: value['transcriptionService'], model: value['transcriptionModel'] }
  })

const isSkippedProviderState = (
  state: Pick<SttProviderState, 'status' | 'lastError'> | undefined
): boolean =>
  state?.status === 'skipped' || state?.lastError?.skipped === true

export const summarizeSttProviderStates = (
  providerStates: SttProviderState[]
): {
  requested: number
  applicable: number
  succeeded: number
  failed: number
  missing: number
  skipped: number
} => {
  const summary = {
    requested: providerStates.length,
    applicable: 0,
    succeeded: 0,
    failed: 0,
    missing: 0,
    skipped: 0
  }

  for (const state of providerStates) {
    if (state.status === 'skipped') {
      summary.skipped += 1
      continue
    }

    summary.applicable += 1
    if (state.status === 'succeeded') {
      summary.succeeded += 1
      continue
    }

    if (state.status === 'failed') {
      summary.failed += 1
      continue
    }

    summary.missing += 1
  }

  return summary
}

export const inferStoredCompletionStatus = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[]
): ProviderCompletionStatus => {
  const successKeys = parseSuccessfulProviderKeys(entry)
  const providerStates = parseStoredProviderStateMap(entry)
  return inferStoredProviderCompletionStatus(
    entry['completionStatus'],
    requestedTargets,
    successKeys,
    providerStates,
    isSkippedProviderState
  )
}

export const buildMissingTargetsFromEntry = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[]
): SttTarget[] => {
  const explicitMissing = parseStoredProviderArray(entry['missingProviders'], parseStoredRequestedTarget)
  const providerStates = parseStoredProviderStateMap(entry)
  const successKeys = parseSuccessfulProviderKeys(entry)
  return collectMissingProviderTargets(
    explicitMissing,
    requestedTargets,
    successKeys,
    providerStates,
    (_target, state) => state?.status !== 'succeeded' && !isSkippedProviderState(state)
  )
}

export const readExistingSttRun = async (
  outputDir: string,
  requestedTargets: SttTarget[]
): Promise<ExistingSttRun> => {
  const providerStates = new Map<string, SttProviderState>()
  const successes: Array<SttProviderSuccess | undefined> = new Array(requestedTargets.length)
  const raw = await readSttRunManifestEntry(outputDir)
  if (!isRecord(raw)) {
    return { successes, providerStates }
  }

  const storedProviderStates = parseStoredProviderStateMap(raw)
  for (const [key, value] of storedProviderStates) {
    providerStates.set(key, value)
  }

  await Promise.all(requestedTargets.map(async (target, index) => {
    const key = getSttTargetKey(target)
    const providerDir = join(outputDir, getSttProviderArtifactDir(target))
    let providerResult = await readProviderResultEntry(providerDir)
    let relativeDir = getSttProviderArtifactDir(target)
    let transcriptPath = join(outputDir, getSttProviderArtifactDir(target), 'transcription.txt')
    if (!providerResult && storedProviderStates.get(key)?.artifactDir === '.') {
      providerResult = await readProviderResultEntry(outputDir)
      relativeDir = '.'
      transcriptPath = join(outputDir, 'transcription.txt')
    }
    if (!providerResult) {
      return
    }
    if (
      providerResult.provider !== target.service
      || (typeof providerResult.model === 'string' && providerResult.model !== target.model)
    ) {
      return
    }

    const metadata = parseStoredStep2Metadata(providerResult.metadata)
    if (!metadata) {
      return
    }

    let result = parseStoredTranscriptionResult(providerResult.result)
    if (!result) {
      let transcriptText: string
      try {
        transcriptText = await Bun.file(transcriptPath).text()
      } catch (error) {
        throw new AppError(`Failed to read stored STT transcript at ${transcriptPath}`, {
          kind: 'infrastructure',
          cause: error instanceof Error ? error : new Error(String(error)),
          stage: 'transcript',
          metadata: {
            transcriptPath,
            service: target.service,
            model: target.model
          }
        })
      }
      result = parseTranscriptText(transcriptText)
    }
    successes[index] = {
      target,
      metadata,
      result,
      relativeDir
    }
  }))

  return {
    successes,
    providerStates
  }
}

export const buildProviderStates = <
  SuccessLike extends SttProviderSuccess,
  FailureLike extends SttProviderFailureSummary
>(
  requestedTargets: SttTarget[],
  successes: Array<SuccessLike | undefined>,
  failuresByIndex: Map<number, FailureLike>,
  existingStates: Map<string, SttProviderState>
): SttProviderState[] =>
  requestedTargets.map((target, index) => {
    const key = getSttTargetKey(target)
    const existing = existingStates.get(key)
    const failure = failuresByIndex.get(index)
    const success = successes[index]

    if (success) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: success.relativeDir ?? existing?.artifactDir ?? getSttProviderArtifactDir(target),
        status: 'succeeded',
        attempts: existing?.attempts ?? 1
      }
    }

    if (failure) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: getSttProviderArtifactDir(target),
        status: failure.skipped === true ? 'skipped' : 'failed',
        attempts: existing?.attempts ?? 1,
        lastError: toRecordedProviderError({
          message: failure.message,
          ...(failure.skipped === true ? { skipped: true } : {}),
          ...(failure.stage ? { stage: failure.stage } : {}),
          ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
          ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
          ...(failure.errorFile ? { errorFile: `${getSttProviderArtifactDir(target)}/${failure.errorFile}` } : {}),
          ...(failure.rawResponseFile ? { rawResponseFile: `${getSttProviderArtifactDir(target)}/${failure.rawResponseFile}` } : {})
        })
      }
    }

    return {
      service: target.service,
      model: target.model,
      local: target.local,
      artifactDir: getSttProviderArtifactDir(target),
      status: existing?.status ?? 'missing',
      attempts: existing?.attempts ?? 0,
      ...(existing?.lastError ? { lastError: existing.lastError } : {})
    }
  })

export const resolveCompletionStatus = (
  providerStates: SttProviderState[]
): ProviderCompletionStatus =>
  resolveProviderCompletionStatus(providerStates, 'complete')

export const buildMissingProviders = (
  providerStates: SttProviderState[],
  requestedTargets: SttTarget[]
): SttRequestedProvider[] => {
  return buildRequestedProviderList(
    providerStates,
    requestedTargets,
    (state) => state.status === 'failed' || state.status === 'missing',
    toRequestedProvider
  )
}

export const buildMetadataErrorEntries = (
  providerStates: SttProviderState[]
): Array<Record<string, unknown>> =>
  providerStates
    .filter((state) => state.lastError !== undefined)
    .map((state) => ({
      service: state.service,
      model: state.model,
      message: state.lastError?.message,
      ...(state.status === 'skipped' || state.lastError?.skipped === true ? { skipped: true } : {}),
      ...(state.lastError?.stage ? { stage: state.lastError.stage } : {}),
      ...(typeof state.lastError?.status === 'number' ? { status: state.lastError.status } : {}),
      ...(typeof state.lastError?.retryAfterMs === 'number' ? { retryAfterMs: state.lastError.retryAfterMs } : {}),
      ...(state.lastError?.errorFile ? { errorFile: state.lastError.errorFile } : {}),
      ...(state.lastError?.rawResponseFile ? { rawResponseFile: state.lastError.rawResponseFile } : {})
    }))

export class SttPartialCompletionError extends ProviderBatchCompletionError {
  missingProviders: SttRequestedProvider[]

  constructor(
    outputDir: string,
    completionStatus: ProviderCompletionStatus,
    missingProviders: SttRequestedProvider[],
    message: string
  ) {
    super('SttPartialCompletionError', outputDir, completionStatus, message)
    this.missingProviders = missingProviders
  }
}

export const isSttPartialCompletionError = (
  error: unknown
): error is SttPartialCompletionError => error instanceof SttPartialCompletionError
