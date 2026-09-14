import { describe, expect, test } from 'bun:test'
import {
  inlineVideo,
  installMockFetch,
  jsonResponse,
  runGeminiVideoGen,
  withTempDir,
  writeMediaFixtures
} from './shared'

describe('video provider REST contracts', () => {
  test('Gemini Veo Lite sends media inputs for image and interpolation modes', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        return jsonResponse({ name: 'operations/veo-test', done: false })
      }
      if (call.url === 'https://generativelanguage.googleapis.com/v1beta/operations/veo-test') {
        return jsonResponse({
          name: 'operations/veo-test',
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
      throw new Error(`Unexpected Gemini fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath } = await writeMediaFixtures(dir)

      await runGeminiVideoGen('animate image', dir, {
        model: 'veo-3.1-lite-generate-preview',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGeminiVideoGen('transition', dir, {
        model: 'veo-3.1-lite-generate-preview',
        mode: 'interpolate',
        inputImage: imagePath,
        lastFrameImage: lastFramePath
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    const imageBase64 = Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
    expect(postBodies).toHaveLength(2)
    expect(postBodies[0]?.['instances']).toMatchObject([{
      prompt: 'animate image',
      image: {
        mimeType: 'image/png',
        bytesBase64Encoded: imageBase64
      }
    }])
    expect(postBodies[1]?.['instances']).toMatchObject([{
      prompt: 'transition',
      image: {
        mimeType: 'image/png',
        bytesBase64Encoded: imageBase64
      },
      lastFrame: { inlineData: { mimeType: 'image/webp' } }
    }])
  })
})
