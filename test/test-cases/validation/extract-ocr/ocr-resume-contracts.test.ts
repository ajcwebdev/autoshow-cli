import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import {
  buildMissingProviders,
  buildMissingTargetsFromEntry,
  buildBlockedProviders,
  buildMetadataErrorEntries,
  classifyOcrProviderFailure,
  resolveCanonicalCompletionStatus,
  parseStoredRequestedTarget,
  readExistingOcrRun,
  resolveCompletionStatus
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import {
  OcrStructuredResponseError,
  writeInvalidOcrStructuredResponse
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import { resolvePrimaryOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { runHostedOcrWithPdfChunkFallback } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback'
import { hasResumableOcrTargetWork, resumeOcrTarget } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { logIncompleteOcrRunSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-runner'
import type { DocumentMetadata, HostedOcrRun, OcrExtractionOptions, OcrProviderState, OcrTarget, PageResult, ProcessDocumentOutput, ResumeTarget } from '~/types'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const requestedTargets: OcrTarget[] = [
  { service: 'tesseract', model: 'tesseract' },
  { service: 'mistral', model: 'mistral-ocr' },
  { service: 'anthropic', model: 'claude-sonnet-5' }
]
const tesseractTarget = requestedTargets[0] as OcrTarget
const mistralTarget = requestedTargets[1] as OcrTarget
const anthropicTarget = requestedTargets[2] as OcrTarget

const basePdfMetadata: DocumentMetadata = {
  slug: 'document',
  pageCount: 4,
  format: 'pdf',
  fileSize: 12_345
}

const pagesForRange = (startPage: number, endPage: number): PageResult[] => {
  const pages: PageResult[] = []
  for (let pageNumber = 1; pageNumber <= endPage - startPage + 1; pageNumber++) {
    pages.push({
      pageNumber,
      method: 'ocr',
      text: `page ${startPage + pageNumber - 1}`
    })
  }
  return pages
}

const hostedRun = (
  pages: PageResult[],
  extras: Partial<HostedOcrRun> = {}
): HostedOcrRun => ({
  pages,
  extractionMethod: 'openai-ocr',
  ocrService: 'openai',
  ocrModel: 'test-model',
  ...extras
})

const pageCachePath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.json`)

const pageTextPath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.txt`)

const writeCachedPage = async (
  dir: string,
  pageNumber: number,
  totalPages: number,
  run: HostedOcrRun = hostedRun([{ pageNumber, method: 'ocr', text: `page ${pageNumber}` }], { totalPages: 1 })
): Promise<void> => {
  await mkdir(join(dir, 'page-results'), { recursive: true })
  await Bun.write(pageCachePath(dir, pageNumber), JSON.stringify({
    version: 2,
    mode: 'single-page',
    totalPages,
    pageNumber,
    sourceFile: 'input.pdf',
    run
  }, null, 2) + '\n')
}

const providerState = (
  target: OcrTarget,
  status: OcrProviderState['status'],
  lastError: OcrProviderState['lastError'] = { message: `${target.service} failed` }
): OcrProviderState => ({
  service: target.service,
  model: target.model,
  artifactDir: `providers/${target.service}-${target.model}`,
  status,
  attempts: status === 'succeeded' ? 1 : 2,
  ...(status === 'failed'
    ? {
        lastError
      }
    : {})
})

const ocrResumeTarget = (dir: string): ResumeTarget => ({
  kind: 'extract',
  extractRoute: 'document',
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

const summaryExtraction = (
  overrides: Partial<ProcessDocumentOutput>
): Parameters<typeof logIncompleteOcrRunSummary>[0] => ({
  outputDir: '/tmp/autoshow-ocr-output',
  completionStatus: 'incomplete',
  requestedProviders: requestedTargets,
  step2Metadata: [{
    extractionMethod: 'mutool+tesseract',
    totalPages: 1,
    ocrPages: 1,
    textPages: 0,
    processingTime: 10,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 12,
    inputFamily: 'pdf'
  }],
  missingProviders: [],
  blockedProviders: [],
  providerStates: [],
  step2Errors: [],
  ...overrides
} as Parameters<typeof logIncompleteOcrRunSummary>[0])

describe('OCR resume contracts', () => {
  test('stored Grok OCR provider is parsed for resume manifests', () => {
    expect(parseStoredRequestedTarget({ service: 'grok', model: 'grok-4.3' })).toEqual({
      service: 'grok',
      model: 'grok-4.3'
    })
  })

  test('stored provider states can complete a stale incomplete OCR manifest', () => {
    const providerStates = [
      providerState(tesseractTarget, 'succeeded'),
      providerState(mistralTarget, 'succeeded'),
      providerState(anthropicTarget, 'succeeded')
    ]
    const entry = {
      completionStatus: 'incomplete',
      requestedProviders: requestedTargets,
      missingProviders: [],
      providerStates
    }

    expect(resolveCanonicalCompletionStatus(entry, requestedTargets)).toBe('full')
    expect(resolveCompletionStatus(providerStates)).toBe('full')
  })

  test('completion requires canonical provider states', () => {
    expect(resolveCanonicalCompletionStatus({}, requestedTargets)).toBe('failed')
  })

  test('existing OCR run reads canonical provider results without provider artifact files', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-root-metadata-')
    try {
      const tesseractMetadata = {
        extractionMethod: 'mutool+tesseract' as const,
        totalPages: 1,
        ocrPages: 1,
        textPages: 0,
        processingTime: 10,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 12,
        inputFamily: 'pdf'
      }
      const anthropicMetadata = {
        extractionMethod: 'pdf+anthropic-ocr' as const,
        totalPages: 1,
        ocrPages: 1,
        textPages: 0,
        processingTime: 20,
        dpi: 300,
        languages: 'eng',
        tokenEstimate: 34,
        ocrService: 'anthropic',
        ocrModel: 'claude-sonnet-5',
        inputFamily: 'pdf'
      }
      const tesseractResult = {
        text: 'Tesseract result.',
        pages: [{ pageNumber: 1, method: 'ocr' as const, text: 'Tesseract result.' }],
        totalPages: 1,
        ocrPages: 1,
        textPages: 0
      }
      const anthropicResult = {
        text: 'Anthropic result.',
        pages: [{ pageNumber: 1, method: 'ocr' as const, text: 'Anthropic result.' }],
        totalPages: 1,
        ocrPages: 1,
        textPages: 0
      }
      await writeSingleManifestFixture(tempDir, 'extract', {
        source: { filePath: '/tmp/document.pdf' },
        completionStatus: 'full',
        requestedProviders: [tesseractTarget, anthropicTarget],
        providerStates: [
          {
            ...providerState(tesseractTarget, 'succeeded'),
            metadata: tesseractMetadata,
            result: tesseractResult
          },
          {
            ...providerState(anthropicTarget, 'succeeded'),
            metadata: anthropicMetadata,
            result: anthropicResult
          }
        ]
      }, { extractRoute: 'document' })

      const existingRun = await readExistingOcrRun(tempDir, [tesseractTarget, anthropicTarget])

      expect(existingRun.successes.map((success) => success?.result)).toEqual([
        tesseractResult,
        anthropicResult
      ])
      expect(existingRun.successMetadata.map((metadata) => metadata?.extractionMethod)).toEqual([
        'mutool+tesseract',
        'pdf+anthropic-ocr'
      ])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('all failed providers remain resumable when explicit missing providers are stored', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [mistralTarget, anthropicTarget],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        providerState(mistralTarget, 'failed'),
        providerState(anthropicTarget, 'failed')
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      mistralTarget,
      anthropicTarget
    ])
  })

  test('all provider failures are written as missing providers', () => {
    const states = [
      providerState(tesseractTarget, 'succeeded'),
      providerState(mistralTarget, 'failed'),
      providerState(anthropicTarget, 'failed')
    ]

    expect(buildMissingProviders(states, requestedTargets)).toEqual([
      mistralTarget,
      anthropicTarget
    ])
  })

  test('checkpoint and final OCR metadata share every provider failure diagnostic', () => {
    const failedState = providerState(mistralTarget, 'failed', {
      message: 'Mistral OCR request failed',
      category: 'rate_limit',
      failureKind: 'rate_limit',
      retryable: true,
      quota: true,
      providerWide: true,
      blockedReason: 'quota',
      stage: 'extract:mistral',
      status: 429,
      retryAfterMs: 12_000,
      errorFile: 'providers/mistral/error.json',
      rawResponseFile: 'providers/mistral/raw-response.txt'
    })

    const checkpointFailures = buildMetadataErrorEntries([failedState])
    const finalizedFailures = buildMetadataErrorEntries([failedState])

    expect(checkpointFailures).toEqual(finalizedFailures)
    expect(checkpointFailures).toEqual([{
      service: mistralTarget.service,
      model: mistralTarget.model,
      message: 'Mistral OCR request failed',
      category: 'rate_limit',
      failureKind: 'rate_limit',
      retryable: true,
      quota: true,
      providerWide: true,
      blockedReason: 'quota',
      stage: 'extract:mistral',
      status: 429,
      retryAfterMs: 12_000,
      errorFile: 'providers/mistral/error.json',
      rawResponseFile: 'providers/mistral/raw-response.txt'
    }])
  })

  test('blocked provider failures remain missing but are excluded from automatic resume', () => {
    const blockedAnthropic = providerState(anthropicTarget, 'failed', {
      message: 'Anthropic Messages request failed (400): Output blocked by content filtering policy',
      category: 'content_policy',
      failureKind: 'content_policy',
      retryable: false,
      providerWide: true,
      blockedReason: 'content_policy',
      status: 400
    })
    const states = [
      providerState(tesseractTarget, 'succeeded'),
      providerState(mistralTarget, 'failed'),
      blockedAnthropic
    ]
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [mistralTarget, anthropicTarget],
      providerStates: states
    }

    expect(buildMissingProviders(states, requestedTargets)).toEqual([
      mistralTarget,
      anthropicTarget
    ])
    expect(buildBlockedProviders(states, requestedTargets)).toEqual([
      anthropicTarget
    ])
    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      mistralTarget
    ])
    expect(buildMissingTargetsFromEntry(entry, requestedTargets, { includeBlocked: true })).toEqual([
      mistralTarget,
      anthropicTarget
    ])
    expect(resolveCompletionStatus(states)).toBe('incomplete')
  })

  test('automatic resume reports blocked-only OCR manifests without advertising retry', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-blocked-resume-')
    try {
      const blockedAnthropic = providerState(anthropicTarget, 'failed', {
        message: 'Anthropic Messages request failed (400): Output blocked by content filtering policy',
        category: 'content_policy',
        failureKind: 'content_policy',
        retryable: false,
        providerWide: true,
        blockedReason: 'content_policy',
        status: 400
      })
      await writeSingleManifestFixture(tempDir, 'extract', {
        source: { filePath: '/tmp/document.pdf' },
        completionStatus: 'incomplete',
        requestedProviders: [tesseractTarget, anthropicTarget],
        missingProviders: [anthropicTarget],
        blockedProviders: [anthropicTarget],
        providerStates: [
          providerState(tesseractTarget, 'succeeded'),
          blockedAnthropic
        ]
      }, { extractRoute: 'document' })

      await expect(hasResumableOcrTargetWork(ocrResumeTarget(tempDir), undefined)).resolves.toBe(false)
      await expect(hasResumableOcrTargetWork(ocrResumeTarget(tempDir), [anthropicTarget])).resolves.toBe(true)

      const { events } = await captureLogEvents(async () => {
        await resumeOcrTarget(ocrResumeTarget(tempDir), {} as OcrExtractionOptions)
      })
      const resumeItem = events.find((event) => event.message === 'Resume Item')

      expect(resumeItem?.metadata?.['detail']).toBe('only blocked OCR providers remain')
      expect(JSON.stringify(events)).not.toContain('no matching failed or missing providers selected')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('blocked-only OCR summary uses outputDir and suppresses automatic retry command', async () => {
    const { events } = await captureLogEvents(() => {
      logIncompleteOcrRunSummary(summaryExtraction({
        outputDir: '/tmp/autoshow-ocr-blocked',
        missingProviders: [anthropicTarget],
        blockedProviders: [anthropicTarget],
        step2Errors: [{
          ...anthropicTarget,
          message: 'Anthropic Messages request failed (400): Output blocked by content filtering policy',
          category: 'content_policy',
          failureKind: 'content_policy',
          retryable: false,
          providerWide: true,
          blockedReason: 'content_policy',
          errorFile: 'providers/anthropic/error.json'
        }]
      }), true)
    })

    const locations = events.find((event) => event.message === 'Locations')
    expect(locations?.humanTable?.rows).toContainEqual({
      artifact: 'outputDir',
      path: '/tmp/autoshow-ocr-blocked'
    })
    expect(events.some((event) => event.message === 'Retry OCR')).toBe(false)
    expect(events.some((event) => event.message === 'Blocked OCR Providers')).toBe(true)
    expect(JSON.stringify(events)).not.toContain('retryOutputDir')
  })

  test('retryable OCR summary keeps retry output and resume command', async () => {
    const { events } = await captureLogEvents(() => {
      logIncompleteOcrRunSummary(summaryExtraction({
        outputDir: '/tmp/autoshow-ocr-retryable',
        missingProviders: [mistralTarget],
        step2Errors: [{
          ...mistralTarget,
          message: 'Mistral OCR request timed out',
          category: 'timeout',
          failureKind: 'timeout',
          retryable: true,
          errorFile: 'providers/mistral/error.json'
        }]
      }), true)
    })

    const locations = events.find((event) => event.message === 'Locations')
    const retry = events.find((event) => event.message === 'Retry OCR')
    expect(locations?.humanTable?.rows).toContainEqual({
      artifact: 'retryOutputDir',
      path: '/tmp/autoshow-ocr-retryable'
    })
    expect(retry?.humanTable?.rows).toContainEqual({
      key: 'command',
      value: 'bun autoshow resume <retryOutputDir>'
    })
  })

  test('provider failure summary surfaces attempts, fallback page counts, and terminal reason', async () => {
    const { events } = await captureLogEvents(() => {
      logIncompleteOcrRunSummary(summaryExtraction({
        outputDir: '/tmp/autoshow-ocr-fallback-audit',
        missingProviders: [anthropicTarget],
        blockedProviders: [anthropicTarget],
        step2Errors: [{
          ...anthropicTarget,
          message: 'Anthropic Messages request failed (400): Output blocked by content filtering policy',
          category: 'content_policy',
          failureKind: 'content_policy',
          retryable: false,
          providerWide: true,
          blockedReason: 'content_policy',
          attemptsMade: 4,
          fallbackPages: { cached: 1, resumed: 0, succeeded: 14, failed: 1, canceled: 4 },
          fallbackTerminalReason: 'content_policy',
          errorFile: 'providers/anthropic/error.json'
        }]
      }), true)
    })

    const failuresEvent = events.find((event) => event.message === 'Provider Failures')
    expect(failuresEvent?.humanTable?.rows).toContainEqual(expect.objectContaining({
      provider: `${anthropicTarget.service}/${anthropicTarget.model}`,
      retryable: 'no',
      attempts: '4',
      pages: '15 ok / 1 failed / 4 canceled'
    }))
    expect(failuresEvent?.humanTable?.details).toContainEqual({
      label: `${anthropicTarget.service}/${anthropicTarget.model} fallback`,
      value: 'content_policy'
    })
  })

  test('provider failure summary omits attempts and page columns when audit fields are absent', async () => {
    const { events } = await captureLogEvents(() => {
      logIncompleteOcrRunSummary(summaryExtraction({
        outputDir: '/tmp/autoshow-ocr-no-audit',
        missingProviders: [mistralTarget],
        step2Errors: [{
          ...mistralTarget,
          message: 'Mistral OCR request timed out',
          category: 'timeout',
          failureKind: 'timeout',
          retryable: true,
          errorFile: 'providers/mistral/error.json'
        }]
      }), true)
    })

    const failuresEvent = events.find((event) => event.message === 'Provider Failures')
    expect(failuresEvent?.humanTable?.rows).toContainEqual(expect.objectContaining({
      provider: `${mistralTarget.service}/${mistralTarget.model}`,
      retryable: 'yes',
      attempts: '',
      pages: ''
    }))
    expect(events.some((event) => event.message === 'Retry OCR')).toBe(true)
  })

  test('resume targets include all failed providers even when missingProviders omits them', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [mistralTarget],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        providerState(mistralTarget, 'failed'),
        providerState(anthropicTarget, 'failed')
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      mistralTarget,
      anthropicTarget
    ])
  })

  test('resume targets detect failed providers from providerStates when missingProviders is empty', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        providerState(mistralTarget, 'failed'),
        providerState(anthropicTarget, 'succeeded')
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      mistralTarget
    ])
  })

  test('hosted PDF page fallback resume skips cached pages and starts at the first missing page', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-page-resume-')
    try {
      await writeCachedPage(tempDir, 1, 4)
      await writeCachedPage(tempDir, 2, 4)

      let fullAttempts = 0
      const attemptedPages: number[] = []
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: basePdfMetadata,
        serviceLabel: 'Test OCR',
        totalPages: 4,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      // Pages run concurrently, so attemptedPages records completion order; compare as a set.
      expect([...attemptedPages].sort((a, b) => a - b)).toEqual([3, 4])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4])
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('page 1\n')
      expect(await Bun.file(pageTextPath(tempDir, 4)).text()).toBe('page 4\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 4\npage 4')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF fallback state bypasses full-document OCR even before page results exist', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-fallback-state-')
    try {
      await Bun.write(join(tempDir, 'fallback-state.json'), JSON.stringify({
        version: 2,
        mode: 'single-page',
        totalPages: 2,
        serviceLabel: 'Test OCR',
        sourceFile: 'input.pdf'
      }, null, 2) + '\n')

      let fullAttempts = 0
      const attemptedPages: number[] = []
      await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      expect([...attemptedPages].sort((a, b) => a - b)).toEqual([1, 2])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('v1 hosted PDF fallback state misses cleanly and runs full-document OCR', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-fallback-state-v1-')
    try {
      await Bun.write(join(tempDir, 'fallback-state.json'), JSON.stringify({
        version: 1,
        mode: 'single-page',
        totalPages: 2,
        serviceLabel: 'Test OCR',
        sourceFile: 'input.pdf'
      }, null, 2) + '\n')

      let fullAttempts = 0
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          return hostedRun(pagesForRange(1, 2), { totalPages: 2 })
        },
        createChunk: async () => {
          throw new Error('v1 fallback state must not enter page mode')
        },
        runChunk: async () => {
          throw new Error('v1 fallback state must not call the provider page path')
        }
      })

      expect(fullAttempts).toBe(1)
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF page fallback ignores corrupt or mismatched page cache files', async () => {
    const tempDir = await makeTempDir('autoshow-ocr-page-cache-invalid-')
    try {
      await mkdir(join(tempDir, 'page-results'), { recursive: true })
      await Bun.write(pageCachePath(tempDir, 1), '{bad json')
      await writeCachedPage(
        tempDir,
        2,
        3,
        hostedRun([{ pageNumber: 99, method: 'ocr', text: 'wrong page' }], { totalPages: 1 })
      )
      await writeCachedPage(tempDir, 3, 3)

      let fullAttempts = 0
      const attemptedPages: number[] = []
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 3 },
        serviceLabel: 'Test OCR',
        totalPages: 3,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      expect([...attemptedPages].sort((a, b) => a - b)).toEqual([1, 2])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('content filter failures are classified by category', () => {
    const failure = classifyOcrProviderFailure(new Error(
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Output blocked by content filtering policy"}}'
    ))

    expect(failure.category).toBe('content_policy')
    expect(failure.message).toContain('Output blocked by content filtering policy')
  })

  test('transient OCR failures are classified by category', () => {
    const error = ProviderError('provider timed out while reading OCR response', { status: 503 })

    const failure = classifyOcrProviderFailure(error)
    expect(failure.category).toBe('timeout')
  })

  test('structured OCR validation failures persist raw provider output', async () => {
    const failure = classifyOcrProviderFailure(new OcrStructuredResponseError(
      'OpenAI OCR response was not valid JSON.',
      '{"pages":'
    ))
    const tempDir = await makeTempDir('autoshow-ocr-structured-error-')
    try {
      await writeInvalidOcrStructuredResponse(tempDir, new OcrStructuredResponseError(
        'OpenAI OCR response was not valid JSON.',
        '{"pages":'
      ))
      expect(failure.category).toBe('structured_response')
      expect(await Bun.file(join(tempDir, 'invalid-structured-response.txt')).text()).toBe('{"pages":')
      const diagnostic = await Bun.file(join(tempDir, 'invalid-structured-response.json')).json() as Record<string, unknown>
      expect(diagnostic['rawResponseFile']).toBe('invalid-structured-response.txt')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('primary OCR service-only match succeeds when unique', () => {
    expect(resolvePrimaryOcrTarget(requestedTargets, 'mistral')).toEqual(mistralTarget)
  })

  test('primary OCR service/model exact match succeeds', () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.5' }
    ]

    expect(resolvePrimaryOcrTarget(targets, 'openai/gpt-5.5')).toEqual(targets[1])
  })

  test('primary OCR unknown or ambiguous values fail', () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.5' }
    ]

    expect(() => resolvePrimaryOcrTarget(targets, 'gemini')).toThrow('--primary-ocr gemini does not match')
    expect(() => resolvePrimaryOcrTarget(targets, 'openai')).toThrow('matches multiple')
  })

  test('stored OCR targets include current hosted provider set', () => {
    expect(parseStoredRequestedTarget({ service: 'deepinfra', model: 'Qwen/Qwen3-VL-30B-A3B-Instruct' })).toEqual({
      service: 'deepinfra',
      model: 'Qwen/Qwen3-VL-30B-A3B-Instruct'
    })
  })
})
