import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runGrokImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-grok/run-grok-image-gen'
import { runOpenAIImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-openai/run-openai-image-gen'
import { createImage } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/comic-image-targets'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, withTempDir } from './shared'

installOpenAIRestContractHooks()

describe('OpenAI REST image contracts', () => {
  test('OpenAI image generation decodes b64_json output and preserves image options', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const imageBytes = new Uint8Array([9, 8, 7])
    const calls = installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }]
    }))

    await withTempDir(async (dir) => {
      const result = await runOpenAIImageGen('A test image', dir, {
        model: 'gpt-image-2',
        size: '1024x1024',
        quality: 'high',
        outputFormat: 'webp',
        background: 'opaque'
      })

      expect(result.imagePaths).toHaveLength(1)
      expect(new Uint8Array(await Bun.file(result.imagePaths[0]!).arrayBuffer())).toEqual(imageBytes)
      expect(result.metadata).toMatchObject({
        imageService: 'openai',
        imageModel: 'gpt-image-2',
        imageFileNames: ['generated-image.webp'],
        imageSize: '1024x1024',
        imageQuality: 'high',
        imageFormat: 'webp'
      })
    })

    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'gpt-image-2',
      prompt: 'A test image',
      n: 1,
      size: '1024x1024',
      quality: 'high',
      output_format: 'webp',
      background: 'opaque',
      moderation: 'low'
    })
  })

  test('OpenAI image generation writes multiple returned images', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const firstImage = new Uint8Array([1, 2, 3])
    const secondImage = new Uint8Array([4, 5, 6])
    const calls = installFetch(() => jsonResponse({
      data: [
        { b64_json: Buffer.from(firstImage).toString('base64'), revised_prompt: 'A refined prompt' },
        { b64_json: Buffer.from(secondImage).toString('base64') }
      ],
      model: 'gpt-image-2-actual'
    }))

    await withTempDir(async (dir) => {
      const result = await runOpenAIImageGen('A test image', dir, {
        model: 'gpt-image-2',
        count: 2,
        outputFormat: 'png'
      })

      expect(result.imagePaths.map((imagePath) => imagePath.endsWith('.png'))).toEqual([true, true])
      expect(result.metadata).toMatchObject({
        imageService: 'openai',
        imageModel: 'gpt-image-2',
        imageCount: 2,
        imageFileNames: ['generated-image.png', 'generated-image-2.png'],
        revisedPrompt: 'A refined prompt',
        providerReturnedModel: 'gpt-image-2-actual',
        requestMode: 'generation'
      })
    })

    expect(calls[0]?.bodyJson).toMatchObject({
      n: 2
    })
  })

  test('OpenAI image edit routes through multipart edits endpoint', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const imageBytes = new Uint8Array([7, 7, 7])
    const calls = installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }]
    }))

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, new Uint8Array([1, 2, 3]))

      const result = await runOpenAIImageGen('Edit this image', dir, {
        model: 'gpt-image-2',
        mode: 'edit',
        inputs: [refPath],
        count: 1,
        outputFormat: 'webp',
        compression: 75
      })

      expect(result.metadata.requestMode).toBe('edit')
      expect(result.metadata.imageFileNames).toEqual(['generated-image.webp'])
    })

    expect(calls[0]).toMatchObject({
      url: 'https://api.openai.com/v1/images/edits',
      method: 'POST'
    })
    expect(calls[0]?.form?.get('model')).toBe('gpt-image-2')
    expect(calls[0]?.form?.get('prompt')).toBe('Edit this image')
    expect(calls[0]?.form?.get('moderation')).toBe('low')
    expect(calls[0]?.form?.get('output_compression')).toBe('75')
    expect(calls[0]?.form?.getAll('image')).toHaveLength(1)
  })

  test('OpenAI image edit with multiple references uses the image[] array field', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const imageBytes = new Uint8Array([5, 5, 5])
    const calls = installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }]
    }))

    await withTempDir(async (dir) => {
      const firstRef = join(dir, 'front.png')
      const secondRef = join(dir, 'profile.png')
      await writeFile(firstRef, new Uint8Array([1, 2, 3]))
      await writeFile(secondRef, new Uint8Array([4, 5, 6]))

      await runOpenAIImageGen('Keep character design consistent.', dir, {
        model: 'gpt-image-2',
        mode: 'edit',
        inputs: [firstRef, secondRef],
        count: 1
      })
    })

    expect(calls[0]?.form?.getAll('image')).toHaveLength(0)
    const images = calls[0]?.form?.getAll('image[]') ?? []
    expect(images).toHaveLength(2)
    expect(images.every((image) => image instanceof File)).toBe(true)
  })

  test('OpenAI image edit captures returned usage as unit metadata', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const imageBytes = new Uint8Array([3, 3, 3])
    installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }],
      usage: {
        total_tokens: 7565,
        input_tokens: 1325,
        output_tokens: 6240,
        input_tokens_details: { text_tokens: 35, image_tokens: 1290 }
      }
    }))

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, new Uint8Array([1, 2, 3]))

      const result = await runOpenAIImageGen('Edit with usage', dir, {
        model: 'gpt-image-2',
        mode: 'edit',
        inputs: [refPath]
      })

      expect(result.metadata).toMatchObject({
        requestMode: 'edit',
        imageInputUnits: 1290,
        textInputUnits: 35,
        totalInputUnits: 1325,
        outputUnits: 6240,
        totalUnits: 7565
      })
    })
  })

  test('OpenAI image generation ignores missing or malformed usage fields', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const imageBytes = new Uint8Array([2, 2, 2])
    installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }],
      usage: { input_tokens: 'many', output_tokens: 512, input_tokens_details: null }
    }))

    await withTempDir(async (dir) => {
      const result = await runOpenAIImageGen('A test image', dir, { model: 'gpt-image-2' })
      expect(result.metadata.outputUnits).toBe(512)
      expect('imageInputUnits' in result.metadata).toBe(false)
      expect('textInputUnits' in result.metadata).toBe(false)
      expect('totalInputUnits' in result.metadata).toBe(false)
      expect('totalUnits' in result.metadata).toBe(false)
    })
  })

  test('comic createImage attaches the OpenAI edit usage to the generated image response', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const imageBytes = new Uint8Array([4, 4, 4])
    const referenceBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const calls = installFetch(() => jsonResponse({
      data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }],
      usage: {
        total_tokens: 7565,
        input_tokens: 1325,
        output_tokens: 6240,
        input_tokens_details: { text_tokens: 35, image_tokens: 1290 }
      }
    }))

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, referenceBytes)

      const response = await createImage('Edit with usage', [refPath], 'gpt-image-2', '1536x1024', 'high')

      expect(response.mode).toBe('edit')
      expect(response.result.imageBase64).toBe(Buffer.from(imageBytes).toString('base64'))
      expect(response.result.mimeType).toBe('image/png')
      expect(response.usage).toEqual({
        imageInputUnits: 1290,
        textInputUnits: 35,
        totalInputUnits: 1325,
        outputUnits: 6240,
        totalUnits: 7565
      })
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toContain('/images/edits')
    expect(calls[0]?.form?.get('model')).toBe('gpt-image-2')
  })

  test('comic createImage omits usage when the provider returns none', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const imageBytes = new Uint8Array([5, 5, 5])
    installFetch(() => jsonResponse({ data: [{ b64_json: Buffer.from(imageBytes).toString('base64') }] }))

    await withTempDir(async () => {
      const response = await createImage('Generate without usage', [], 'gpt-image-2', '1536x1024', 'high')
      expect(response.mode).toBe('generate')
      expect('usage' in response).toBe(false)
    })
  })

  test('Grok image generation captures provider usage cost and returned model metadata', async () => {
    process.env['XAI_API_KEY'] = 'xai-key'
    const imageBytes = new Uint8Array([9, 9, 9])
    const calls = installFetch(() => jsonResponse({
      data: [{
        b64_json: Buffer.from(imageBytes).toString('base64'),
        mime_type: 'image/jpeg',
        revised_prompt: 'A sharper prompt',
        respect_moderation: true
      }],
      model: 'grok-imagine-image-quality-actual',
      usage: { cost_in_usd_ticks: 200_000_000 }
    }))

    await withTempDir(async (dir) => {
      const result = await runGrokImageGen('A test image', dir, {
        model: 'grok-imagine-image-quality',
        count: 2,
        aspectRatio: '16:9',
        imageSize: '2K'
      })

      expect(result.metadata).toMatchObject({
        imageService: 'grok',
        imageModel: 'grok-imagine-image-quality',
        imageCount: 1,
        imageFileNames: ['generated-image.jpg'],
        revisedPrompt: 'A sharper prompt',
        providerReturnedModel: 'grok-imagine-image-quality-actual',
        usageCostRaw: 200_000_000,
        providerCostCents: 2,
        providerCostSource: 'provider_usage',
        providerModeration: true,
        requestMode: 'generation'
      })
    })

    expect(calls[0]?.url).toBe('https://api.x.ai/v1/images/generations')
    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'grok-imagine-image-quality',
      n: 2,
      aspect_ratio: '16:9',
      resolution: '2k'
    })
  })
})
