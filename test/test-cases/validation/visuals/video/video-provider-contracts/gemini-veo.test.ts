import { describe, expect, test } from 'bun:test'
import { collectVideoTargets } from '~/cli/commands/visuals/video/video-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { redDotPng } from '../../../../../test-utils/media-fixtures'
import {
  inlineVideo,
  installMockFetch,
  jsonResponse,
  runGeminiVideoGen,
  withTempDir,
  writeMediaFixtures
} from './shared'

const omniVideoResponse = (overrides?: Record<string, unknown>) => jsonResponse({
  id: 'v1_omni-test',
  status: 'completed',
  model: 'gemini-omni-1.2-flash',
  object: 'interaction',
  steps: [{
    type: 'model_output',
    content: [{
      type: 'video',
      mime_type: 'video/mp4',
      data: inlineVideo
    }]
  }],
  ...overrides
})

describe('video provider REST contracts', () => {
  test('Omni 1.2 sends six reference images and rejects a seventh before dispatch', async () => {
    // https://aistudio.google.com/docs/omni#subject-reference
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installMockFetch(() => omniVideoResponse())
    const data = Buffer.from(redDotPng).toString('base64')
    const reference = `data:image/png;base64,${data}`
    const collect = (count: number) => collectVideoTargets(buildOptsFromFlags({
      'gemini-video': 'gemini-omni-1.2-flash',
      mode: 'reference-to-video',
      'reference-image': Array<string>(count).fill(reference)
    }))

    expect(() => collect(7)).toThrow('--reference-image supports at most 6 images')
    expect(calls).toHaveLength(0)
    const [target] = collect(6)
    if (!target) throw new Error('Expected a Gemini video target')
    await withTempDir(async dir => {
      await expect(runGeminiVideoGen('Animate the subject', dir, {
        model: 'gemini-omni-1.2-flash', mode: 'reference-to-video', referenceImages: Array<string>(7).fill(reference)
      })).rejects.toThrow('--reference-image supports at most 6 images')
      expect(calls).toHaveLength(0)
      await target.run('Animate the subject', dir)
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'gemini-omni-1.2-flash',
      input: [...Array(6).fill({ type: 'image', data, mime_type: 'image/png' }), { type: 'text' }]
    })
  })

  test('Gemini Omni sends Interactions payloads for image and interpolation modes', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST' && call.url.endsWith('/interactions')) {
        return omniVideoResponse()
      }
      throw new Error(`Unexpected Gemini fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath } = await writeMediaFixtures(dir)

      await runGeminiVideoGen('animate image', dir, {
        model: 'gemini-omni-1.2-flash',
        mode: 'image-to-video',
        inputImage: imagePath
      })
      await runGeminiVideoGen('transition', dir, {
        model: 'gemini-omni-1.2-flash',
        mode: 'interpolate',
        inputImage: imagePath,
        lastFrameImage: lastFramePath
      })
    })

    const postBodies = calls.filter((call) => call.method === 'POST').map((call) => call.bodyJson!)
    const imageBase64 = Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')
    expect(postBodies).toHaveLength(2)
    expect(postBodies[0]).toMatchObject({
      model: 'gemini-omni-1.2-flash',
      store: true,
      background: false,
      stream: false,
      response_format: {
        type: 'video',
        delivery: 'uri',
        resolution: '720p',
        aspect_ratio: '16:9'
      },
      generation_config: {
        video_config: { task: 'image_to_video' }
      }
    })
    expect(postBodies[0]?.['input']).toEqual([
      { type: 'image', data: imageBase64, mime_type: 'image/png' },
      { type: 'text', text: 'animate image' }
    ])
    expect(postBodies[1]?.['generation_config']).toMatchObject({
      video_config: { task: 'image_to_video' }
    })
    const interpolateInput = postBodies[1]?.['input'] as Array<Record<string, unknown>>
    expect(interpolateInput[0]).toMatchObject({ type: 'image', mime_type: 'image/png' })
    expect(interpolateInput[1]).toMatchObject({ type: 'image', mime_type: 'image/webp' })
    expect(interpolateInput[2]).toMatchObject({ type: 'text' })
    expect(String(interpolateInput[2]?.['text'])).toContain('transition')
  })

  test('Gemini Omni edit uses previous_interaction_id and duration in response_format', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const calls = installMockFetch((call) => {
      if (call.method === 'POST' && call.url.endsWith('/interactions')) {
        return omniVideoResponse()
      }
      throw new Error(`Unexpected Gemini fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      await runGeminiVideoGen('Make the violin invisible.', dir, {
        model: 'gemini-omni-1.2-flash',
        mode: 'edit',
        previousInteractionId: 'v1_previous',
        durationSeconds: 8,
        resolution: '1080p',
        aspectRatio: '9:16'
      })
    })

    expect(calls[0]?.bodyJson).toMatchObject({
      model: 'gemini-omni-1.2-flash',
      previous_interaction_id: 'v1_previous',
      input: 'Make the violin invisible.',
      response_format: {
        type: 'video',
        aspect_ratio: '9:16',
        resolution: '1080p',
        delivery: 'uri',
        duration: '8s'
      },
      generation_config: {
        video_config: { task: 'edit' }
      }
    })
  })
})
