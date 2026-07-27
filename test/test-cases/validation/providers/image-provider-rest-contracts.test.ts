import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runBflImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/bfl/run-bfl-image-gen'
import { runRecraftImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/recraft/run-recraft-image-gen'
import { runReplicateImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/replicate/run-replicate-image-gen'
import { runReveImageGen } from '~/cli/commands/process-steps/step-5-image/image-generation-services/reve/run-reve-image-gen'
import {
  bytesResponse,
  clearEnv,
  createTempDirTracker,
  installMockFetch,
  jsonResponse,
  restoreEnv,
  snapshotEnv
} from '../../../test-utils/rest-contract-helpers'
import type { EnvSnapshot } from '~/types'

const originalFetch = globalThis.fetch
let previousEnv: EnvSnapshot = {}
const envKeys = [
  'BFL_API_KEY',
  'REVE_API_KEY',
  'RECRAFT_API_TOKEN',
  'REPLICATE_API_TOKEN'
]
const tempDirs = createTempDirTracker('autoshow-image-provider-rest-')

const imageResponse = (
  bytes: Uint8Array,
  contentType: string,
  headers?: Record<string, string>
): Response => bytesResponse(bytes, { headers: { 'content-type': contentType, ...headers } })

const withTempDir = async <T,>(fn: (dir: string) => Promise<T>): Promise<T> => {
  return await tempDirs.withDir(fn)
}

beforeEach(() => {
  previousEnv = snapshotEnv(envKeys)
  clearEnv(envKeys)
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreEnv(previousEnv)
  await tempDirs.cleanup()
})

describe('image provider REST contracts', () => {
  test('Reve create sends JSON body, image accept header, and records returned version and credit cost', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'
    const calls = installMockFetch(() =>
      imageResponse(new Uint8Array([1, 2, 3]), 'image/webp', {
        'x-reve-version': 'reve-create@20250915',
        'x-reve-credits-used': '15'
      })
    )

    await withTempDir(async (dir) => {
      const result = await runReveImageGen('A precise product photo', dir, {
        model: 'latest',
        aspectRatio: '3:2',
        imageSize: '1024x768',
        outputFormat: 'webp',
        baseUrl: 'https://mock.reve.local'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.webp')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'reve',
        imageModel: 'latest',
        imageFileNames: ['generated-image.webp'],
        imageFormat: 'webp',
        imageSize: '1024x768',
        providerReturnedModel: 'reve-create@20250915',
        providerCostCents: 2,
        providerCostSource: 'provider_usage',
        usageCostRaw: 15,
        requestMode: 'generation'
      })
    })

    expect(calls[0]).toMatchObject({
      url: 'https://mock.reve.local/v1/image/create',
      method: 'POST'
    })
    expect(calls[0]?.headers.get('accept')).toBe('image/webp')
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer reve-key')
    expect(calls[0]?.bodyJson).toEqual({
      prompt: 'A precise product photo',
      aspect_ratio: '3:2',
      postprocessing: [{
        process: 'fit_image',
        max_width: 1024,
        max_height: 768
      }]
    })
  })

  test('Reve edit sends one bare base64 reference image', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'
    const calls = installMockFetch(() => imageResponse(new Uint8Array([9, 8, 7]), 'image/png'))

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      const refBytes = new Uint8Array([4, 5, 6])
      await writeFile(refPath, refBytes)

      const result = await runReveImageGen('Make the object matte black', dir, {
        model: 'latest',
        inputs: [refPath],
        baseUrl: 'https://mock.reve.local'
      })

      expect(result.metadata.requestMode).toBe('edit')
      expect(calls[0]?.bodyJson).toEqual({
        edit_instruction: 'Make the object matte black',
        reference_image: Buffer.from(refBytes).toString('base64')
      })
    })

    expect(calls[0]?.url).toBe('https://mock.reve.local/v1/image/edit')
    expect(calls[0]?.headers.get('accept')).toBe('image/png')
  })

  test('Reve remix sends multiple bare base64 reference images', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'
    const calls = installMockFetch(() => imageResponse(new Uint8Array([3, 2, 1]), 'image/jpeg'))

    await withTempDir(async (dir) => {
      const firstRef = join(dir, 'first.png')
      const secondRef = join(dir, 'second.webp')
      const firstBytes = new Uint8Array([1, 1, 1])
      const secondBytes = new Uint8Array([2, 2, 2])
      await writeFile(firstRef, firstBytes)
      await writeFile(secondRef, secondBytes)

      const result = await runReveImageGen('Combine these references', dir, {
        model: 'latest',
        inputs: [firstRef, secondRef],
        outputFormat: 'jpeg',
        baseUrl: 'https://mock.reve.local'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.jpg')).toBe(true)
      expect(calls[0]?.bodyJson).toEqual({
        prompt: 'Combine these references',
        reference_images: [
          Buffer.from(firstBytes).toString('base64'),
          Buffer.from(secondBytes).toString('base64')
        ]
      })
    })

    expect(calls[0]?.url).toBe('https://mock.reve.local/v1/image/remix')
    expect(calls[0]?.headers.get('accept')).toBe('image/jpeg')
  })

  test('Reve treats moderation and error headers as failed image runs', async () => {
    process.env['REVE_API_KEY'] = 'reve-key'

    await withTempDir(async (dir) => {
      installMockFetch(() =>
        imageResponse(new Uint8Array([1, 2, 3]), 'image/png', {
          'x-reve-content-violation': 'true'
        })
      )
      await expect(runReveImageGen('Unsafe prompt', dir, {
        model: 'latest',
        baseUrl: 'https://mock.reve.local'
      })).rejects.toThrow('content violation')
    })

    await withTempDir(async (dir) => {
      installMockFetch(() =>
        imageResponse(new Uint8Array([1, 2, 3]), 'image/png', {
          'x-reve-error-code': 'policy_blocked'
        })
      )
      await expect(runReveImageGen('Another blocked prompt', dir, {
        model: 'latest',
        baseUrl: 'https://mock.reve.local'
      })).rejects.toThrow('error code policy_blocked')
    })
  })

  test('BFL image generation sends numbered reference image fields', async () => {
    process.env['BFL_API_KEY'] = 'bfl-key'
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
      return imageResponse(new Uint8Array([9, 8, 7]), 'image/jpeg')
    })

    await withTempDir(async (dir) => {
      const refPath = join(dir, 'reference.png')
      await writeFile(refPath, new Uint8Array([1, 2, 3]))

      const result = await runBflImageGen('Edit with references', dir, {
        model: 'flux-2-pro',
        outputFormat: 'png',
        inputs: [refPath, 'https://cdn.example.com/reference.webp'],
        baseUrl: 'https://mock.bfl.local'
      })

      expect(result.metadata.requestMode).toBe('edit')
      expect(result.metadata.imageFileNames).toEqual(['generated-image.png'])
    })

    expect(calls[0]).toMatchObject({
      url: 'https://mock.bfl.local/v1/flux-2-pro',
      method: 'POST'
    })
    expect(calls[0]?.bodyJson).toMatchObject({
      prompt: 'Edit with references',
      output_format: 'png',
      input_image_2: 'https://cdn.example.com/reference.webp'
    })
    expect(String(calls[0]?.bodyJson?.['input_image'])).toBe(`data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`)
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
        outputFormat: 'jpeg',
        baseUrl: 'https://mock.bfl.local'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.jpg')).toBe(true)
      expect(await Bun.file(result.imagePaths[0] as string).exists()).toBe(true)
    })

    const downloadCalls = calls.filter((call) => call.url === 'https://mock.bfl.local/result.jpeg')
    expect(downloadCalls).toHaveLength(2)
    expect(downloadCalls[0]?.headers.get('accept')).toBe('image/jpeg,image/*;q=0.9,*/*;q=0.8')
  })

  test('Recraft generation sends JSON body and downloads multiple URL artifacts', async () => {
    process.env['RECRAFT_API_TOKEN'] = 'recraft-token'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          model: 'recraftv4_1',
          data: [
            { url: 'https://mock.recraft.local/images/one.png' },
            { url: 'https://mock.recraft.local/images/two.png' }
          ]
        })
      }
      return imageResponse(new Uint8Array([1, 2, 3]), 'image/png')
    })

    await withTempDir(async (dir) => {
      const result = await runRecraftImageGen('A precise product photo', dir, {
        model: 'recraftv4_1',
        count: 2,
        aspectRatio: '16:9',
        baseUrl: 'https://mock.recraft.local/v1'
      })

      expect(result.imagePaths.map((path) => path.endsWith('.png'))).toEqual([true, true])
      expect(result.metadata).toMatchObject({
        imageService: 'recraft',
        imageModel: 'recraftv4_1',
        imageCount: 2,
        imageFileNames: ['generated-image.png', 'generated-image-2.png'],
        imageSize: '16:9',
        imageFormat: 'png',
        requestMode: 'generation'
      })
    })

    expect(calls[0]).toMatchObject({
      url: 'https://mock.recraft.local/v1/images/generations',
      method: 'POST'
    })
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer recraft-token')
    expect(calls[0]?.headers.get('content-type')).toBe('application/json')
    expect(calls[0]?.bodyJson).toEqual({
      prompt: 'A precise product photo',
      model: 'recraftv4_1',
      response_format: 'url',
      n: 2,
      size: '16:9'
    })
    expect(calls.slice(1).map((call) => call.url)).toEqual([
      'https://mock.recraft.local/images/one.png',
      'https://mock.recraft.local/images/two.png'
    ])
  })

  test('Recraft vector downloads infer svg output extension from content type', async () => {
    process.env['RECRAFT_API_TOKEN'] = 'recraft-token'
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({
          data: [{ url: 'https://mock.recraft.local/images/vector-result' }]
        })
      }
      return imageResponse(svgBytes, 'image/svg+xml')
    })

    await withTempDir(async (dir) => {
      const result = await runRecraftImageGen('A clean vector fox logo', dir, {
        model: 'recraftv4_1_vector',
        aspectRatio: '1:1',
        baseUrl: 'https://mock.recraft.local/v1'
      })

      expect(result.imagePaths[0]?.endsWith('generated-image.svg')).toBe(true)
      expect(result.metadata).toMatchObject({
        imageService: 'recraft',
        imageModel: 'recraftv4_1_vector',
        imageFileNames: ['generated-image.svg'],
        imageFormat: 'svg',
        imageSize: '1:1'
      })
      expect(await Bun.file(result.imagePaths[0] as string).text()).toContain('<svg')
    })

    expect(calls[0]?.bodyJson).toEqual({
      prompt: 'A clean vector fox logo',
      model: 'recraftv4_1_vector',
      response_format: 'url',
      n: 1,
      size: '1:1'
    })
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
        aspectRatio: '16:9',
        baseUrl: 'https://mock.replicate.local/v1'
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
      url: 'https://mock.replicate.local/v1/models/bytedance/seedream-4.5/predictions',
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
        aspectRatio: '1:1',
        baseUrl: 'https://mock.replicate.local/v1'
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
      'POST https://mock.replicate.local/v1/models/qwen/qwen-image-2-pro/predictions',
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
        count: 3,
        baseUrl: 'https://mock.replicate.local/v1'
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
        model: 'wan-video/wan-2.7-image',
        baseUrl: 'https://mock.replicate.local/v1'
      })).rejects.toThrow('terminal failure - prompt rejected')
    })

    expect(calls).toHaveLength(1)
  })
})
