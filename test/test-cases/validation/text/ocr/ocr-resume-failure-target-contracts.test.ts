import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { classifyOcrProviderFailure, parseStoredRequestedTarget } from '~/cli/commands/text/ocr/ocr-run-state'
import { OcrStructuredResponseError, writeInvalidOcrStructuredResponse } from '~/cli/commands/text/ocr/ocr-structured-response-error'
import { buildExtractionOptionsForTarget, resolvePrimaryOcrTarget } from '~/cli/commands/text/ocr/ocr-targets'
import type { ExtractionOptions, OcrTarget } from '~/types'
import { hostedOcrAdapterForEngine, hostedOcrAdapterForService } from '~/cli/commands/text/ocr/hosted-ocr-adapters'
import { resolveHostedDirectImageInputStrategy } from '~/cli/commands/text/ocr/hosted-ocr'
import { collectOcrProviderSpecs } from '~/cli/commands/text/ocr/ocr-cli'
import { hasHostedOcr, hasOcrFlag, countSelectedOcrEngines, getHostedOcrEngine } from '~/cli/commands/text/ocr/ocr-engine-selection'
import { resolveOcrExtractionOptions } from '~/cli/commands/text/ocr/ocr-extraction-options'
import { runHostedOcr } from '~/cli/commands/text/ocr/hosted-ocr'
import { runOcr } from '~/cli/commands/text/ocr/run-ocr'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { mistralTarget, requestedTargets } from './ocr-resume-fixture'

describe('OCR resume contracts', () => {
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
      { service: 'openai', model: 'gpt-6-luna' },
      { service: 'openai', model: 'gpt-6.1-sol' }
    ]

    expect(resolvePrimaryOcrTarget(targets, 'openai/gpt-6.1-sol')).toEqual(targets[1])
  })

  test('primary OCR unknown or ambiguous values fail', () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-6-luna' },
      { service: 'openai', model: 'gpt-6.1-sol' }
    ]

    expect(() => resolvePrimaryOcrTarget(targets, 'gemini')).toThrow('--primary-ocr gemini does not match')
    expect(() => resolvePrimaryOcrTarget(targets, 'openai')).toThrow('matches multiple')
  })

  test('stored OCR targets include current hosted provider set', () => {
    expect(parseStoredRequestedTarget({ service: 'deepinfra', model: 'google/gemma-4-31B-it' })).toEqual({
      service: 'deepinfra',
      model: 'google/gemma-4-31B-it'
    })
  })

  for (const archived of [
    { service: 'glm', model: 'glm-5.3-flash', engine: 'glm-ocr' },
    { service: 'kimi', model: 'kimi-k3', engine: 'kimi-ocr' }
  ] as const) {
    test(`archived ${archived.service} targets remain readable and cannot be dispatched`, () => {
      const target = parseStoredRequestedTarget(archived)
      expect(target).toEqual({ service: archived.service, model: archived.model })
      expect(() => buildExtractionOptionsForTarget({} as ExtractionOptions, target as OcrTarget)).toThrow('is no longer implemented')
      expect(() => hostedOcrAdapterForService(archived.service)).toThrow('is no longer implemented')
      expect(() => hostedOcrAdapterForEngine(archived.engine)).toThrow('is no longer implemented')
      expect(resolveHostedDirectImageInputStrategy('png', archived.engine)).toBe('unsupported')
    })
  }

  for (const obsolete of [
    { glmOcrModel: 'glm-5.3-flash' },
    { glmOcrModels: ['glm-5.3-flash'] },
    { kimiOcrModel: 'kimi-k3' },
    { kimiOcrModels: ['kimi-k3'] }
  ]) {
    test(`obsolete ${Object.keys(obsolete)[0]} options reject before local extraction or HTTP`, async () => {
      const options = {
        ...resolveOcrExtractionOptions('/virtual/missing.png', {
          useTesseract: true, openaiOcrModel: 'gpt-6.1-sol'
        }, '/virtual/unused', 'auto'),
        useTesseract: true,
        ...obsolete
      }
      const metadata = { slug: 'page', format: 'png', fileSize: 4, pageCount: 1 } as const
      expect(() => collectOcrProviderSpecs(options)).toThrow('no longer supported')
      expect(() => resolveOcrExtractionOptions(options.filePath, options, options.outputDir, 'auto')).toThrow('no longer supported')
      expect(() => hasHostedOcr(options)).toThrow('no longer supported')
      expect(() => hasOcrFlag(options)).toThrow('no longer supported')
      expect(() => countSelectedOcrEngines(options)).toThrow('no longer supported')
      expect(() => getHostedOcrEngine(options)).toThrow('no longer supported')
      await expect(runHostedOcr(options.filePath, metadata, options)).rejects.toThrow('no longer supported')
      await expect(runOcr(options.filePath, metadata, options)).rejects.toThrow('no longer supported')
    })
  }
})
