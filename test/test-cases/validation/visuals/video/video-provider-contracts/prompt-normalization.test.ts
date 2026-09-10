import { describe, expect, test } from 'bun:test'
import {
  defaultImageVideoPrompt,
  inlineVideo,
  installMockFetch,
  jsonResponse,
  runGeminiVideoGen,
  runGrokVideoGen,
  videoResponse,
  withTempDir,
  writeMediaFixtures,
  XAI_DEFAULT_BASE_URL
} from './shared'

describe('video provider REST contracts', () => {
  test('provider-required image prompts are synthesized while promptless providers omit prompt', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
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
      await runGrokVideoGen(undefined, dir, {
        model: 'grok-imagine-video',
        mode: 'image-to-video',
        inputImage: imagePath
      })
    })

    const expectedImage = `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    const expectedImageBase64 = Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
    const geminiBody = calls.find((call) => call.url.includes(':predictLongRunning'))?.bodyJson
    const grokBody = calls.find((call) => call.url === `${XAI_DEFAULT_BASE_URL}/videos/generations`)?.bodyJson
    const geminiInstance = (geminiBody as { instances?: Array<Record<string, unknown>> } | undefined)?.instances?.[0]

    expect(geminiInstance).toHaveProperty('prompt', defaultImageVideoPrompt)
    expect(geminiInstance).toMatchObject({
      image: {
        mimeType: 'image/png',
        bytesBase64Encoded: expectedImageBase64
      }
    })
    expect(grokBody).not.toHaveProperty('prompt')
    expect(grokBody).toMatchObject({ model: 'grok-imagine-video', image: { url: expectedImage } })
  })
})
