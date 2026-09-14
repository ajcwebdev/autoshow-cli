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
      if (call.url.endsWith('/interactions') && call.method === 'POST') {
        return jsonResponse({
          id: 'v1_omni-promptless',
          status: 'completed',
          steps: [{
            type: 'model_output',
            content: [{ type: 'video', mime_type: 'video/mp4', data: inlineVideo }]
          }]
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
        model: 'gemini-omni-1.1-flash',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGrokVideoGen(undefined, dir, {
        model: 'grok-imagine-video-1.5',
        mode: 'image-to-video',
        inputImage: imagePath
      })
    })

    const expectedImage = `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    const expectedImageBase64 = Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
    const geminiBody = calls.find((call) => call.url.endsWith('/interactions'))?.bodyJson
    const grokBody = calls.find((call) => call.url === `${XAI_DEFAULT_BASE_URL}/videos/generations`)?.bodyJson
    const geminiInput = geminiBody?.['input'] as Array<Record<string, unknown>> | undefined

    expect(geminiInput?.[1]).toMatchObject({ type: 'text', text: defaultImageVideoPrompt })
    expect(geminiInput?.[0]).toMatchObject({
      type: 'image',
      mime_type: 'image/png',
      data: expectedImageBase64
    })
    expect(grokBody).not.toHaveProperty('prompt')
    expect(grokBody).toMatchObject({ model: 'grok-imagine-video-1.5', image: { url: expectedImage } })
  })
})
