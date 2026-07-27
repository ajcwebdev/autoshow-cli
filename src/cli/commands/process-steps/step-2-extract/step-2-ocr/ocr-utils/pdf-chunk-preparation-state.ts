import type {
  OcrPdfChunkRange,
  PdfChunkDisabledToolSummary,
  PdfChunkPreparationState,
  PdfChunkPreparationSummary,
  PdfChunkPreparationToolSummary,
  PdfChunkSplitAttempt,
  PdfChunkSplitResult,
  PdfChunkSplitTool
} from '~/types'
import { summarizePdfChunkCreateCause } from './pdf-chunk-fallback-shared'

const DIRECT_SPLIT_FAILURES_BEFORE_RASTER_ONLY = 2
const TOOL_FALLBACK_SUCCESSES_BEFORE_DISABLE = 2

const createAsyncGate = (): (<T>(task: () => Promise<T>) => Promise<T>) => {
  let tail = Promise.resolve()

  return async <T>(task: () => Promise<T>): Promise<T> => {
    const previous = tail
    let release = (): void => {}
    tail = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await task()
    } finally {
      release()
    }
  }
}

export const createPdfChunkPreparationState = (): PdfChunkPreparationState => ({
  mode: 'adaptive',
  directPageAttempts: 0,
  directSuccesses: 0,
  directFailures: 0,
  rasterizedPages: 0,
  toolAttempts: {
    qpdf: 0,
    mutool: 0
  },
  toolExitCodes: {
    qpdf: {},
    mutool: {}
  },
  toolFallbackSuccessExitCodes: {
    qpdf: {},
    mutool: {}
  },
  toolPaths: {},
  toolSources: {},
  toolFailureKinds: {},
  toolFailureMessages: {},
  disabledTools: {},
  runExclusiveDirectProbe: createAsyncGate()
})

export const recordSplitAttempts = (
  state: PdfChunkPreparationState,
  attempts: readonly PdfChunkSplitAttempt[] | undefined
): void => {
  for (const attempt of attempts ?? []) {
    state.toolAttempts[attempt.tool] += 1
    const exitCode = String(attempt.exitCode)
    state.toolExitCodes[attempt.tool][exitCode] = (state.toolExitCodes[attempt.tool][exitCode] ?? 0) + 1
    if (attempt.path && !state.toolPaths[attempt.tool]) {
      state.toolPaths[attempt.tool] = attempt.path
    }
    if (attempt.source && !state.toolSources[attempt.tool]) {
      state.toolSources[attempt.tool] = attempt.source
    }
    if (attempt.failureKind && !state.toolFailureKinds[attempt.tool]) {
      state.toolFailureKinds[attempt.tool] = attempt.failureKind
    }
    if (attempt.message && !state.toolFailureMessages[attempt.tool]) {
      state.toolFailureMessages[attempt.tool] = attempt.message
    }
  }
}

const getLastSplitAttempt = (result: PdfChunkSplitResult): PdfChunkSplitAttempt => {
  const attempts = result.attempts ?? []
  return attempts[attempts.length - 1] ?? { tool: result.tool, exitCode: result.exitCode }
}

export const getPrimarySplitFailureAttempt = (result: PdfChunkSplitResult): PdfChunkSplitAttempt => {
  const attempts = result.attempts ?? []
  return attempts.find((attempt) => attempt.failureKind === 'qpdf_launch_failure')
    ?? attempts.find((attempt) => attempt.failureKind === 'mutool_unsupported_document')
    ?? attempts.find((attempt) => attempt.failureKind === 'qpdf_unavailable')
    ?? [...attempts].reverse().find((attempt) => attempt.exitCode !== 0)
    ?? getLastSplitAttempt(result)
}

export const summarizeSplitFailureMessage = (result: PdfChunkSplitResult): string =>
  getPrimarySplitFailureAttempt(result).message ?? summarizePdfChunkCreateCause(result.stderr, result.stdout)

const shouldDisableDirectSplittingImmediately = (result: PdfChunkSplitResult): boolean => {
  const primary = getPrimarySplitFailureAttempt(result)
  return primary.failureKind === 'qpdf_launch_failure'
    || primary.failureKind === 'mutool_unsupported_document'
}

const buildToolSummaries = (state: PdfChunkPreparationState): PdfChunkPreparationToolSummary[] =>
  (['qpdf', 'mutool'] as const)
    .filter((tool) => state.toolAttempts[tool] > 0)
    .map((tool) => ({
      tool,
      attempts: state.toolAttempts[tool],
      exitCodes: { ...state.toolExitCodes[tool] },
      ...(state.toolPaths[tool] ? { path: state.toolPaths[tool] } : {}),
      ...(state.toolSources[tool] ? { source: state.toolSources[tool] } : {}),
      ...(state.toolFailureKinds[tool] ? { failureKind: state.toolFailureKinds[tool] } : {}),
      ...(state.toolFailureMessages[tool] ? { message: state.toolFailureMessages[tool] } : {})
    }))

