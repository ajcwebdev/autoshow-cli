import { isRecord } from '~/utils/rest-client'
import { join } from 'node:path'
import type { ExistingOcrRun, ExtractionMetadata, ExtractionResult, ProviderCompletionStatus, OcrMetadataOptions, OcrProviderErrorLike, OcrProviderFailureCategory, OcrProviderFailureKind, OcrProviderFailureSummary, OcrProviderState, OcrProviderSuccess, OcrRecordedProviderError, OcrRequestedProvider, OcrTarget } from '~/types'
import { ExtractionMetadataSchema, ExtractionResultSchema } from '~/types'
import { collectErrorChain, extractErrorMetadata } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { parseRetryAfterMs } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { readProviderResultEntry } from '../../manifest-utils'
import { readOcrRunManifestEntry } from './ocr-manifest'
import { getOcrTargetDirectoryName } from './ocr-targets'
import { classifyOcrFailureSummary } from './ocr-utils/ocr-failure-classifier'
import {
  buildRequestedProviderList,
  collectMissingProviderTargets,
  inferStoredProviderCompletionStatus,
  parseStoredProviderArray,
  parseStoredProviderStateMap as parseStoredProviderStateEntries,
  parseStoredSuccessfulProviderKeys,
  resolveProviderCompletionStatus
} from '../step-2-shared/provider-batch-state'


const ANSI_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const OCR_PROVIDER_FAILURE_CATEGORIES = new Set<OcrProviderFailureCategory>([
  'structured_response',
  'pdf_chunk_render',
  'timeout',
  'network',
  'auth',
  'rate_limit',
  'content_policy',
  'provider_limit',
  'unknown'
])
const OCR_PROVIDER_FAILURE_KINDS = new Set<OcrProviderFailureKind>([
  'structured_response',
  'pdf_chunk_render',
  'timeout',
  'network',
  'auth',
  'rate_limit',
  'quota',
  'content_policy',
  'provider_limit',
  'provider_no_retry',
  'unknown'
])

const resolveFailureMessage = (
  chain: OcrProviderErrorLike[],
  error: unknown
): string => {
  if (chain.length === 0) {
    return stripAnsi(error instanceof Error ? error.message : String(error))
  }

  const outer = chain[0] as OcrProviderErrorLike
  const deepest = chain[chain.length - 1] as OcrProviderErrorLike
  if (deepest.name === 'AbortError' || deepest.name === 'TimeoutError') {
    const timeoutMessage = deepest.message || 'request timed out'
    return stripAnsi(outer.message ? `${outer.message}: ${timeoutMessage}` : timeoutMessage)
  }
  return stripAnsi(deepest.message || outer.message)
}

const resolveExplicitFailureCategory = (
  chain: OcrProviderErrorLike[],
): OcrProviderFailureCategory | undefined => {
  const explicitCategory = chain.find((entry) =>
    typeof entry.category === 'string'
    && OCR_PROVIDER_FAILURE_CATEGORIES.has(entry.category as OcrProviderFailureCategory)
  )?.category
  if (typeof explicitCategory === 'string') {
    return explicitCategory as OcrProviderFailureCategory
  }
  return undefined
}

export const stripAnsi = (value: string): string => value.replace(ANSI_PATTERN, '')

export const classifyOcrProviderFailure = (
  error: unknown
): OcrProviderFailureSummary => {
  const chain = collectErrorChain(error) as OcrProviderErrorLike[]
  const message = sanitizeLogText(resolveFailureMessage(chain, error))
  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  const stage = typeof metadata['stage'] === 'string' ? metadata['stage'] : undefined
  const attemptsMade = typeof metadata['attemptsMade'] === 'number' ? metadata['attemptsMade'] : undefined
  const retryAfterMs = parseRetryAfterMs(headers)
  const classification = classifyOcrFailureSummary({
    message,
    category: resolveExplicitFailureCategory(chain),
    status,
    headers,
    errorType: typeof metadata['errorType'] === 'string' ? metadata['errorType'] : undefined,
    responseType: typeof metadata['responseType'] === 'string' ? metadata['responseType'] : undefined,
    code: typeof metadata['code'] === 'string' ? metadata['code'] : undefined,
    type: typeof metadata['type'] === 'string' ? metadata['type'] : undefined,
    rawResponse: metadata['rawResponse'],
    body: metadata['body']
  })

  return {
    message,
    category: classification.category,
    failureKind: classification.failureKind,
    retryable: classification.retryable,
    ...(classification.quota ? { quota: true } : {}),
    ...(classification.providerWide ? { providerWide: true } : {}),
    ...(classification.blockedReason ? { blockedReason: classification.blockedReason } : {}),
    ...(typeof attemptsMade === 'number' ? { attemptsMade } : {}),
    ...(stage ? { stage } : {}),
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }
}

