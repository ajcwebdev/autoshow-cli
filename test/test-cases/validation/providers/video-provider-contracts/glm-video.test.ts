import { describe, expect, test } from 'bun:test'
import {
  GLM_DEFAULT_BASE_URL,
  installMockFetch,
  jsonResponse,
  runGlmVideoGen,
  videoResponse,
  withTempDir,
  writeMediaFixtures
} from './shared'

describe('video provider REST contracts', () => {
  test('GLM sends text, image, interpolation, and reference request bodies', async () => {
    process.env['GLM_API_KEY'] = 'glm-key'
    let requestIndex = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        requestIndex += 1
        return jsonResponse({ id: `glm-${requestIndex}`, task_status: 'PROCESSING' })
      }
      if (call.url.startsWith(`${GLM_DEFAULT_BASE_URL}/async-result/glm-`)) {
        return jsonResponse({
          id: 'glm-result',
          task_status: 'SUCCESS',
          video_result: [{ url: 'https://cdn.example.com/glm.mp4' }]
        })
      }
      if (call.url === 'https://cdn.example.com/glm.mp4') return videoResponse()
      throw new Error(`Unexpected GLM fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath } = await writeMediaFixtures(dir)
      await runGlmVideoGen('plain prompt', dir, {
        model: 'cogvideox-3'
      })
      await runGlmVideoGen('animate image', dir, {
        model: 'cogvideox-3',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGlmVideoGen('animate vidu image', dir, {
        model: 'vidu2-image',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGlmVideoGen('transition frames', dir, {
        model: 'cogvideox-3',
        mode: 'interpolate',
        inputImage: imagePath,
        lastFrameImage: lastFramePath
      })
      await runGlmVideoGen('keep references', dir, {
        model: 'vidu2-reference',
        mode: 'reference-to-video',
        referenceImages: [imagePath, lastFramePath]
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    const imageBase64 = Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
    const lastFrameBase64 = Buffer.from(new Uint8Array([4, 5, 6])).toString('base64')
    const imageDataUrl = `data:image/png;base64,${imageBase64}`
    const lastFrameDataUrl = `data:image/webp;base64,${lastFrameBase64}`
    expect(postBodies[0]).toEqual({
      model: 'cogvideox-3',
      prompt: 'plain prompt',
      quality: 'speed',
      with_audio: false,
      size: '1920x1080',
      fps: 30,
      duration: 5
    })
    expect(postBodies[1]).toMatchObject({
      model: 'cogvideox-3',
      prompt: 'animate image',
      image_url: imageBase64
    })
    expect(postBodies[2]).toMatchObject({
      model: 'vidu2-image',
      prompt: 'animate vidu image',
      duration: 4,
      size: '1280x720',
      movement_amplitude: 'auto',
      images: [imageDataUrl]
    })
    expect(postBodies[3]?.['image_url']).toEqual([
      imageBase64,
      lastFrameBase64
    ])
    expect(postBodies[4]).toMatchObject({
      model: 'vidu2-reference',
      prompt: 'keep references',
      duration: 4,
      aspect_ratio: '16:9',
      size: '1280x720',
      movement_amplitude: 'auto',
      with_audio: false,
      images: [
        imageDataUrl,
        lastFrameDataUrl
      ]
    })
  })

  test('GLM Vidu image generation retries alternate media field shapes', async () => {
    process.env['GLM_API_KEY'] = 'glm-key'
    let postCount = 0
    const calls = installMockFetch((call) => {
      if (call.method === 'POST') {
        postCount += 1
        if (postCount < 3) {
          return jsonResponse({ error: { code: '1210', message: 'field is missing or empty' } }, { status: 400 })
        }
        return jsonResponse({ id: 'glm-vidu-fallback', task_status: 'PROCESSING' })
      }
      if (call.url === `${GLM_DEFAULT_BASE_URL}/async-result/glm-vidu-fallback`) {
        return jsonResponse({
          id: 'glm-vidu-fallback',
          task_status: 'SUCCESS',
          video_result: [{ url: 'https://cdn.example.com/glm-vidu-fallback.mp4' }]
        })
      }
      if (call.url === 'https://cdn.example.com/glm-vidu-fallback.mp4') return videoResponse()
      throw new Error(`Unexpected GLM Vidu fallback fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath } = await writeMediaFixtures(dir)
      await runGlmVideoGen('animate vidu image', dir, {
        model: 'vidu2-image',
        mode: 'image-to-video',
        inputImage: imagePath
      })
    })

    const imageDataUrl = `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`
    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    expect(postBodies).toHaveLength(3)
    expect(postBodies[0]).toMatchObject({ model: 'vidu2-image', images: [imageDataUrl] })
    expect(postBodies[1]).toMatchObject({ model: 'vidu2-image', image_url: [imageDataUrl] })
    expect(postBodies[2]).toMatchObject({ model: 'vidu2-image', image_url: imageDataUrl })
  })
})
