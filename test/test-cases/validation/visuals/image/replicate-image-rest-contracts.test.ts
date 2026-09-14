import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runReplicateImageGen } from '~/cli/commands/visuals/image/image-generation-services/replicate/run-replicate-image-gen'
import { expectProviderHttpError, installMockFetch, jsonResponse } from '../../../../test-utils/rest-contract-helpers'
import { extractErrorMetadata } from '~/utils/error-handler'
import { imageResponse, setupImageRestContractLifecycle } from './image-rest-contract-fixtures'

const { withDir: withTempDir } = setupImageRestContractLifecycle()

describe('replicate image rest contracts', () => {
  test('Replicate Seedream 5 Lite creates a synchronous prediction and downloads the returned image', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'pred-sync',
          model: 'bytedance/seedream-5-lite',
          status: 'succeeded',
          output: ['https://mock.replicate.local/out/result.jpg'],
          urls: { get: 'https://mock.replicate.local/v1/predictions/pred-sync' }
        })
      }
      return imageResponse(new Uint8Array([1, 2, 3]), 'image/jpeg')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      const refBytes = new Uint8Array([7, 8, 9])
      await writeFile(refPath, refBytes)

      const result = await runReplicateImageGen('A cinematic still life', dir, {
        model: 'bytedance/seedream-5-lite',
        inputs: [refPath],
        imageSize: '2K',
        aspectRatio: '16:9',
        outputFormat: 'jpeg'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.jpg')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'replicate',
        imageModel: 'bytedance/seedream-5-lite',
        imageCount: 1,
        imageFileNames: ['generated-image.jpg'],
        imageSize: '2K',
        imageFormat: 'jpg',
        requestMode: 'edit',
        providerCostCents: 3.5,
        providerCostSource: 'registry_fallback'
      })
      expect(await Bun.file(result.imagePaths[0] as string).exists()).toBe(true)
    })

    expect(calls[0]).toMatchObject({
      url: 'https://api.replicate.com/v1/models/bytedance/seedream-5-lite/predictions',
      method: 'POST'
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer replicate-token')
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
    expect(calls[0]?.headers.get('prefer')).toBe('wait=60')
    expect(calls[0]?.bodyJson).toEqual({
      input: {
        prompt: 'A cinematic still life',
        sequential_image_generation: 'disabled',
        max_images: 1,
        image_input: [`data:image/png;base64,${Buffer.from(new Uint8Array([7, 8, 9])).toString('base64')}`],
        size: '2K',
        aspect_ratio: '16:9',
        output_format: 'jpeg'
      }
    })
    expect(calls[1]?.url).toBe('https://mock.replicate.local/out/result.jpg')
    expect(calls[1]?.headers.get('accept')).toBe('image/*,*/*;q=0.8')
  })

  test('Replicate Qwen polls unfinished predictions and accepts string output URLs', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'pred-async',
          status: 'processing',
          urls: { get: 'https://mock.replicate.local/v1/predictions/pred-async' }
        })
      }
      if (call.url === 'https://mock.replicate.local/v1/predictions/pred-async') {
        return jsonResponse({
          id: 'pred-async',
          model: 'alibaba/qwen-image-3-pro',
          status: 'succeeded',
          output: 'https://mock.replicate.local/out/qwen.png'
        })
      }
      return imageResponse(new Uint8Array([4, 5, 6]), 'image/png')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.webp')
      const refBytes = new Uint8Array([3, 3, 3])
      await writeFile(refPath, refBytes)

      const result = await runReplicateImageGen('Restyle this product image', dir, {
        model: 'alibaba/qwen-image-3-pro',
        inputs: [refPath],
        aspectRatio: '1:1'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.png')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'replicate',
        imageModel: 'alibaba/qwen-image-3-pro',
        imageCount: 1,
        imageFileNames: ['generated-image.png'],
        imageFormat: 'png',
        requestMode: 'edit',
        providerCostCents: 4,
        providerCostSource: 'registry_fallback'
      })
    })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.replicate.com/v1/models/alibaba/qwen-image-3-pro/predictions',
      'GET https://mock.replicate.local/v1/predictions/pred-async',
      'GET https://mock.replicate.local/out/qwen.png'
    ])
    expect(calls[0]?.bodyJson).toEqual({
      input: {
        prompt: 'Restyle this product image',
        match_input_image: true,
        image: `data:image/webp;base64,${Buffer.from(new Uint8Array([3, 3, 3])).toString('base64')}`,
        aspect_ratio: '1:1'
      }
    })
  })

  test('Replicate Qwen Image 3 maps a single reference without size', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'pred-qwen',
          status: 'succeeded',
          output: ['https://mock.replicate.local/out/one.png'],
          urls: { get: 'https://mock.replicate.local/v1/predictions/pred-qwen' }
        })
      }
      return imageResponse(new Uint8Array([8, 8, 8]), 'image/png')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.bmp')
      const refBytes = new Uint8Array([5, 5, 5])
      await writeFile(refPath, refBytes)

      const result = await runReplicateImageGen('Create a campaign image', dir, {
        model: 'alibaba/qwen-image-3',
        inputs: [refPath],
        aspectRatio: '16:9'
      })

      expect(result.imagePaths[0]?.endsWith('.png')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'replicate',
        imageModel: 'alibaba/qwen-image-3',
        imageCount: 1,
        imageFileNames: ['generated-image.png'],
        imageFormat: 'png',
        requestMode: 'edit',
        providerCostCents: 3,
        providerCostSource: 'registry_fallback'
      })
    })

    expect(calls[0]?.bodyJson).toEqual({
      input: {
        prompt: 'Create a campaign image',
        match_input_image: true,
        image: `data:image/bmp;base64,${Buffer.from(new Uint8Array([5, 5, 5])).toString('base64')}`,
        aspect_ratio: '16:9'
      }
    })
    expect(calls.slice(1).map((call) => call.url)).toEqual([
      'https://mock.replicate.local/out/one.png'
    ])
  })

  test('Replicate Seedream 5 Pro maps resolution, format, and reference images', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'pred-seedream-pro',
          status: 'succeeded',
          output: ['https://mock.replicate.local/out/seedream-pro.png']
        })
      }
      return imageResponse(new Uint8Array([1, 3, 5]), 'image/png')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, new Uint8Array([9, 8, 7]))
      const result = await runReplicateImageGen('Preserve this product design', dir, {
        model: 'bytedance/seedream-5-pro',
        inputs: [refPath],
        imageSize: '2K',
        aspectRatio: '1:1',
        outputFormat: 'png'
      })
      expect(result.metadata).toMatchObject({ imageModel: 'bytedance/seedream-5-pro', imageSize: '2K', imageFormat: 'png', requestMode: 'edit', providerCostCents: 9 })
    })

    expect(calls[0]?.url).toBe('https://api.replicate.com/v1/models/bytedance/seedream-5-pro/predictions')
    expect(calls[0]?.bodyJson).toEqual({
      input: {
        prompt: 'Preserve this product design',
        sequential_image_generation: 'disabled',
        max_images: 1,
        image_input: [`data:image/png;base64,${Buffer.from(new Uint8Array([9, 8, 7])).toString('base64')}`],
        size: '2K',
        aspect_ratio: '1:1',
        output_format: 'png'
      }
    })
  })

  test('Replicate terminal failures surface prediction errors without polling', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'pred-failed',
          status: 'failed',
          error: 'prompt rejected',
          urls: { get: 'https://mock.replicate.local/v1/predictions/pred-failed' }
        })
      }
      throw new Error(`Unexpected Replicate fetch after terminal failure: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      await expect(runReplicateImageGen('Blocked prompt', dir, {
        model: 'alibaba/qwen-image-3'
      })).rejects.toThrow('terminal failure - prompt rejected')
    })

    expect(calls).toHaveLength(1)
  })

  test('Replicate REST failures retain bounded diagnostics without exposing provider secrets', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const secret = 'replicate-secret-key-123456'
    installMockFetch(() => jsonResponse({
      error: {
        message: 'invalid request',
        api_key: secret,
        request_id: 'req_secret123456789'
      }
    }, { status: 400 }))

    await withTempDir(async (dir) => {
      const error = await expectProviderHttpError(
        () => runReplicateImageGen('Rejected prompt', dir, {
          model: 'alibaba/qwen-image-3'
        }),
        { status: 400 }
      )
      const metadata = extractErrorMetadata(error)
      const serialized = JSON.stringify({
        rawResponse: metadata['rawResponse'],
        metadata,
        bodyPreview: metadata['bodyPreview']
      })
      expect(serialized).not.toContain(secret)
      expect(serialized).toContain('REDACTED')
      expect(metadata['bodyBytes']).toBeGreaterThan(0)
      expect(metadata['bodyTruncated']).toBe(false)
    })
  })
})