export const getOcrTargetKey = (target: Pick<OcrTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

const getOcrProviderArtifactDir = (
  target: Pick<OcrTarget, 'service' | 'model'>
): string => `providers/${getOcrTargetDirectoryName(target)}`

export const toRequestedProvider = (target: OcrTarget): OcrRequestedProvider => ({
  service: target.service,
  model: target.model
})

export const parseStoredRequestedTarget = (value: unknown): OcrTarget | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  if (
    value['service'] !== 'tesseract'
    && value['service'] !== 'mistral'
    && value['service'] !== 'glm'
    && value['service'] !== 'kimi'
    && value['service'] !== 'openai'
    && value['service'] !== 'grok'
    && value['service'] !== 'anthropic'
    && value['service'] !== 'gemini'
    && value['service'] !== 'deepinfra'
  ) {
    return undefined
  }

  if (typeof value['model'] !== 'string') {
    return undefined
  }

  return {
    service: value['service'],
    model: value['model']
  }
}

export const parseStoredRequestedTargets = (
  entry: Record<string, unknown>
): OcrTarget[] =>
  parseStoredProviderArray(entry['requestedProviders'], parseStoredRequestedTarget)

const parseStoredProviderState = (value: unknown): OcrProviderState | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const target = parseStoredRequestedTarget(value)
  if (!target) {
    return undefined
  }

  if (value['status'] !== 'succeeded' && value['status'] !== 'missing' && value['status'] !== 'failed' && value['status'] !== 'skipped') {
    return undefined
  }

  if (typeof value['artifactDir'] !== 'string' || typeof value['attempts'] !== 'number') {
    return undefined
  }

  const lastError = parseStoredProviderLastError(value['lastError'], target)

  return {
    service: target.service,
    model: target.model,
    artifactDir: value['artifactDir'],
    status: value['status'],
    attempts: value['attempts'],
    ...(lastError ? { lastError } : {})
  }
}

const parseStoredProviderLastError = (
  value: unknown,
  target: OcrTarget
): OcrRecordedProviderError | undefined => {
  if (!isRecord(value) || typeof value['message'] !== 'string') {
    return undefined
  }

  const storedCategory = typeof value['category'] === 'string' && OCR_PROVIDER_FAILURE_CATEGORIES.has(value['category'] as OcrProviderFailureCategory)
    ? value['category'] as OcrProviderFailureCategory
    : undefined
  const storedFailureKind = typeof value['failureKind'] === 'string' && OCR_PROVIDER_FAILURE_KINDS.has(value['failureKind'] as OcrProviderFailureKind)
    ? value['failureKind'] as OcrProviderFailureKind
    : undefined
  const classification = classifyOcrFailureSummary({
    service: target.service,
    message: value['message'],
    category: storedCategory,
    status: typeof value['status'] === 'number' ? value['status'] : undefined
  })

  return {
    message: sanitizeLogText(value['message']),
    category: storedCategory ?? classification.category,
    failureKind: storedFailureKind ?? classification.failureKind,
    retryable: typeof value['retryable'] === 'boolean' ? value['retryable'] : classification.retryable,
    ...(value['quota'] === true || classification.quota ? { quota: true } : {}),
    ...(value['providerWide'] === true || classification.providerWide ? { providerWide: true } : {}),
    ...(typeof value['blockedReason'] === 'string' ? { blockedReason: sanitizeLogText(value['blockedReason']) } : classification.blockedReason ? { blockedReason: classification.blockedReason } : {}),
    ...(typeof value['stage'] === 'string' ? { stage: value['stage'] } : {}),
    ...(typeof value['status'] === 'number' ? { status: value['status'] } : {}),
    ...(typeof value['retryAfterMs'] === 'number' ? { retryAfterMs: value['retryAfterMs'] } : {}),
    ...(typeof value['errorFile'] === 'string' ? { errorFile: value['errorFile'] } : {}),
    ...(typeof value['rawResponseFile'] === 'string' ? { rawResponseFile: value['rawResponseFile'] } : {})
  }
}

