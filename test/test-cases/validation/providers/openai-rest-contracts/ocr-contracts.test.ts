import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { runDeepinfraOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { runGrokOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/grok-ocr/run-grok-ocr'
import { runKimiOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/run-kimi-ocr'
import { runOpenAIOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/openai-ocr/run-openai-ocr'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, withTempDir } from './shared'

installOpenAIRestContractHooks()

describe('OpenAI REST OCR contracts', () => {
  test('OpenAI OCR sends data URLs and returns response usage token metadata', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({
      output_text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'OCR text' }] }),
      usage: { input_tokens: 123, output_tokens: 45 }
    }))

    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'png',
        fileSize: 3
      }

      const result = await runOpenAIOcr(imagePath, metadata, 'gpt-5.5', { baseUrl: 'https://mock.openai.local/v1' })

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'OCR text' }])
      expect(result.promptTokens).toBe(123)
      expect(result.completionTokens).toBe(45)
      expect(calls).toHaveLength(1)
      const input = calls[0]?.bodyJson?.['input'] as Array<Record<string, unknown>>
      const content = input[0]?.['content'] as Array<Record<string, unknown>>
      expect(content[1]).toMatchObject({
        type: 'input_image',
        detail: 'high',
        image_url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
      })
    })
  })

  test('OpenAI OCR uses native structured output for gpt-5.5 multi-page OCR', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({
      output_text: JSON.stringify({
        pages: [
          { pageNumber: 1, text: 'First page' },
          { pageNumber: 2, text: 'Second page' }
        ]
      }),
      usage: { input_tokens: 234, output_tokens: 56 }
    }))

    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'document.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'document',
        pageCount: 2,
        format: 'png',
        fileSize: 3
      }

      const result = await runOpenAIOcr(imagePath, metadata, 'gpt-5.5', { baseUrl: 'https://mock.openai.local/v1' })

      expect(result.pages).toEqual([
        { pageNumber: 1, method: 'ocr', text: 'First page' },
        { pageNumber: 2, method: 'ocr', text: 'Second page' }
      ])
      const body = calls[0]?.bodyJson
      expect(body?.['model']).toBe('gpt-5.5')
      expect(body?.['text']).toMatchObject({
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'ocr_pages',
          strict: true
        }
      })
    })
  })

  test('OpenAI OCR uses native structured output for gpt-5.4-mini multi-page OCR', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({
      output_text: JSON.stringify({
        pages: [
          { pageNumber: 1, text: 'First page' },
          { pageNumber: 2, text: 'Second page' }
        ]
      }),
      usage: { input_tokens: 234, output_tokens: 56 }
    }))

    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'document.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'document',
        pageCount: 2,
        format: 'png',
        fileSize: 3
      }

      const result = await runOpenAIOcr(imagePath, metadata, 'gpt-5.4-mini', { baseUrl: 'https://mock.openai.local/v1' })

      expect(result.pages).toEqual([
        { pageNumber: 1, method: 'ocr', text: 'First page' },
        { pageNumber: 2, method: 'ocr', text: 'Second page' }
      ])
      const body = calls[0]?.bodyJson
      expect(body?.['model']).toBe('gpt-5.4-mini')
      expect(body?.['text']).toMatchObject({
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'ocr_pages',
          strict: true
        }
      })
    })
  })

  test('Grok and DeepInfra OCR preserve their provider-specific chat image payloads', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    process.env['DEEPINFRA_API_KEY'] = 'deepinfra-key'
    const calls = installFetch(() => jsonResponse({
      choices: [{ message: { content: 'Grok OCR text' } }],
      usage: { prompt_tokens: 4000, completion_tokens: 1000 }
    }))

    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'png',
        fileSize: 3
      }

      const result = await runGrokOcr(imagePath, metadata, 'grok-4.20-0309-non-reasoning', {
        dpi: 300,
        password: undefined,
        outputDir: dir,
        ocrPreparationCache: undefined
      }, 'https://mock.x.ai/v1/chat/completions')

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Grok OCR text' }])
      expect(result.promptTokens).toBe(4000)
      expect(result.completionTokens).toBe(1000)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({
        url: 'https://mock.x.ai/v1/chat/completions',
        method: 'POST'
      })
      expect(calls[0]?.headers.get('authorization')).toBe('Bearer xai-key')
      const body = calls[0]?.bodyJson
      expect(body?.['model']).toBe('grok-4.20-0309-non-reasoning')
      const messages = body?.['messages'] as Array<Record<string, unknown>>
      const content = messages[0]?.['content'] as Array<Record<string, unknown>>
      expect(content[0]?.['type']).toBe('text')
      expect(content[1]).toMatchObject({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
        }
      })

      const webpPath = join(dir, 'page.webp')
      await writeFile(webpPath, new Uint8Array([4, 5, 6]))
      await runDeepinfraOcr(webpPath, { ...metadata, format: 'webp' }, 'Qwen/Qwen3-VL-8B-Instruct', {
        dpi: 300,
        password: undefined,
        outputDir: dir,
        ocrPreparationCache: undefined
      })
      expect(calls[1]?.bodyJson?.['max_tokens']).toBe(4092)
      expect(calls[1]?.bodyJson).not.toHaveProperty('max_completion_tokens')
      const deepinfraMessages = calls[1]?.bodyJson?.['messages'] as Array<Record<string, unknown>>
      const deepinfraContent = deepinfraMessages[0]?.['content'] as Array<Record<string, unknown>>
      expect(deepinfraContent[1]).toEqual({
        type: 'image_url',
        image_url: { url: `data:image/webp;base64,${Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')}` }
      })
    })
  })

  test('Kimi OCR preserves its legacy disabled default but delegates explicit default to the provider', async () => {
    process.env['KIMI_API_KEY'] = 'kimi-key'
    const calls = installFetch(() => jsonResponse({
      choices: [{ message: { content: 'Kimi OCR text' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 4232, completion_tokens: 2068 }
    }))

    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'png',
        fileSize: 3
      }
      const result = await runKimiOcr(imagePath, metadata, 'kimi-k2.6', {
        dpi: 300,
        password: undefined,
        outputDir: dir,
        ocrPreparationCache: undefined
      })
      expect(result.promptTokens).toBe(4232)
      expect(result.completionTokens).toBe(2068)
      await runKimiOcr(imagePath, metadata, 'kimi-k2.6', {
        dpi: 300,
        password: undefined,
        outputDir: dir,
        ocrPreparationCache: undefined,
        reasoningEffort: 'default'
      })

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Kimi OCR text' }])
      expect(calls).toHaveLength(2)
      expect(calls[0]?.bodyJson?.['model']).toBe('kimi-k2.6')
      expect(calls[0]?.headers.get('authorization')).toBe('Bearer kimi-key')
      expect(calls[0]?.bodyJson?.['thinking']).toEqual({ type: 'disabled' })
      expect(calls[0]?.bodyJson?.['max_completion_tokens']).toBe(8192)
      expect(calls[1]?.bodyJson).not.toHaveProperty('thinking')
      expect(calls[1]?.bodyJson).not.toHaveProperty('reasoning_effort')
    })
  })

  test('Kimi K3 preserves provider defaults unless named effort is explicit', async () => {
    process.env['KIMI_API_KEY'] = 'kimi-key'
    const calls = installFetch(() => jsonResponse({
      choices: [{ message: { content: 'Kimi K3 OCR text' }, finish_reason: 'stop' }]
    }))

    await withTempDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'png',
        fileSize: 3
      }

      await runKimiOcr(imagePath, metadata, 'kimi-k3', {
        dpi: 300,
        password: undefined,
        outputDir: dir,
        ocrPreparationCache: undefined
      })
      await runKimiOcr(imagePath, metadata, 'kimi-k3', {
        dpi: 300,
        password: undefined,
        outputDir: dir,
        ocrPreparationCache: undefined,
        reasoningEffort: 'high'
      })

      expect(calls[0]?.bodyJson).not.toHaveProperty('thinking')
      expect(calls[0]?.bodyJson).not.toHaveProperty('reasoning_effort')
      expect(calls[1]?.bodyJson).not.toHaveProperty('thinking')
      expect(calls[1]?.bodyJson?.['reasoning_effort']).toBe('high')
    })
  })

  test('OpenAI single-page PDF OCR requests plain text instead of a JSON envelope', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({
      output_text: 'Plain OCR text',
      usage: { input_tokens: 12, output_tokens: 3 }
    }))

    await withTempDir(async (dir) => {
      const pdfPath = join(dir, 'page.pdf')
      await writeFile(pdfPath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'page',
        pageCount: 1,
        format: 'pdf',
        fileSize: 3
      }

      const result = await runOpenAIOcr(pdfPath, metadata, 'gpt-5.5', { baseUrl: 'https://mock.openai.local/v1' })

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'Plain OCR text' }])
      const body = calls[0]?.bodyJson
      expect(body?.['text']).toEqual({ verbosity: 'low' })
      const input = body?.['input'] as Array<Record<string, unknown>>
      const content = input[0]?.['content'] as Array<Record<string, unknown>>
      expect(content[0]?.['text']).toContain('Return only the visible text')
      expect(content[0]?.['text']).not.toContain('Return only JSON')
      expect(content[1]).toMatchObject({
        type: 'input_file',
        filename: 'document.pdf'
      })
    })
  })

  test('OpenAI single-page OCR accepts empty model output as a blank page', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({
      output_text: '',
      usage: { input_tokens: 9, output_tokens: 0 }
    }))

    await withTempDir(async (dir) => {
      const pdfPath = join(dir, 'blank.pdf')
      await writeFile(pdfPath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = {
        slug: 'blank',
        pageCount: 1,
        format: 'pdf',
        fileSize: 3
      }

      const result = await runOpenAIOcr(pdfPath, metadata, 'gpt-5.5', { baseUrl: 'https://mock.openai.local/v1' })

      expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: '' }])
      expect(result.promptTokens).toBe(9)
      expect(result.completionTokens).toBe(0)
      expect(calls).toHaveLength(1)
    })
  })
})
