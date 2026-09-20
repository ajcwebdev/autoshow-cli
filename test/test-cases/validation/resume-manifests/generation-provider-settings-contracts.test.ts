import { describe, expect, test } from 'bun:test'
import { collectMinimaxMusicTargets } from '~/cli/commands/audio/music/music-services/music-minimax/minimax-music-targets'
import { collectGeminiMusicTargets } from '~/cli/commands/audio/music/music-services/music-gemini/gemini-music-targets'
import { requestedGenerationProvider, writeGenerationMetadata } from '~/cli/commands/command-shared/generation-command-utils'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { collectOpenAIImageTargets } from '~/cli/commands/visuals/image/image-generation-services/image-openai/openai-image-targets'
import { collectGrokVideoTargets } from '~/cli/commands/visuals/video/video-services/video-grok/grok-video-targets'
import type { ImageGenOptions, MusicGenOptions, VideoGenOptions } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'

type SettingsTarget = { service: string, model: string, requestSettings: Record<string, unknown>, ignoredSettings?: readonly string[] | undefined }

const writeAndReadSettings = async (operation: 'image' | 'video' | 'music', target: SettingsTarget) =>
  await withTempDir('generation-settings-', async (dir) => {
    await writeGenerationMetadata(dir, operation, [], {}, {}, {
      input: 'fixture prompt',
      requestedProviders: [requestedGenerationProvider(operation, target)],
      completedProviders: [{ service: target.service, model: target.model }]
    })
    const provider = (await readManifest(dir))?.items[0]?.providers[0]
    return { options: provider?.options, settings: provider?.settings }
  })

const only = <T,>(values: T[]): T => {
  expect(values).toHaveLength(1)
  return values[0] as T
}

describe('generation provider settings in run records', () => {
  test('OpenAI image records runner defaults when no overrides are given', async () => {
    const target = only(collectOpenAIImageTargets({ openaiImageModels: ['gpt-image-2'] } as ImageGenOptions))
    const { options, settings } = await writeAndReadSettings('image', target)
    expect(options).toEqual({})
    expect(settings?.settingsSchema).toBe('openai.image.v1')
    expect(settings?.request).toEqual({
      model: 'gpt-image-2',
      mode: 'generation',
      count: 1,
      size: 'auto',
      quality: 'auto',
      outputFormat: 'png',
      background: 'auto',
      moderation: 'low'
    })
  })

  test('OpenAI image records explicit overrides instead of defaults', async () => {
    const target = only(collectOpenAIImageTargets({
      openaiImageModels: ['gpt-image-2'],
      imageCount: 2,
      imageSize: '1024x1536',
      imageQuality: 'high',
      imageFormat: 'jpeg',
      imageBackground: 'opaque',
      imageCompression: 80
    } as ImageGenOptions))
    const { settings } = await writeAndReadSettings('image', target)
    expect(settings?.request).toMatchObject({
      count: 2,
      size: '1024x1536',
      quality: 'high',
      outputFormat: 'jpeg',
      background: 'opaque',
      compression: 80
    })
  })

  test('Grok video records requested values and the normalized effective values', async () => {
    const target = only(collectGrokVideoTargets({
      grokVideoModels: ['grok-imagine-video-1.5'],
      videoDuration: 6,
      videoResolution: '720p'
    } as VideoGenOptions, 'text'))
    const { settings } = await writeAndReadSettings('video', target)
    expect(settings?.settingsSchema).toBe('grok.video.v1')
    expect(settings?.request).toEqual({
      model: 'grok-imagine-video-1.5',
      mode: 'text',
      durationSeconds: 6,
      resolution: '720p',
      effective: { durationSeconds: 6, aspectRatio: '16:9', resolution: '720p' }
    })
  })

  test('MiniMax music records flags it accepts but ignores', async () => {
    const target = only(collectMinimaxMusicTargets({
      minimaxMusicModels: ['music-3.0'],
      musicDuration: 30,
      musicInstrumental: true,
      musicLyricsFile: 'input/lyrics.txt'
    } as MusicGenOptions))
    const { settings } = await writeAndReadSettings('music', target)
    expect(settings?.settingsSchema).toBe('minimax.music.v1')
    expect(settings?.request).toEqual({
      model: 'music-3.0',
      durationSeconds: 30,
      lyricsFile: 'input/lyrics.txt',
      forceInstrumental: true
    })
    expect(settings?.ignored).toEqual(['duration', 'lyrics-file'])
  })

  test('Gemini music applies duration and records no ignored flags', async () => {
    const target = only(collectGeminiMusicTargets({ geminiMusicModels: ['lyria-3.5'], musicDuration: 30 } as MusicGenOptions))
    const { settings } = await writeAndReadSettings('music', target)
    expect(settings?.request).toEqual({ model: 'lyria-3.5', durationSeconds: 30 })
    expect(settings?.ignored).toBeUndefined()
  })
})