const parseStoredProviderStateMap = (
  entry: Record<string, unknown>
): Map<string, OcrProviderState> =>
  parseStoredProviderStateEntries(entry['providerStates'], parseStoredProviderState)

const parseSuccessfulProviderKeys = (
  entry: Record<string, unknown>
): Set<string> =>
  parseStoredSuccessfulProviderKeys(entry['step2'], (value) => {
    if (!isRecord(value) || typeof value['ocrService'] !== 'string' || typeof value['ocrModel'] !== 'string') {
      return undefined
    }
    return { service: value['ocrService'], model: value['ocrModel'] }
  })

const metadataMatchesTarget = (
  metadata: ExtractionMetadata,
  target: OcrTarget
): boolean => {
  if (metadata.ocrService === target.service && metadata.ocrModel === target.model) {
    return true
  }

  if (target.service === 'tesseract') {
    return metadata.extractionMethod.includes('tesseract')
  }

  return false
}

const parseRootExtractionMetadata = (
  entry: Record<string, unknown>,
  target: OcrTarget
): ExtractionMetadata | undefined => {
  const values = Array.isArray(entry['step2'])
    ? entry['step2']
    : entry['step2'] === undefined
      ? []
      : [entry['step2']]

  for (const value of values) {
    try {
      const metadata = validateData(ExtractionMetadataSchema, value, 'stored OCR metadata')
      if (metadataMatchesTarget(metadata, target)) {
        return metadata
      }
    } catch {
      continue
    }
  }

  return undefined
}

const readRootExtractionResult = async (
  outputDir: string,
  metadata: ExtractionMetadata
): Promise<ExtractionResult | undefined> => {
  const resultPath = join(outputDir, 'result.json')
  if (await Bun.file(resultPath).exists()) {
    try {
      return validateData(ExtractionResultSchema, await Bun.file(resultPath).json(), 'stored OCR result')
    } catch {
      // Fall back to extraction.txt for text-only single-provider outputs.
    }
  }

  const textPath = join(outputDir, 'extraction.txt')
  const text = await Bun.file(textPath).text().catch(() => undefined)
  if (text === undefined) {
    return undefined
  }

  return {
    text,
    pages: [],
    totalPages: metadata.totalPages,
    ocrPages: metadata.ocrPages,
    textPages: metadata.textPages
  }
}

export const inferStoredCompletionStatus = (
  entry: Record<string, unknown>,
  requestedTargets: OcrTarget[]
): ProviderCompletionStatus => {
  const successfulKeys = parseSuccessfulProviderKeys(entry)
  const providerStates = parseStoredProviderStateMap(entry)
  return inferStoredProviderCompletionStatus(
    entry['completionStatus'],
    requestedTargets,
    successfulKeys,
    providerStates,
    (state) => state?.status === 'skipped'
  )
}

export const buildMissingTargetsFromEntry = (
  entry: Record<string, unknown>,
  requestedTargets: OcrTarget[],
  options: { includeBlocked?: boolean | undefined } = {}
): OcrTarget[] => {
  const explicitMissing = parseStoredProviderArray(entry['missingProviders'], parseStoredRequestedTarget)
  const providerStates = parseStoredProviderStateMap(entry)
  const blockedKeys = new Set(
    parseStoredProviderArray(entry['blockedProviders'], parseStoredRequestedTarget)
      .map(getOcrTargetKey)
  )

  const isTargetRerunnable = (
    target: OcrTarget,
    state: OcrProviderState | undefined
  ): boolean => {
    const key = getOcrTargetKey(target)
    if (options.includeBlocked !== true && blockedKeys.has(key)) {
      return false
    }
    return isRerunnableProviderState(state, options)
  }

  const successfulKeys = parseSuccessfulProviderKeys(entry)
  return collectMissingProviderTargets(
    explicitMissing,
    requestedTargets,
    successfulKeys,
    providerStates,
    isTargetRerunnable
  )
}

