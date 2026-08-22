import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runVideoGen } from '~/cli/commands/process-steps/step-6-video/run-video-gen'
import { runMusicGen } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import { imageCommandFlags, imageCommandOptionNames } from '~/cli/flags/image-flags'
import { musicCommandFlags, musicCommandOptionNames } from '~/cli/flags/music-flags'
import { videoCommandFlags, videoCommandOptionNames } from '~/cli/flags/video-flags'
import { renameFlagSpellings } from '~/cli/flags/flag-utils'
import type { MusicGenOptions, VideoGenOptions } from '~/types'
import { rejectionMessage, thrownMessage } from '../../../../test-utils/cli-assertions'

const internalNames = Object.keys(imageCommandOptionNames)
const publicNames = Object.values(imageCommandOptionNames)

const expectOnlyPublicCommandSpellings = (
  registeredFlags: Record<string, unknown>,
  optionNames: Record<string, string>
): void => {
  const registered = Object.keys(registeredFlags)
  expect(Object.values(optionNames).filter((name) => !registered.includes(name))).toEqual([])
  expect(Object.keys(optionNames).filter((name) => registered.includes(name))).toEqual([])
}

describe('image command flag spellings', () => {
  test('the standalone image command registers the renamed spellings and none of the pipeline ones', () => {
    expectOnlyPublicCommandSpellings(imageCommandFlags, imageCommandOptionNames)
  })

  test('every internal spelling retargets to exactly its public spelling', () => {
    expect(renameFlagSpellings(internalNames.map((name) => `--${name}`).join(' '), imageCommandOptionNames))
      .toBe(publicNames.map((name) => `--${name}`).join(' '))
  })

  test('shared step-5 rejections retarget to the spellings the image command accepts', () => {
    const grokMessage = thrownMessage(() => collectImageTargets(buildOptsFromFlags(false, {
      'grok-image': 'grok-imagine-image-quality',
      'image-search-grounding': true
    })))
    expect(grokMessage).toContain('--image-search-grounding')
    const retargetedGrok = renameFlagSpellings(grokMessage, imageCommandOptionNames)
    expect(retargetedGrok).toContain('--search-grounding is not supported by Grok/grok-imagine-image-quality')
    expect(retargetedGrok).not.toContain('--image-')

  })
})

describe('video and music command flag spellings', () => {
  test('both standalone commands register only their public option spellings', () => {
    expectOnlyPublicCommandSpellings(videoCommandFlags, videoCommandOptionNames)
    expectOnlyPublicCommandSpellings(musicCommandFlags, musicCommandOptionNames)
  })

  test('both command maps retarget every shared pipeline spelling', () => {
    for (const optionNames of [videoCommandOptionNames, musicCommandOptionNames]) {
      const internal = Object.keys(optionNames)
      const publicNamesForCommand = Object.values(optionNames)
      expect(renameFlagSpellings(internal.map((name) => `--${name}`).join(' '), optionNames))
        .toBe(publicNamesForCommand.map((name) => `--${name}`).join(' '))
    }
  })

  test('runtime provider-list errors match their command-boundary twins', async () => {
    await expect(rejectionMessage(async () => await runVideoGen('prompt', '/tmp/unused', {} as VideoGenOptions)))
      .resolves.toBe('Specify a video generation provider with --provider gemini|grok|ltx|replicate|lumalabs|fal[=model]')
    await expect(rejectionMessage(async () => await runMusicGen('prompt', '/tmp/unused', {} as MusicGenOptions)))
      .resolves.toBe('Specify a music generation provider with --provider elevenlabs|minimax|gemini[=model]')
  })
})
