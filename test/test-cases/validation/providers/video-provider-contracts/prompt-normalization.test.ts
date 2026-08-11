import { describe, expect, test } from 'bun:test'
import {
  defaultImageVideoPrompt,
  GLM_DEFAULT_BASE_URL,
  inlineVideo,
  installMockFetch,
  jsonResponse,
  MINIMAX_DEFAULT_BASE_URL,
  runGeminiVideoGen,
  runGlmVideoGen,
  runGrokVideoGen,
  runMinimaxVideoGen,
  videoResponse,
  withTempDir,
  writeMediaFixtures,
  XAI_DEFAULT_BASE_URL
} from './shared'

describe('video provider REST contracts', () => {
  test('provider-required image prompts are synthesized while promptless providers omit prompt', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    process.env['GLM_API_KEY'] = 'glm-key'
    process.env['MINIMAX_API_KEY'] = 'minimax-key'
    process.env['XAI_API_KEY'] = 'xai-key'

    const calls = installMockFetch((call) => {
      if (call.url.includes(':predictLongRunning') && call.method === 'POST') {
        return jsonResponse({ name: 'operations/veo-promptless', done: false })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/operations/veo-promptless') {
        return jsonResponse({
          name: 'operations/veo-promptless',
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [{
                video: {
                  encodedVideo: inlineVideo,
                  encoding: 'video/mp4'
                }
              }]
            }
          }
        })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/video_generation` && call.method === 'POST') {
        return jsonResponse({ task_id: 'minimax-promptless', base_resp: { status_code: 0, status_msg: 'success' } })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/query/video_generation?task_id=minimax-promptless`) {
        return jsonResponse({
          data: { status: 'success', file_id: 'file-promptless' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/files/retrieve?file_id=file-promptless`) {
        return jsonResponse({
          file: { download_url: 'https://cdn.example.com/minimax-promptless.mp4' },
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (call.url === `${GLM_DEFAULT_BASE_URL}/videos/generations` && call.method === 'POST') {
        return jsonResponse({ id: 'glm-promptless', task_status: 'PROCESSING' })
      }
      if (call.url === `${GLM_DEFAULT_BASE_URL}/async-result/glm-promptless`) {
        return jsonResponse({
          id: 'glm-promptless',
          task_status: 'SUCCESS',
          video_result: [{ url: 'https://cdn.example.com/glm-promptless.mp4' }]
        })
      }
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/generations` && call.method === 'POST') {
        return jsonResponse({ request_id: 'grok-promptless' })
      }
      if (call.url === `${XAI_DEFAULT_BASE_URL}/videos/grok-promptless`) {
        return jsonResponse({
          status: 'done',
          video: {
            url: 'https://cdn.example.com/grok-promptless.mp4',
            duration: 5,
            respect_moderation: true
          }
        })
      }
      if (call.url.startsWith('https://cdn.example.com/') && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected promptless video fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      await runGeminiVideoGen(undefined, dir, {
        model: 'veo-3.1-fast-generate-preview',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runMinimaxVideoGen(undefined, dir, {
        model: 'I2V-01',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGlmVideoGen(undefined, dir, {
        model: 'vidu2-image',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGrokVideoGen(undefined, dir, {
        model: 'grok-imagine-video',
        mode: 'image-to-video',
        inputImage: imagePath
      })
    })

    const expectedImage = `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    const expectedImageBase64 = Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
    const geminiBody = calls.find((call) => call.url.includes(':predictLongRunning'))?.bodyJson
    const minimaxBody = calls.find((call) => call.url === `${MINIMAX_DEFAULT_BASE_URL}/v1/video_generation`)?.bodyJson
    const glmBody = calls.find((call) => call.url === `${GLM_DEFAULT_BASE_URL}/videos/generations`)?.bodyJson
    const grokBody = calls.find((call) => call.url === `${XAI_DEFAULT_BASE_URL}/videos/generations`)?.bodyJson
    const geminiInstance = (geminiBody as { instances?: Array<Record<string, unknown>> } | undefined)?.instances?.[0]

    expect(geminiInstance).toHaveProperty('prompt', defaultImageVideoPrompt)
    expect(geminiInstance).toMatchObject({
      image: {
        mimeType: 'image/png',
        bytesBase64Encoded: expectedImageBase64
      }
    })
    expect(minimaxBody).not.toHaveProperty('prompt')
    expect(minimaxBody).toMatchObject({ model: 'I2V-01', first_frame_image: expectedImage })
    expect(glmBody).toHaveProperty('prompt', defaultImageVideoPrompt)
    expect(glmBody).toMatchObject({ model: 'vidu2-image', images: [expectedImage] })
    expect(grokBody).not.toHaveProperty('prompt')
    expect(grokBody).toMatchObject({ model: 'grok-imagine-video', image: { url: expectedImage } })
  })
})
