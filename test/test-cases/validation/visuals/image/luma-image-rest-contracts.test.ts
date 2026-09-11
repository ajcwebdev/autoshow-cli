import { describe, expect, test } from 'bun:test'
import { runLumalabsImageGen } from '~/cli/commands/visuals/image/image-generation-services/lumalabs/run-lumalabs-image-gen'
import { installMockFetch, jsonResponse } from '../../../../test-utils/rest-contract-helpers'
import { imageResponse, setupImageRestContractLifecycle } from './image-rest-contract-fixtures'

const { withDir: withTempDir } = setupImageRestContractLifecycle()

describe('luma image rest contracts', () => {
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
})
