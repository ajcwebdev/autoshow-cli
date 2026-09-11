import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runBflImageGen } from '~/cli/commands/visuals/image/image-generation-services/bfl/run-bfl-image-gen'
import { installMockFetch, jsonResponse } from '../../../../test-utils/rest-contract-helpers'
import { imageResponse, setupImageRestContractLifecycle } from './image-rest-contract-fixtures'

const { withDir: withTempDir } = setupImageRestContractLifecycle()

describe('bfl image rest contracts', () => {
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
})