export const hasOnlyBlockedMissingTargetsFromEntry = (
  entry: Record<string, unknown>,
  requestedTargets: OcrTarget[]
): boolean => {
  const automaticMissingTargets = buildMissingTargetsFromEntry(entry, requestedTargets)
  if (automaticMissingTargets.length > 0) {
    return false
  }

  const missingTargetsIncludingBlocked = buildMissingTargetsFromEntry(entry, requestedTargets, {
    includeBlocked: true
  })
  if (missingTargetsIncludingBlocked.length === 0) {
    return false
  }

  const providerStates = parseStoredProviderStateMap(entry)
  const blockedKeys = new Set(
    parseStoredProviderArray(entry['blockedProviders'], parseStoredRequestedTarget)
      .map(getOcrTargetKey)
  )

  return missingTargetsIncludingBlocked.every((target) => {
    const key = getOcrTargetKey(target)
    return blockedKeys.has(key) || isBlockedOcrProviderState(providerStates.get(key))
  })
}

const isNonSuccessProviderState = (
  state: OcrProviderState | undefined
): boolean =>
  state === undefined || state.status === 'missing' || state.status === 'failed'

export const isBlockedOcrProviderState = (
  state: OcrProviderState | undefined
): boolean =>
  state?.lastError?.retryable === false
  || state?.lastError?.blockedReason !== undefined

const isRerunnableProviderState = (
  state: OcrProviderState | undefined,
  options: { includeBlocked?: boolean | undefined } = {}
): boolean => {
  if (!isNonSuccessProviderState(state)) {
    return false
  }
  return options.includeBlocked === true || !isBlockedOcrProviderState(state)
}

export const readExistingOcrRun = async (
  outputDir: string,
  requestedTargets: OcrTarget[]
): Promise<ExistingOcrRun> => {
  const providerStates = new Map<string, OcrProviderState>()
  const successes: Array<OcrProviderSuccess | undefined> = new Array(requestedTargets.length)
  const successMetadata: Array<ExtractionMetadata | undefined> = new Array(requestedTargets.length)
  const raw = await readOcrRunManifestEntry(outputDir)
  if (!isRecord(raw)) {
    return { successes, successMetadata, providerStates }
  }

  const storedProviderStates = parseStoredProviderStateMap(raw)
  for (const [key, value] of storedProviderStates) {
    providerStates.set(key, value)
  }

  await Promise.all(requestedTargets.map(async (target, index) => {
    const key = getOcrTargetKey(target)
    const providerDir = join(outputDir, getOcrProviderArtifactDir(target))
    const providerResult = await readProviderResultEntry(providerDir)
    if (!providerResult) {
      const metadata = parseRootExtractionMetadata(raw, target)
      if (!metadata) {
        return
      }

      successMetadata[index] = metadata
      if (storedProviderStates.get(key)?.artifactDir === '.') {
        const result = await readRootExtractionResult(outputDir, metadata)
        if (!result) {
          return
        }
        successes[index] = {
          target,
          metadata,
          result,
          relativeDir: '.'
        }
      }
      return
    }

    const metadata = validateData(ExtractionMetadataSchema, providerResult.metadata, 'stored OCR provider metadata')
    const result = validateData(ExtractionResultSchema, providerResult.result, 'stored OCR result')
    successMetadata[index] = metadata

    successes[index] = {
      target,
      metadata,
      result,
      relativeDir: getOcrProviderArtifactDir(target)
    }
  }))

  return {
    successes,
    successMetadata,
    providerStates
  }
}