const buildDisabledToolSummaries = (state: PdfChunkPreparationState): PdfChunkDisabledToolSummary[] =>
  (['qpdf', 'mutool'] as const)
    .map((tool) => state.disabledTools[tool])
    .filter((summary): summary is PdfChunkDisabledToolSummary => summary !== undefined)

export const getDisabledSplitTools = (state: PdfChunkPreparationState): PdfChunkSplitTool[] =>
  buildDisabledToolSummaries(state).map((summary) => summary.tool)

export const summarizePdfChunkPreparation = (
  state: PdfChunkPreparationState | undefined
): PdfChunkPreparationSummary | undefined => {
  if (state === undefined) {
    return undefined
  }
  const disabledToolSummaries = buildDisabledToolSummaries(state)

  return {
    strategy: state.mode,
    directPageAttempts: state.directPageAttempts,
    directSuccesses: state.directSuccesses,
    directFailures: state.directFailures,
    rasterizedPages: state.rasterizedPages,
    directSplittingDisabled: state.mode === 'raster-only',
    ...(state.directSplittingDisabledAtPage !== undefined ? { disabledAtPage: state.directSplittingDisabledAtPage } : {}),
    tools: buildToolSummaries(state),
    ...(disabledToolSummaries.length > 0 ? { disabledTools: disabledToolSummaries } : {}),
    ...(state.lastDirectFailure !== undefined ? { lastDirectFailure: state.lastDirectFailure } : {})
  }
}

export const recordAdaptiveDirectSuccess = (state: PdfChunkPreparationState): void => {
  state.directSuccesses += 1
  if (state.mode === 'adaptive' && state.directFailures === 0) {
    state.mode = 'direct'
  }
}

const getHardQpdfFailureAttempt = (
  attempts: readonly PdfChunkSplitAttempt[] | undefined
): PdfChunkSplitAttempt | undefined =>
  attempts?.find((attempt) =>
    attempt.tool === 'qpdf'
    && attempt.exitCode !== 0
    && attempt.exitCode !== 3
  )

export const recordToolFallbackSuccess = (
  state: PdfChunkPreparationState,
  range: OcrPdfChunkRange,
  result: PdfChunkSplitResult
): void => {
  if (state.disabledTools.qpdf !== undefined || result.tool !== 'mutool') {
    return
  }

  const qpdfFailure = getHardQpdfFailureAttempt(result.attempts)
  if (!qpdfFailure) {
    return
  }

  const exitCode = String(qpdfFailure.exitCode)
  const counts = state.toolFallbackSuccessExitCodes.qpdf
  const count = (counts[exitCode] ?? 0) + 1
  counts[exitCode] = count

  if (count < TOOL_FALLBACK_SUCCESSES_BEFORE_DISABLE) {
    return
  }

  state.disabledTools.qpdf = {
    tool: 'qpdf',
    disabledAtPage: range.startPage,
    exitCode: qpdfFailure.exitCode,
    fallbackTool: 'mutool',
    reason: `qpdf exited ${qpdfFailure.exitCode} ${count} times while mutool created PDF page chunks`
  }
}

export const recordAdaptiveDirectFailure = (
  state: PdfChunkPreparationState,
  range: OcrPdfChunkRange,
  result: PdfChunkSplitResult,
  onDirectSplittingDisabled?: (summary: PdfChunkPreparationSummary) => void
): void => {
  state.directFailures += 1

  const lastAttempt = getPrimarySplitFailureAttempt(result)
  state.lastDirectFailure = {
    pageNumber: range.startPage,
    tool: lastAttempt.tool,
    exitCode: lastAttempt.exitCode,
    ...(lastAttempt.path ? { path: lastAttempt.path } : {}),
    ...(lastAttempt.source ? { source: lastAttempt.source } : {}),
    ...(lastAttempt.failureKind ? { failureKind: lastAttempt.failureKind } : {}),
    message: summarizeSplitFailureMessage(result)
  }

  if (shouldDisableDirectSplittingImmediately(result) || state.directFailures >= DIRECT_SPLIT_FAILURES_BEFORE_RASTER_ONLY) {
    if (state.mode !== 'raster-only') {
      state.mode = 'raster-only'
      state.directSplittingDisabledAtPage = range.startPage
      const summary = summarizePdfChunkPreparation(state)
      if (summary !== undefined) {
        onDirectSplittingDisabled?.(summary)
      }
    }
    return
  }

  if (state.mode === 'direct') {
    state.mode = 'adaptive'
  }
}
