import { describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { hasResumableOcrTargetWork, resumeOcrTarget } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { logIncompleteOcrRunSummary } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-runner'
import type { OcrExtractionOptions } from '~/types'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { anthropicTarget, mistralTarget, ocrResumeTarget, providerState, summaryExtraction, tesseractTarget } from './ocr-resume-fixture'

describe('OCR resume contracts', () => {
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
})