export const buildProviderStates = (
  requestedTargets: OcrTarget[],
  successes: Array<OcrProviderSuccess | undefined>,
  failuresByIndex: Map<number, OcrProviderFailureSummary>,
  existingStates: Map<string, OcrProviderState>,
  successMetadata: Array<ExtractionMetadata | undefined> = successes.map((entry) => entry?.metadata)
): OcrProviderState[] =>
  requestedTargets.map((target, index) => {
    const key = getOcrTargetKey(target)
    const existing = existingStates.get(key)
    const success = successes[index]
    const failure = failuresByIndex.get(index)

    if (success || successMetadata[index]) {
      return {
        service: target.service,
        model: target.model,
        artifactDir: success?.relativeDir ?? existing?.artifactDir ?? getOcrProviderArtifactDir(target),
        status: 'succeeded',
        attempts: existing?.attempts ?? 1
      }
    }

    if (failure) {
      return {
        service: target.service,
        model: target.model,
        artifactDir: getOcrProviderArtifactDir(target),
        status: 'failed',
        attempts: (existing?.attempts ?? 0) + 1,
        lastError: {
          message: sanitizeLogText(failure.message),
          category: failure.category,
          failureKind: failure.failureKind,
          retryable: failure.retryable,
          ...(failure.quota ? { quota: true } : {}),
          ...(failure.providerWide ? { providerWide: true } : {}),
          ...(failure.blockedReason ? { blockedReason: sanitizeLogText(failure.blockedReason) } : {}),
          ...(failure.stage ? { stage: failure.stage } : {}),
          ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
          ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
          ...(failure.errorFile ? { errorFile: failure.errorFile } : {}),
          ...(failure.rawResponseFile ? { rawResponseFile: failure.rawResponseFile } : {})
        }
      }
    }

    return {
      service: target.service,
      model: target.model,
      artifactDir: getOcrProviderArtifactDir(target),
      status: existing?.status ?? 'missing',
      attempts: existing?.attempts ?? 0,
      ...(existing?.lastError ? { lastError: existing.lastError } : {})
    }
  })

export const resolveCompletionStatus = (
  providerStates: OcrProviderState[]
): ProviderCompletionStatus =>
  resolveProviderCompletionStatus(providerStates, 'complete')

export const buildMissingProviders = (
  providerStates: OcrProviderState[],
  requestedTargets: OcrTarget[]
): OcrRequestedProvider[] =>
  buildRequestedProviderList(
    providerStates,
    requestedTargets,
    isNonSuccessProviderState,
    toRequestedProvider
  )

export const buildBlockedProviders = (
  providerStates: OcrProviderState[],
  requestedTargets: OcrTarget[]
): OcrRequestedProvider[] =>
  buildRequestedProviderList(
    providerStates,
    requestedTargets,
    (state) => isNonSuccessProviderState(state) && isBlockedOcrProviderState(state),
    toRequestedProvider
  )

export const buildMetadataErrorEntries = (
  providerStates: OcrProviderState[]
): NonNullable<OcrMetadataOptions['failures']> =>
  providerStates
    .filter((state): state is OcrProviderState & { lastError: OcrRecordedProviderError & { message: string } } =>
      typeof state.lastError?.message === 'string')
    .map((state) => ({
      service: state.service,
      model: state.model,
      message: state.lastError.message,
      ...(typeof state.lastError.category === 'string' ? { category: state.lastError.category } : {}),
      ...(typeof state.lastError.failureKind === 'string' ? { failureKind: state.lastError.failureKind } : {}),
      ...(typeof state.lastError.retryable === 'boolean' ? { retryable: state.lastError.retryable } : {}),
      ...(state.lastError.quota ? { quota: true } : {}),
      ...(state.lastError.providerWide ? { providerWide: true } : {}),
      ...(state.lastError.blockedReason ? { blockedReason: state.lastError.blockedReason } : {}),
      ...(state.lastError.stage ? { stage: state.lastError.stage } : {}),
      ...(typeof state.lastError.status === 'number' ? { status: state.lastError.status } : {}),
      ...(typeof state.lastError.retryAfterMs === 'number' ? { retryAfterMs: state.lastError.retryAfterMs } : {}),
      ...(state.lastError.errorFile ? { errorFile: state.lastError.errorFile } : {}),
      ...(state.lastError.rawResponseFile ? { rawResponseFile: state.lastError.rawResponseFile } : {})
    }))
