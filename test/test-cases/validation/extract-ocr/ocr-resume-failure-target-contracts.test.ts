import { describe, expect, test } from 'bun:test'
import { ProviderError } from '~/utils/error-handler'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { classifyOcrProviderFailure, parseStoredRequestedTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import { OcrStructuredResponseError, writeInvalidOcrStructuredResponse } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import { resolvePrimaryOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import type { OcrTarget } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'
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
