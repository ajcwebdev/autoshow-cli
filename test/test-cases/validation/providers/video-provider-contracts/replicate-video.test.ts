import { describe, expect, test } from 'bun:test'
import {
  installMockFetch,
  jsonResponse,
  runReplicateVideoGen,
  videoBytes,
  videoResponse,
  withTempDir,
  writeFile,
  writeMediaFixtures,
  join
} from './shared'

describe('video provider REST contracts', () => {
  test('Replicate Seedance creates predictions, polls, downloads output, and records metadata', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.url === 'https://api.replicate.com/v1/models/bytedance/seedance-2.0-fast/predictions' && call.method === 'POST') {
        return jsonResponse({
          id: 'pred-start',
          model: 'bytedance/seedance-2.0-fast',
          version: 'replicate-version-1',
          status: 'starting',
          urls: { get: 'https://api.replicate.com/v1/predictions/pred-start' },
          created_at: '2026-06-13T12:00:00.000Z'
        })
      }
      if (call.url === 'https://api.replicate.com/v1/predictions/pred-start' && call.method === 'GET') {
        return jsonResponse({
          id: 'pred-start',
          model: 'bytedance/seedance-2.0-fast',
          version: 'replicate-version-1',
          status: 'succeeded',
          output: 'https://replicate.delivery/example/seedance.mp4',
          metrics: { predict_time: 4.2 },
          completed_at: '2026-06-13T12:00:05.000Z'
        })
      }
      if (call.url === 'https://replicate.delivery/example/seedance.mp4' && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected Replicate fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const { imagePath, videoPath } = await writeMediaFixtures(dir)
      const audioPath = join(dir, 'reference.mp3')
      await writeFile(audioPath, new Uint8Array([10, 11, 12]))

      const result = await runReplicateVideoGen('Use [Image1], [Video1], and [Audio1] for a stylized product reveal', dir, {
        model: 'bytedance/seedance-2.0-fast',
        mode: 'reference-to-video',
        durationSeconds: -1,
        resolution: '720p',
        aspectRatio: 'adaptive',
        referenceImages: [imagePath],
        referenceVideos: [videoPath],
        referenceAudios: [audioPath],
        generateAudio: false,
        seed: 123
      })

      expect(result.videoPath).toBe(`${dir}/generated-video.mp4`)
      expect(Array.from(new Uint8Array(await Bun.file(result.videoPath).arrayBuffer()))).toEqual(Array.from(videoBytes))
      expect(result.metadata).toMatchObject({
        videoGenService: 'replicate',
        videoGenModel: 'bytedance/seedance-2.0-fast',
        videoFileName: 'generated-video.mp4',
        videoFileSize: videoBytes.byteLength,
        videoDuration: 5,
        requestMode: 'reference-to-video',
        videoResolution: '720p',
        videoAspectRatio: 'adaptive',
        referenceImages: [imagePath],
        referenceVideos: [videoPath],
        referenceAudios: [audioPath],
        providerRequestId: 'pred-start',
        providerModelVersion: 'replicate-version-1',
        providerOutputUrl: 'https://replicate.delivery/example/seedance.mp4',
        providerVideoUrl: 'https://replicate.delivery/example/seedance.mp4',
        providerCostCents: 85,
        providerCostSource: 'registry_fallback'
      })
      expect(result.metadata.providerStatusTimings?.map((entry) => entry.status)).toEqual(['starting', 'succeeded'])
      expect(result.metadata.providerFileOutput).toMatchObject({
        outputCount: 1,
        requestedDuration: -1,
        metrics: { predict_time: 4.2 }
      })
    })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.replicate.com/v1/models/bytedance/seedance-2.0-fast/predictions',
      'GET https://api.replicate.com/v1/predictions/pred-start',
      'GET https://replicate.delivery/example/seedance.mp4'
    ])
    const createCall = calls[0]!
    expect(createCall.headers.get('authorization')).toBe('Bearer replicate-token')
    expect(createCall.headers.get('prefer')).toBe('wait=60')
    expect(createCall.bodyJson).toEqual({
      input: {
        prompt: 'Use [Image1], [Video1], and [Audio1] for a stylized product reveal',
        duration: -1,
        resolution: '720p',
        aspect_ratio: 'adaptive',
        reference_images: [`data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`],
        reference_videos: [`data:video/mp4;base64,${Buffer.from(new Uint8Array([7, 8, 9])).toString('base64')}`],
        reference_audios: [`data:audio/mpeg;base64,${Buffer.from(new Uint8Array([10, 11, 12])).toString('base64')}`],
        generate_audio: false,
        seed: 123
      }
    })
  })

  test('Replicate terminal failure statuses surface provider errors', async () => {
    for (const status of ['failed', 'canceled', 'aborted'] as const) {
      process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
      installMockFetch((call) => {
        if (call.url === 'https://api.replicate.com/v1/models/alibaba/happyhorse-1.1/predictions' && call.method === 'POST') {
          return jsonResponse({
            id: `pred-${status}`,
            status,
            error: `${status} by provider`
          })
        }
        throw new Error(`Unexpected Replicate terminal fetch: ${call.method} ${call.url}`)
      })

      await withTempDir(async (dir) => {
        await expect(runReplicateVideoGen('A failed request', dir, {
          model: 'alibaba/happyhorse-1.1'
        })).rejects.toThrow(`${status} by provider`)
      })
    }
  })

  test('Replicate current video families send their model-specific request shapes', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    await withTempDir(async (dir) => {
      const { imagePath, lastFramePath, videoPath } = await writeMediaFixtures(dir)
      const cases = [
        {
          model: 'alibaba/happyhorse-1.1' as const,
          options: { mode: 'reference-to-video' as const, referenceImages: [imagePath, lastFramePath], durationSeconds: 6, resolution: '1080p' },
          expected: { images: [expect.stringContaining('data:image/png'), expect.stringContaining('data:image/webp')], duration: 6, resolution: '1080p', aspect_ratio: '16:9' }
        },
        {
          model: 'kwaivgi/kling-v3-video' as const,
          options: { mode: 'interpolate' as const, inputImage: imagePath, lastFrameImage: lastFramePath, durationSeconds: 8, resolution: '4k', generateAudio: true, negativePrompt: 'blur', multiPrompt: '[{"prompt":"first","duration":3},{"prompt":"second","duration":5}]' },
          expected: { mode: '4k', start_image: expect.stringContaining('data:image/png'), end_image: expect.stringContaining('data:image/webp'), duration: 8, generate_audio: true, negative_prompt: 'blur', multi_prompt: '[{"prompt":"first","duration":3},{"prompt":"second","duration":5}]' }
        },
        {
          model: 'kwaivgi/kling-v3-omni-video' as const,
          options: { mode: 'edit' as const, inputVideo: videoPath, resolution: '1080p' },
          expected: { mode: 'pro', reference_video: expect.stringContaining('data:video/mp4'), video_reference_type: 'base' }
        },
        {
          model: 'pixverse/pixverse-v6' as const,
          options: { mode: 'interpolate' as const, inputImage: imagePath, lastFrameImage: lastFramePath, durationSeconds: 10, resolution: '540p', generateAudio: true, multiClip: false, seed: 7 },
          expected: { quality: '540p', image: expect.stringContaining('data:image/png'), last_frame_image: expect.stringContaining('data:image/webp'), duration: 10, generate_audio_switch: true, generate_multi_clip_switch: false, seed: 7 }
        }
      ]

      for (const testCase of cases) {
        const calls = installMockFetch((call) => {
          if (call.method === 'POST') return jsonResponse({ id: `pred-${testCase.model}`, status: 'succeeded', output: 'https://replicate.delivery/example/current.mp4' })
          if (call.url === 'https://replicate.delivery/example/current.mp4') return videoResponse()
          throw new Error(`Unexpected Replicate fetch: ${call.method} ${call.url}`)
        })
        await runReplicateVideoGen('Make a cinematic change', dir, { model: testCase.model, ...testCase.options })
        expect(calls[0]?.url).toBe(`https://api.replicate.com/v1/models/${testCase.model}/predictions`)
        expect(calls[0]?.bodyJson).toEqual({ input: expect.objectContaining({ prompt: 'Make a cinematic change', ...testCase.expected }) })
      }
    })
  })
})
