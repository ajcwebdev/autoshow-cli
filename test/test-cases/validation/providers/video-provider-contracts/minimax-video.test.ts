import { describe, expect, test } from 'bun:test'
import {
  installMockFetch,
  jsonResponse,
  MINIMAX_DEFAULT_BASE_URL,
  runMinimaxVideoGen,
  transientVideoReadFailureResponse,
  videoBytes,
  videoResponse,
  withTempDir,
  writeMediaFixtures
} from './shared'

describe('video provider REST contracts', () => {
  test('MiniMax sends text, image, and subject-reference request bodies', async () => {
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    let requestIndex = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        requestIndex += 1
        return jsonResponse({ task_id: `minimax-${requestIndex}`, base_resp: { status_code: 0, status_msg: 'success' } })
      }
      if (call.url.startsWith(`${MINIMAX_DEFAULT_BASE_URL}/v1/query/video_generation?task_id=minimax-`)) {
        return jsonResponse({
          data: { status: 'success', file_id: 'file-123' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/files/retrieve?file_id=file-123`) {
        return jsonResponse({
          file: { download_url: 'https://cdn.example.com/minimax.mp4' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === 'https://cdn.example.com/minimax.mp4') return videoResponse()
      throw new Error(`Unexpected MiniMax fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      await runMinimaxVideoGen('plain prompt', dir, {
        model: 'MiniMax-Hailuo-2.3'
      })
      await runMinimaxVideoGen('animate image', dir, {
        model: 'I2V-01',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runMinimaxVideoGen('keep character', dir, {
        model: 'S2V-01',
        mode: 'reference-to-video',
        referenceImages: [imagePath]
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    expect(postBodies[0]).toEqual({
      model: 'MiniMax-Hailuo-2.3',
      prompt: 'plain prompt',
      duration: 6,
      resolution: '768P'
    })
    expect(postBodies[1]).toEqual({
      model: 'I2V-01',
      prompt: 'animate image',
      duration: 6,
      resolution: '720P',
      first_frame_image: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    })
    expect(postBodies[2]).toEqual({
      model: 'S2V-01',
      prompt: 'keep character',
      subject_reference: [{
        type: 'character',
        image: [`data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`]
      }]
    })
  })

  test('MiniMax retries transient video download body read failures after task success', async () => {
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    let downloadAttempts = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({ task_id: 'minimax-retry', base_resp: { status_code: 0, status_msg: 'success' } })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/query/video_generation?task_id=minimax-retry`) {
        return jsonResponse({
          data: { status: 'success', file_id: 'file-retry' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/files/retrieve?file_id=file-retry`) {
        return jsonResponse({
          file: { download_url: 'https://cdn.example.com/minimax-retry.mp4' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === 'https://cdn.example.com/minimax-retry.mp4') {
        downloadAttempts += 1
        return downloadAttempts === 1 ? transientVideoReadFailureResponse() : videoResponse()
      }
      throw new Error(`Unexpected MiniMax fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      const result = await runMinimaxVideoGen('animate after retry', dir, {
        model: 'MiniMax-Hailuo-2.3-Fast',
        mode: 'image-to-video',
        inputImage: imagePath,
        durationSeconds: 6
      })

      expect(Array.from(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer()))).toEqual(Array.from(videoBytes))
    })

    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
    expect(calls.filter((call) => call.url === 'https://cdn.example.com/minimax-retry.mp4')).toHaveLength(2)
  })
})
