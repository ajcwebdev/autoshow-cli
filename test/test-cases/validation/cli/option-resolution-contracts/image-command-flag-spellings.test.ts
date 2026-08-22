import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runVideoGen } from '~/cli/commands/process-steps/step-6-video/run-video-gen'
import { runMusicGen } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { imageCommandFlags, imageCommandOptionNames } from '~/cli/flags/image-flags'
import { musicCommandFlags, musicCommandOptionNames } from '~/cli/flags/music-flags'
import { videoCommandFlags, videoCommandOptionNames } from '~/cli/flags/video-flags'
import type { MusicGenOptions, VideoGenOptions } from '~/types'
import { rejectionMessage, thrownMessage } from '../../../../test-utils/cli-assertions'

const expectOnlyPublicCommandSpellings = (
  registeredFlags: Record<string, unknown>,
  optionNames: Record<string, string>
): void => {
  const registered = Object.keys(registeredFlags)
  expect(Object.values(optionNames).filter((name) => !registered.includes(name))).toEqual([])
  expect(Object.keys(optionNames).filter((name) => registered.includes(name))).toEqual([])
}

describe('image command flag spellings', () => {
  test('the standalone image command registers the public spellings and none of the prefixed ones', () => {
    expectOnlyPublicCommandSpellings(imageCommandFlags, imageCommandOptionNames)
  })

  test('option resolution reads public image command spellings', () => {
    const grokMessage = thrownMessage(() => collectImageTargets(buildOptsFromFlags({
      'grok-image': 'grok-imagine-image-quality',
      'search-grounding': true
    })))
    expect(grokMessage).toContain('--search-grounding is not supported by Grok/grok-imagine-image-quality')
    expect(grokMessage).not.toContain('--image-')
  })
})

describe('video and music command flag spellings', () => {
  test('both standalone commands register only their public option spellings', () => {
    expectOnlyPublicCommandSpellings(videoCommandFlags, videoCommandOptionNames)
    expectOnlyPublicCommandSpellings(musicCommandFlags, musicCommandOptionNames)
  })

  test('option resolution reads public video and music command spellings', () => {
    expect(buildOptsFromFlags({ duration: '8' }).videoDuration).toBe(8)
    expect(buildOptsFromFlags({ duration: '8' }).musicDuration).toBe(8)
    expect(buildOptsFromFlags({ 'lyrics-file': 'lyrics.txt' }).musicLyricsFile).toBe('lyrics.txt')
    expect(buildOptsFromFlags({ size: '1024x1024' }).imageSize).toBe('1024x1024')
  })

  test('runtime provider-list errors match their command-boundary twins', async () => {
    await expect(rejectionMessage(async () => await runVideoGen('prompt', '/tmp/unused', {} as VideoGenOptions)))
      .resolves.toBe('Specify a video generation provider with --provider gemini|grok|ltx|replicate|lumalabs|fal[=model]')
    await expect(rejectionMessage(async () => await runMusicGen('prompt', '/tmp/unused', {} as MusicGenOptions)))
      .resolves.toBe('Specify a music generation provider with --provider elevenlabs|minimax|gemini[=model]')
  })
})
