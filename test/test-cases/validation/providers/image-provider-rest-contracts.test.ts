import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runBflImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/bfl/run-bfl-image-gen'
import { runLumalabsImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/lumalabs/run-lumalabs-image-gen'
import { runReplicateImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/replicate/run-replicate-image-gen'
import {
  bytesResponse,
  expectProviderHttpError,
  installMockFetch,
  jsonResponse,
  setupContractSuiteLifecycle
} from '../../../test-utils/rest-contract-helpers'
import { extractErrorMetadata } from '~/utils/error-handler'

const envKeys = [
  'BFL_API_KEY',
  'LUMA_AGENTS_API_KEY',
  'REPLICATE_API_TOKEN'
]
const tempDirs = setupContractSuiteLifecycle({
  envKeys,
  tempPrefix: 'autoshow-image-provider-rest-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})

const imageResponse = (
  bytes: Uint8Array,
  contentType: string,
  headers?: Record<string, string>
): Response => bytesResponse(bytes, { headers: { 'content-type': contentType, ...headers } })

const withTempDir = tempDirs.withDir

describe('image provider REST contracts', () => {
  test('BFL image generation sends numbered reference image fields', async () => {
    process.env['BFL_API_KEY'] = 'bfl-key'
    let pollAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'bfl-request',
          polling_url: 'https://mock.bfl.local/poll',
          cost: 0.5
        })
      }
      if (call.url === 'https://mock.bfl.local/poll') {
        pollAttempts += 1
        if (pollAttempts === 1) {
          return jsonResponse({ error: 'temporary outage' }, { status: 503 })
        }
        return jsonResponse({
          status: 'Ready',
          result: { sample: 'https://mock.bfl.local/result.jpeg' },
          cost: 0.5
        })
      }
      return imageResponse(new Uint8Array([9, 8, 7]), 'image/jpeg')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, new Uint8Array([1, 2, 3]))

      const result = await runBflImageGen('Edit with references', dir, {
        model: 'flux-2-klein-4b',
        outputFormat: 'png',
        inputs: [refPath, 'https://cdn.example.com/reference.webp']
      })

      expect(result.metadata.requestMode).toBe('edit')
      expect(result.metadata.imageFileNames).toEqual(['generated-image.png'])
    })

    expect(calls[0]).toMatchObject({
      url: 'https://api.bfl.ai/v1/flux-2-klein-4b',
      method: 'POST'
    })
    expect(calls[0]?.bodyJson).toMatchObject({
      prompt: 'Edit with references',
      output_format: 'png',
      input_image_2: 'https://cdn.example.com/reference.webp'
    })
    expect(String(calls[0]?.bodyJson?.['input_image'])).toBe(`data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`)
    expect(calls.filter((call) => call.url === 'https://mock.bfl.local/poll')).toHaveLength(2)
  })

  test('Luma Labs image generation retries a transient polling failure', async () => {
    process.env['LUMA_AGENTS_API_KEY'] = 'luma-key'
    const baseUrl = 'https://agents.lumalabs.ai/v1'
    let pollAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.url === `${baseUrl}/generations` && call.method === 'POST') {
        return jsonResponse({ id: 'luma-image-1', state: 'queued' })
      }
      if (call.url === `${baseUrl}/generations/luma-image-1`) {
        pollAttempts += 1
        if (pollAttempts === 1) {
          return jsonResponse({ error: 'temporary outage' }, { status: 503 })
        }
        return jsonResponse({
          id: 'luma-image-1',
          state: 'completed',
          output: [{ type: 'image', url: 'https://mock.luma.local/result.png' }]
        })
      }
      if (call.url === 'https://mock.luma.local/result.png') {
        return imageResponse(new Uint8Array([9, 8, 7]), 'image/png')
      }
      throw new Error(`Unexpected Luma Labs image fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runLumalabsImageGen('A stable image', dir, {
        model: 'uni-1'
      })

      expect(await Bun.file(result.imagePaths[0]!).exists()).toBe(true)
    })

    expect(calls.filter((call) => call.url === `${baseUrl}/generations/luma-image-1`)).toHaveLength(2)
  })

  test('BFL image result download retries transient 504 responses', async () => {
    process.env['BFL_API_KEY'] = 'bfl-key'
    let resultDownloadAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'bfl-request',
          polling_url: 'https://mock.bfl.local/poll',
          cost: 0.5
        })
      }
      if (call.url === 'https://mock.bfl.local/poll') {
        return jsonResponse({
          status: 'Ready',
          result: { sample: 'https://mock.bfl.local/result.jpeg' },
          cost: 0.5
        })
      }
      if (call.url === 'https://mock.bfl.local/result.jpeg') {
        resultDownloadAttempts += 1
        if (resultDownloadAttempts === 1) {
          return new Response('gateway timeout', {
            status: 504,
            headers: { 'retry-after': '0.001' }
          })
        }
        return imageResponse(new Uint8Array([9, 8, 7]), 'image/jpeg')
      }
      throw new Error(`Unexpected BFL image fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const result = await runBflImageGen('Generate a stable image', dir, {
        model: 'flux-2-flex',
        outputFormat: 'jpeg'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.jpg')).toBe(true)
      expect(await Bun.file(result.imagePaths[0] as string).exists()).toBe(true)
    })

    const downloadCalls = calls.filter((call) => call.url === 'https://mock.bfl.local/result.jpeg')
    expect(downloadCalls).toHaveLength(2)
    expect(downloadCalls[0]?.headers.get('accept')).toBe('image/jpeg,image/*;q=0.9,*/*;q=0.8')
  })

  test('Replicate Seedream creates a synchronous prediction and downloads the returned image', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'pred-sync',
          model: 'bytedance/seedream-4.5',
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
        model: 'bytedance/seedream-4.5',
        inputs: [refPath],
        imageSize: '1536x1024',
        aspectRatio: '16:9'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.jpg')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'replicate',
        imageModel: 'bytedance/seedream-4.5',
        imageCount: 1,
        imageFileNames: ['generated-image.jpg'],
        imageSize: '1536x1024',
        imageFormat: 'jpg',
        requestMode: 'edit',
        providerCostCents: 4,
        providerCostSource: 'registry_fallback'
      })
      expect(await Bun.file(result.imagePaths[0] as string).exists()).toBe(true)
    })

    expect(calls[0]).toMatchObject({
      url: 'https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions',
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
        size: 'custom',
        width: 1536,
        height: 1024,
        aspect_ratio: '16:9'
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
          model: 'qwen/qwen-image-2-pro',
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
        model: 'qwen/qwen-image-2-pro',
        inputs: [refPath],
        aspectRatio: '1:1'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.png')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'replicate',
        imageModel: 'qwen/qwen-image-2-pro',
        imageCount: 1,
        imageFileNames: ['generated-image.png'],
        imageFormat: 'png',
        requestMode: 'edit',
        providerCostCents: 7.5,
        providerCostSource: 'registry_fallback'
      })
    })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.replicate.com/v1/models/qwen/qwen-image-2-pro/predictions',
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

  test('Replicate Wan maps custom size, input images, and multiple outputs', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          id: 'pred-wan',
          status: 'succeeded',
          output: [
            'https://mock.replicate.local/out/one.png',
            'https://mock.replicate.local/out/two.png',
            'https://mock.replicate.local/out/three.png'
          ],
          urls: { get: 'https://mock.replicate.local/v1/predictions/pred-wan' }
        })
      }
      return imageResponse(new Uint8Array([8, 8, 8]), 'image/png')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.bmp')
      const refBytes = new Uint8Array([5, 5, 5])
      await writeFile(refPath, refBytes)

      const result = await runReplicateImageGen('Create a campaign image set', dir, {
        model: 'wan-video/wan-2.7-image',
        inputs: [refPath, 'https://cdn.example.com/reference.png'],
        imageSize: '1920x1080',
        count: 3
      })

      expect(result.imagePaths.map((path) => path.endsWith('.png'))).toEqual([true, true, true])
      expect(result.metadata).toMatchObject({
        imageService: 'replicate',
        imageModel: 'wan-video/wan-2.7-image',
        imageCount: 3,
        imageFileNames: ['generated-image.png', 'generated-image-2.png', 'generated-image-3.png'],
        imageSize: '1920x1080',
        imageFormat: 'png',
        requestMode: 'edit',
        providerCostCents: 9,
        providerCostSource: 'registry_fallback'
      })
    })

    expect(calls[0]?.bodyJson).toEqual({
      input: {
        prompt: 'Create a campaign image set',
        images: [
          `data:image/bmp;base64,${Buffer.from(new Uint8Array([5, 5, 5])).toString('base64')}`,
          'https://cdn.example.com/reference.png'
        ],
        size: '1920*1080',
        num_outputs: 3
      }
    })
    expect(calls.slice(1).map((call) => call.url)).toEqual([
      'https://mock.replicate.local/out/one.png',
      'https://mock.replicate.local/out/two.png',
      'https://mock.replicate.local/out/three.png'
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
        model: 'wan-video/wan-2.7-image'
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
          model: 'wan-video/wan-2.7-image'
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
