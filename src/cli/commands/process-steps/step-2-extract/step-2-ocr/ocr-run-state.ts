import { isRecord } from '~/utils/rest-client'
import { join } from 'node:path'
import type { ExistingOcrRun, ExtractionMetadata, ExtractionResult, ProviderCompletionStatus, OcrProviderErrorLike, OcrProviderFailureCategory, OcrProviderFailureKind, OcrProviderFailureSummary, OcrProviderState, OcrProviderSuccess, OcrRecordedProviderError, OcrRequestedProvider, OcrTarget } from '~/types'
import { ExtractionMetadataSchema, ExtractionResultSchema } from '~/types'
import { collectErrorChain, extractErrorMetadata } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'
import { parseRetryAfterMs } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { readProviderResultEntry } from '../../manifest-utils'
import { readOcrRunManifestEntry } from './ocr-manifest'
import { getOcrTargetDirectoryName } from './ocr-targets'
import { classifyOcrFailureSummary } from './ocr-utils/ocr-failure-classifier'


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
  Array.isArray(entry['requestedProviders'])
    ? entry['requestedProviders'].map(parseStoredRequestedTarget).filter((target): target is OcrTarget => target !== undefined)
    : []

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
): Map<string, OcrProviderState> => {
  const states = new Map<string, OcrProviderState>()
  const values = Array.isArray(entry['providerStates']) ? entry['providerStates'] : []
  for (const value of values) {
    const parsed = parseStoredProviderState(value)
    if (!parsed) {
      continue
    }
    states.set(getOcrTargetKey(parsed), parsed)
  }
  return states
}

const parseSuccessfulProviderKeys = (
  entry: Record<string, unknown>
): Set<string> => {
  const values = Array.isArray(entry['step2'])
    ? entry['step2']
    : entry['step2'] === undefined
      ? []
      : [entry['step2']]

  const keys = new Set<string>()
  for (const value of values) {
    if (!isRecord(value) || typeof value['ocrService'] !== 'string' || typeof value['ocrModel'] !== 'string') {
      continue
    }
    keys.add(`${value['ocrService']}:${value['ocrModel']}`)
  }

  return keys
}

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
  if (providerStates.size > 0) {
    return resolveCompletionStatusFromState(requestedTargets, successfulKeys, providerStates)
  }

  if (entry['completionStatus'] === 'full' || entry['completionStatus'] === 'incomplete' || entry['completionStatus'] === 'failed') {
    return entry['completionStatus']
  }

  const successCount = successfulKeys.size
  if (successCount === 0) {
    return 'failed'
  }
  return successCount === requestedTargets.length ? 'full' : 'incomplete'
}

export const buildMissingTargetsFromEntry = (
  entry: Record<string, unknown>,
  requestedTargets: OcrTarget[],
  options: { includeBlocked?: boolean | undefined } = {}
): OcrTarget[] => {
  const explicitMissing = Array.isArray(entry['missingProviders'])
    ? entry['missingProviders'].map(parseStoredRequestedTarget).filter((target): target is OcrTarget => target !== undefined)
    : []
  const missingTargets = new Map<string, OcrTarget>()
  const providerStates = parseStoredProviderStateMap(entry)
  const blockedKeys = new Set(
    (Array.isArray(entry['blockedProviders']) ? entry['blockedProviders'] : [])
      .map(parseStoredRequestedTarget)
      .filter((target): target is OcrTarget => target !== undefined)
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

  for (const target of explicitMissing) {
    const state = providerStates.get(getOcrTargetKey(target))
    if (isTargetRerunnable(target, state)) {
      missingTargets.set(getOcrTargetKey(target), target)
    }
  }

  const successfulKeys = parseSuccessfulProviderKeys(entry)
  for (const target of requestedTargets) {
    const key = getOcrTargetKey(target)
    if (successfulKeys.has(key)) {
      continue
    }

    const state = providerStates.get(key)
    if (isTargetRerunnable(target, state)) {
      missingTargets.set(key, target)
    }
  }

  return [...missingTargets.values()]
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
    (Array.isArray(entry['blockedProviders']) ? entry['blockedProviders'] : [])
      .map(parseStoredRequestedTarget)
      .filter((target): target is OcrTarget => target !== undefined)
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

const resolveCompletionStatusFromState = (
  requestedTargets: OcrTarget[],
  successfulKeys: Set<string>,
  providerStates: Map<string, OcrProviderState>
): ProviderCompletionStatus => {
  let succeeded = 0
  let incomplete = 0

  for (const target of requestedTargets) {
    const key = getOcrTargetKey(target)
    const state = providerStates.get(key)
    if (state?.status === 'skipped') {
      continue
    }

    if (successfulKeys.has(key) || state?.status === 'succeeded') {
      succeeded += 1
      continue
    }

    incomplete += 1
  }

  if (succeeded === 0) {
    return 'failed'
  }

  return incomplete === 0 ? 'full' : 'incomplete'
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
): ProviderCompletionStatus => {
  const succeeded = providerStates.filter((state) => state.status === 'succeeded').length
  if (succeeded === 0) {
    return 'failed'
  }

  return providerStates.every((state) => state.status === 'succeeded' || state.status === 'skipped')
    ? 'full'
    : 'incomplete'
}

export const buildMissingProviders = (
  providerStates: OcrProviderState[],
  requestedTargets: OcrTarget[]
): OcrRequestedProvider[] => {
  const missingKeys = new Set(
    providerStates
      .filter(isNonSuccessProviderState)
      .map((state) => getOcrTargetKey(state))
  )

  return requestedTargets
    .filter((target) => missingKeys.has(getOcrTargetKey(target)))
    .map(toRequestedProvider)
}

export const buildBlockedProviders = (
  providerStates: OcrProviderState[],
  requestedTargets: OcrTarget[]
): OcrRequestedProvider[] => {
  const blockedKeys = new Set(
    providerStates
      .filter((state) => isNonSuccessProviderState(state) && isBlockedOcrProviderState(state))
      .map((state) => getOcrTargetKey(state))
  )

  return requestedTargets
    .filter((target) => blockedKeys.has(getOcrTargetKey(target)))
    .map(toRequestedProvider)
}

export const buildMetadataErrorEntries = (
  providerStates: OcrProviderState[]
): Array<Record<string, unknown>> =>
  providerStates
    .filter((state) => state.lastError !== undefined)
    .map((state) => ({
      service: state.service,
      model: state.model,
      message: state.lastError?.message,
      category: state.lastError?.category,
      failureKind: state.lastError?.failureKind,
      retryable: state.lastError?.retryable,
      ...(state.lastError?.quota ? { quota: true } : {}),
      ...(state.lastError?.providerWide ? { providerWide: true } : {}),
      ...(state.lastError?.blockedReason ? { blockedReason: state.lastError.blockedReason } : {}),
      ...(state.lastError?.stage ? { stage: state.lastError.stage } : {}),
      ...(typeof state.lastError?.status === 'number' ? { status: state.lastError.status } : {}),
      ...(typeof state.lastError?.retryAfterMs === 'number' ? { retryAfterMs: state.lastError.retryAfterMs } : {}),
      ...(state.lastError?.errorFile ? { errorFile: state.lastError.errorFile } : {}),
      ...(state.lastError?.rawResponseFile ? { rawResponseFile: state.lastError.rawResponseFile } : {})
    }))
