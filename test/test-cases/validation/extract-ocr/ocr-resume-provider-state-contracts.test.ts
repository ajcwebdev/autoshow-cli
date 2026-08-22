import { describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { buildMissingProviders, buildMissingTargetsFromEntry, buildBlockedProviders, buildMetadataErrorEntries, resolveCanonicalCompletionStatus, parseStoredRequestedTarget, readExistingOcrRun, resolveCompletionStatus } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { anthropicTarget, mistralTarget, providerState, requestedTargets, tesseractTarget } from './ocr-resume-fixture'

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
})
