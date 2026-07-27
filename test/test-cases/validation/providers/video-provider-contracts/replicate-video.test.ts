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

  test('Replicate Wan sends audio and prompt controls', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
    const calls = installMockFetch((call) => {
      if (call.url === 'https://api.replicate.com/v1/models/wan-video/wan-2.7-t2v/predictions' && call.method === 'POST') {
        return jsonResponse({
          id: 'wan-pred',
          status: 'succeeded',
          output: ['https://replicate.delivery/example/wan.mp4']
        })
      }
      if (call.url === 'https://replicate.delivery/example/wan.mp4' && call.method === 'GET') return videoResponse()
      throw new Error(`Unexpected Replicate Wan fetch: ${call.method} ${call.url}`)
    })

    await withTempDir(async (dir) => {
      const audioPath = join(dir, 'voice.wav')
      await writeFile(audioPath, new Uint8Array([13, 14, 15]))
      const result = await runReplicateVideoGen('A cat watching rain outside', dir, {
        model: 'wan-video/wan-2.7-t2v',
        durationSeconds: 5,
        resolution: '1080p',
        aspectRatio: '16:9',
        negativePrompt: 'blurry',
        audio: audioPath,
        promptExpansion: false,
        seed: 999
      })
      expect(result.metadata).toMatchObject({
        videoGenService: 'replicate',
        videoGenModel: 'wan-video/wan-2.7-t2v',
        inputAudio: audioPath,
        providerCostCents: 50
      })
    })

    expect(calls[0]?.bodyJson).toEqual({
      input: {
        prompt: 'A cat watching rain outside',
        duration: 5,
        resolution: '1080p',
        aspect_ratio: '16:9',
        negative_prompt: 'blurry',
        audio: `data:audio/wav;base64,${Buffer.from(new Uint8Array([13, 14, 15])).toString('base64')}`,
        enable_prompt_expansion: false,
        seed: 999
      }
    })
  })

  test('Replicate terminal failure statuses surface provider errors', async () => {
    for (const status of ['failed', 'canceled', 'aborted'] as const) {
      process.env['REPLICATE_API_TOKEN'] = 'replicate-token'
      installMockFetch((call) => {
        if (call.url === 'https://api.replicate.com/v1/models/alibaba/happyhorse-1.0/predictions' && call.method === 'POST') {
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
          model: 'alibaba/happyhorse-1.0'
        })).rejects.toThrow(`${status} by provider`)
      })
    }
  })
})
