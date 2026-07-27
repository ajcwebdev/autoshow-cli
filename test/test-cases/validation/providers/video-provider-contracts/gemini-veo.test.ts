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
  test('Gemini Veo sends media inputs for image, reference, interpolation, extension, and 4k modes', async () => {
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
                  mimeType: 'video/mp4'
                }
              }]
            }
          }
        })
      }
      throw new Error(`Unexpected Gemini fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath, videoPath } = await writeMediaFixtures(dir)

      await runGeminiVideoGen('animate image', dir, {
        model: 'veo-3.1-fast-generate-preview',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGeminiVideoGen('keep references', dir, {
        model: 'veo-3.1-generate-preview',
        mode: 'reference-to-video',
        referenceImages: [imagePath, lastFramePath],
        durationSeconds: 4
      })
      await runGeminiVideoGen('transition', dir, {
        model: 'veo-3.1-generate-preview',
        mode: 'interpolate',
        inputImage: imagePath,
        lastFrameImage: lastFramePath
      })
      await runGeminiVideoGen('continue video', dir, {
        model: 'veo-3.1-fast-generate-preview',
        mode: 'extend',
        inputVideo: videoPath,
        resolution: '1080p'
      })
      await runGeminiVideoGen('grand canyon', dir, {
        model: 'veo-3.1-generate-preview',
        resolution: '4k',
        durationSeconds: 4
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    const imageBase64 = Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
    expect(postBodies[0]?.['instances']).toMatchObject([{
      prompt: 'animate image',
      image: {
        mimeType: 'image/png',
        bytesBase64Encoded: imageBase64
      }
    }])
    expect(postBodies[1]?.['instances']).toMatchObject([{
      prompt: 'keep references',
      referenceImages: [
        { image: { inlineData: { mimeType: 'image/png' } }, referenceType: 'asset' },
        { image: { inlineData: { mimeType: 'image/webp' } }, referenceType: 'asset' }
      ]
    }])
    expect(postBodies[1]?.['parameters']).toMatchObject({ durationSeconds: 8 })
    expect(postBodies[2]?.['instances']).toMatchObject([{
      prompt: 'transition',
      image: {
        mimeType: 'image/png',
        bytesBase64Encoded: imageBase64
      },
      lastFrame: { inlineData: { mimeType: 'image/webp' } }
    }])
    expect(postBodies[3]?.['instances']).toMatchObject([{
      prompt: 'continue video',
      video: { inlineData: { mimeType: 'video/mp4' } }
    }])
    expect(postBodies[3]?.['parameters']).toMatchObject({ durationSeconds: 8, resolution: '720p' })
    expect(postBodies[4]?.['parameters']).toMatchObject({ durationSeconds: 8, resolution: '4k' })
  })
})
