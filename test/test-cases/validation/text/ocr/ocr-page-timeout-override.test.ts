import { describe, expect, spyOn, test } from 'bun:test'
import { join } from 'node:path'
import { withOcrPageRequestRetry } from '~/cli/commands/text/ocr/ocr-utils/ocr-retry'
import { runGrokOcr } from '~/cli/commands/text/ocr/ocr-services/grok-ocr/run-grok-ocr'
import { runDeepinfraOcr } from '~/cli/commands/text/ocr/ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const setting = 'AUTOSHOW_OCR_PAGE_REQUEST_TIMEOUT_MS'
const lifecycle = setupContractSuiteLifecycle({ envKeys: [setting, 'XAI_API_KEY', 'DEEPINFRA_API_KEY'], tempPrefix: 'autoshow-ocr-timeout-' })
const metadata = { format: 'png' as const, fileSize: redDotPng.length, slug: 'synthetic', pageCount: 1 }
const response = () => Response.json({ choices: [{ message: { content: 'Mock OCR text' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } })

describe('bounded OCR page request deadline configuration', () => {
  test('actual Grok and DeepInfra adapters retain the five-minute default, select the override and reset without changing native request controls', async () => {
    process.env['XAI_API_KEY'] = 'nonbillable-test-key'; process.env['DEEPINFRA_API_KEY'] = 'nonbillable-test-key'
    const deadlines: number[] = [], nativeTimeout = AbortSignal.timeout.bind(AbortSignal)
    const timeout = spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => { deadlines.push(milliseconds); return nativeTimeout(milliseconds) })
    try {
      const calls = installMockFetch(() => response())
      await lifecycle.withDir(async dir => {
        const path = join(dir, 'image.png'); await Bun.write(path, redDotPng)
        for (const [run, model, endpoint, ceiling] of [[runGrokOcr, 'grok-4.7', 'https://api.x.ai/v1/chat/completions', 'max_completion_tokens'],
          [runDeepinfraOcr, 'google/gemma-4-31B-it', 'https://api.deepinfra.com/v1/openai/chat/completions', 'max_tokens']] as const) {
          for (const configured of [undefined, '900000', undefined]) {
            if (configured === undefined) delete process.env[setting]; else process.env[setting] = configured
            const result = await run(path, metadata, model, { dpi: 300, outputDir: dir })
            expect(result.pages[0]?.text).toBe('Mock OCR text')
            expect(calls.at(-1)?.url).toBe(endpoint)
            expect(calls.at(-1)?.bodyJson?.[ceiling]).toBe(ceiling === 'max_tokens' ? 8192 : 4096)
          }
        }
      })
      expect(deadlines).toEqual([300000, 900000, 300000, 300000, 900000, 300000])
      expect(calls[0]?.bodyJson).toEqual(calls[1]?.bodyJson); expect(calls[0]?.bodyJson).toEqual(calls[2]?.bodyJson)
      expect(calls[3]?.bodyJson).toEqual(calls[4]?.bodyJson); expect(calls[3]?.bodyJson).toEqual(calls[5]?.bodyJson)
    } finally { timeout.mockRestore() }
  })
  test('a selected short environment deadline really aborts native fetch and never automatically redispatches an ambiguous timeout', async () => {
    process.env['XAI_API_KEY'] = 'nonbillable-test-key'; process.env[setting] = '10'
    let abortObserved = false
    const calls = installMockFetch((_call, _input, init) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) return reject(new Error('Native request omitted timeout signal'))
      const abort = () => { abortObserved = true; reject(signal.reason) }
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true })
    }))
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'image.png'); await Bun.write(path, redDotPng)
      await expect(runGrokOcr(path, metadata, 'grok-4.7', { dpi: 300, outputDir: dir })).rejects.toThrow()
      expect(abortObserved).toBe(true); expect(calls).toHaveLength(1)
    })
  })
  test('invalid environment values reject through the real native adapter before fetch', async () => {
    process.env['DEEPINFRA_API_KEY'] = 'nonbillable-test-key'
    const calls = installMockFetch(() => { throw new Error('Unexpected provider dispatch') })
    await lifecycle.withDir(async dir => {
      const path = join(dir, 'image.png'); await Bun.write(path, redDotPng)
      for (const invalid of ['', '0', '-1', '900001', '1.5', 'NaN', 'Infinity', '1e3', ' 1000', '1000ms']) {
        process.env[setting] = invalid
        await expect(runDeepinfraOcr(path, metadata, 'google/gemma-4-31B-it', { dpi: 300, outputDir: dir })).rejects.toThrow('must be an integer from 1 to 900000')
      }
      expect(calls).toHaveLength(0)
    })
  })
  test('explicit caller timeout has precedence even when unused environment configuration is invalid', async () => {
    process.env[setting] = 'invalid'
    const deadlines: number[] = [], nativeTimeout = AbortSignal.timeout.bind(AbortSignal)
    const timeout = spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => { deadlines.push(milliseconds); return nativeTimeout(milliseconds) })
    try {
      expect(await withOcrPageRequestRetry('local caller override', async () => 'complete', { timeoutMs: 250 })).toBe('complete')
      expect(deadlines).toEqual([250])
    } finally { timeout.mockRestore() }
  })
  test('the environment override retains caller cancellation and does not dispatch an already-aborted operation', async () => {
    process.env[setting] = '900000'
    const controller = new AbortController(), reason = new Error('Caller cancelled OCR')
    controller.abort(reason)
    let calls = 0
    await expect(withOcrPageRequestRetry('pre-aborted operation', async () => { calls++; return 'unexpected' }, { abortSignal: controller.signal })).rejects.toThrow('Caller cancelled OCR')
    expect(calls).toBe(0)
    const active = new AbortController()
    const pending = withOcrPageRequestRetry('active operation', signal => new Promise<string>((_resolve, reject) => {
      calls++; signal!.addEventListener('abort', () => reject(signal!.reason), { once: true }); active.abort(reason)
    }), { abortSignal: active.signal })
    await expect(pending).rejects.toThrow('Caller cancelled OCR')
    expect(calls).toBe(1)
  })
})
