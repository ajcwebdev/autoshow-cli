import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { STABLE_EXAMPLE_AUDIO_URL } from '../../../../test-utils/test-helpers'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { renameFlagSpellings } from '~/cli/flags/flag-utils'
import { imageCommandOptionNames } from '~/cli/flags/image-flags'
import { videoCommandOptionNames } from '~/cli/flags/video-flags'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { runMusicLyricVideo } from '~/cli/commands/process-steps/step-7-music/lyrics-video/run-lyrics-video'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { asCtx, commandNamed, makeTempRoot, parseRoot, registerUsageErrorCleanup } from './shared'

registerUsageErrorCleanup()

test('video command rejects missing first-class input', () => {
  expect(() => parseRoot(['video'])).toThrow('Missing required parameter: input')
})

test('video positional image rejects ambiguous explicit media input', async () => {
  const root = await makeTempRoot('autoshow-video-ambiguous-media-')
  const imagePath = join(root, 'input.png')
  const otherImagePath = join(root, 'other.png')
  await writeFile(imagePath, new Uint8Array([1, 2, 3]))
  await writeFile(otherImagePath, new Uint8Array([4, 5, 6]))

  const parsed = parseCommandInvocation(
    ['video', imagePath, '--input-image', otherImagePath],
    commandNamed('video'),
    GLOBAL_FLAG_DEFINITIONS
  )
  await expect(videoCommand.handler(asCtx(parsed)))
    .rejects.toThrow('Positional image input cannot be combined with --input-image.')
})

test('video positional image rejects conflicting explicit text mode', async () => {
  const root = await makeTempRoot('autoshow-video-ambiguous-mode-')
  const imagePath = join(root, 'input.png')
  await writeFile(imagePath, new Uint8Array([1, 2, 3]))

  const parsed = parseCommandInvocation(
    ['video', imagePath, '--mode', 'text'],
    commandNamed('video'),
    GLOBAL_FLAG_DEFINITIONS
  )
  await expect(videoCommand.handler(asCtx(parsed)))
    .rejects.toThrow('Positional image input infers --mode image-to-video; do not combine it with --mode text.')
})

test('music lyric-video mode rejects missing audio or batch', async () => {
  await expect(runMusicLyricVideo({ model: 'tiny' }))
    .rejects.toThrow('Missing --audio (or use --batch <dir>)')
})

test('music rejects mixed hosted generation and lyric-video modes', async () => {
  const reject = async (argv: string[], msg: string) => {
    const parsed = parseCommandInvocation(argv, commandNamed('music'), GLOBAL_FLAG_DEFINITIONS)
    await expect(musicCommand.handler(asCtx(parsed))).rejects.toThrow(msg)
  }
  await reject(
    ['music', '--audio', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'minimax=music-3.0'],
    'Do not combine hosted music flags'
  )
  await reject(
    ['music', '--audio', STABLE_EXAMPLE_AUDIO_URL, '--output-dir', 'output/music-run'],
    'Do not combine hosted music flags'
  )
  await reject(
    ['music', 'ambient piano', '--model', 'tiny'],
    'Do not combine lyric-video flags'
  )
})

test('image command rejections name the spellings the image command registers', () => {
  expect(() => collectImageTargets(buildOptsFromFlags(false, {
    'grok-image': 'grok-imagine-image-quality',
    'image-search-grounding': true
  }))).toThrow('--image-search-grounding is not supported by Grok/grok-imagine-image-quality')
  expect(renameFlagSpellings(
    '--image-search-grounding is not supported by Grok/grok-imagine-image-quality',
    imageCommandOptionNames
  )).toContain('--search-grounding is not supported by Grok/grok-imagine-image-quality')
})

test('video command rejections name the spellings the video command registers', () => {
  expect(() => collectVideoTargets(buildOptsFromFlags(false, {
    'grok-video': 'grok-imagine-video',
    'video-mode': 'edit',
    'video-duration': '5'
  }))).toThrow('--video-mode edit requires --video-input-video.')
  expect(renameFlagSpellings(
    '--video-mode edit requires --video-input-video.',
    videoCommandOptionNames
  )).toBe('--mode edit requires --input-video.')
})
