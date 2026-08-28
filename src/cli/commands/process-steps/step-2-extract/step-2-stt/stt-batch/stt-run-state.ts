import { isRecord } from '~/utils/rest-client'
import type { ExistingSttRun, Step2Metadata, ProviderCompletionStatus, SttProviderFailureSummary, SttProviderState, SttProviderSuccess, SttRecordedProviderError, SttRequestedProvider, SttTarget } from '~/types'
import { parseStep2RuntimeMetadata } from '../async-lifecycle'
import { parseStoredStep2TimingMetadata } from '../stt-timing-metadata'
import { getSttTargetDirectoryName, getSttTargetKey } from '../stt-targets'
import { readSinglePipelineItemRecord } from '../../../pipeline-manifest'
import { parseStoredTranscriptionResult } from '../stt-utils/stt-result-artifacts'
import { UsageError } from '~/utils/error-handler'
import {
  buildRequestedProviderList,
  collectMissingProviderTargets,
  parseStoredProviderArray,
  parseStoredProviderStateMap as parseStoredProviderStateEntries,
  ProviderBatchCompletionError,
  resolveRequestedProviderCompletionStatus,
  parseStoredProviderStateCore,
  resolveProviderCompletionStatus
} from '../../step-2-shared/provider-batch-state'

const STT_SERVICES = new Set<SttTarget['service']>([
  'whisper',
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
  const core = parseStoredProviderStateCore(value)
  if (!core || !isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  const lastError = isRecord(value['error']) && typeof value['error']['message'] === 'string'
    ? {
        message: value['error']['message'],
        ...(value['error']['skipped'] === true ? { skipped: true } : {}),
        ...(typeof value['error']['stage'] === 'string' ? { stage: value['error']['stage'] } : {}),
        ...(typeof value['error']['status'] === 'number' ? { status: value['error']['status'] } : {}),
        ...(typeof value['error']['retryAfterMs'] === 'number' ? { retryAfterMs: value['error']['retryAfterMs'] } : {}),
        ...(typeof value['error']['errorFile'] === 'string' ? { errorFile: value['error']['errorFile'] } : {}),
        ...(typeof value['error']['rawResponseFile'] === 'string' ? { rawResponseFile: value['error']['rawResponseFile'] } : {})
      } satisfies SttRecordedProviderError
    : undefined

  return {
    service: value['service'],
    model: value['model'],
    local: value['local'] === true,
    ...core,
    ...(lastError ? { error: lastError } : {})
  }
}

const parseStoredProviderStateMap = (
  entry: Record<string, unknown>
): Map<string, SttProviderState> =>
  parseStoredProviderStateEntries(entry['providerStates'], parseStoredProviderState)

const isSkippedProviderState = (
  state: Pick<SttProviderState, 'status' | 'error'> | undefined
): boolean =>
  state?.status === 'skipped' || state?.error?.skipped === true

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

export const resolveCanonicalCompletionStatus = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[]
): ProviderCompletionStatus => {
  const providerStates = parseStoredProviderStateMap(entry)
  return resolveRequestedProviderCompletionStatus(
    requestedTargets,
    providerStates,
    isSkippedProviderState
  )
}

export const buildMissingTargetsFromEntry = (
  entry: Record<string, unknown>,
  requestedTargets: SttTarget[]
): SttTarget[] => {
  const providerStates = parseStoredProviderStateMap(entry)
  return collectMissingProviderTargets(
    requestedTargets,
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
  const raw = await readSinglePipelineItemRecord(outputDir, { command: 'extract', extractRoute: 'media' })
  if (!isRecord(raw)) {
    return { successes, providerStates }
  }

  const storedProviderStates = parseStoredProviderStateMap(raw)
  for (const [key, value] of storedProviderStates) {
    providerStates.set(key, value)
  }

  await Promise.all(requestedTargets.map(async (target, index) => {
    const key = getSttTargetKey(target)
    const storedState = storedProviderStates.get(key)
    if (storedState?.status !== 'succeeded') {
      return
    }
    const metadata = parseStoredStep2Metadata(storedState.metadata)
    if (!metadata) {
      throw UsageError(`Canonical STT provider state ${target.service}/${target.model} is missing valid provider metadata.`)
    }
    const result = parseStoredTranscriptionResult(storedState.result)
    if (!result) {
      throw UsageError(`Canonical STT provider state ${target.service}/${target.model} is missing a valid result.`)
    }
    successes[index] = {
      target,
      metadata,
      result,
      relativeDir: storedState.artifactDir
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
        attempts: existing?.attempts ?? 1,
        metadata: success.metadata,
        result: success.result as unknown as Record<string, unknown>
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
        ...(existing?.metadata ? { metadata: existing.metadata } : {}),
        error: toRecordedProviderError({
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
      ...(existing?.metadata ? { metadata: existing.metadata } : {}),
      ...(existing?.error ? { error: existing.error } : {})
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
    .filter((state) => state.error !== undefined)
    .map((state) => ({
      service: state.service,
      model: state.model,
      message: state.error?.message,
      ...(state.status === 'skipped' || state.error?.skipped === true ? { skipped: true } : {}),
      ...(state.error?.stage ? { stage: state.error.stage } : {}),
      ...(typeof state.error?.status === 'number' ? { status: state.error.status } : {}),
      ...(typeof state.error?.retryAfterMs === 'number' ? { retryAfterMs: state.error.retryAfterMs } : {}),
      ...(state.error?.errorFile ? { errorFile: state.error.errorFile } : {}),
      ...(state.error?.rawResponseFile ? { rawResponseFile: state.error.rawResponseFile } : {})
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
