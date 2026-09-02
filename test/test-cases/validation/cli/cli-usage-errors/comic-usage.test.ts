import { expect, test } from 'bun:test'
import {
  coerceAndValidateDraftScenes,
  coerceAndValidateGenerateImages
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import {
  draftScenesCommandDefinition,
  generateImagesCommandDefinition,
  generateSlideshowCommandDefinition
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { generateComicSlideshow } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-slideshow/generate-slideshow-command'
import { resolveComicScriptReference } from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { asCtx, expectUnknownCommand, parseRoot } from './shared'

const parseGenerateImagesArgs = (args: string[]) =>
  coerceAndValidateGenerateImages(parseCommandInvocation(
    [generateImagesCommandDefinition.name, ...args],
    generateImagesCommandDefinition,
    GLOBAL_FLAG_DEFINITIONS
  ))

const parseDraftScenesArgs = (args: string[]) =>
  coerceAndValidateDraftScenes(parseCommandInvocation(
    [draftScenesCommandDefinition.name, ...args],
    draftScenesCommandDefinition,
    GLOBAL_FLAG_DEFINITIONS
  ))

test('comic generate-images rejects invalid page selection flags', () => {
  expect(() => parseGenerateImagesArgs(['script.md', '--panels', '4-2'])).toThrow('Invalid panels "4-2"')
  expect(() => parseGenerateImagesArgs(['script.md', '--panels-per-image', '0'])).toThrow('Invalid panels per image "0"')
  expect(() => parseGenerateImagesArgs(['script.md', '--panel-limit', 'nope'])).toThrow('Unexpected flag: --panel-limit')
})

test('comic generate-slideshow validates local timing and audio-selection flags before price reporting', async () => {
  const parsed = (extra: string[]) => parseCommandInvocation(
    [generateSlideshowCommandDefinition.name, 'script.md', ...extra],
    generateSlideshowCommandDefinition,
    GLOBAL_FLAG_DEFINITIONS
  )
  const reject = async (extra: string[], msg: string) => {
    await expect(generateComicSlideshow(asCtx(parsed(extra)), 'script.md')).rejects.toThrow(msg)
  }
  await reject(['--fps', '0'], '--fps must be a positive safe integer')
  await reject(['--fps', '121'], '--fps must be a positive safe integer no greater than 120')
  await reject(['--untimed-panel-ms', '0'], '--untimed-panel-ms must be a positive safe integer')
  await reject(['--audio-target', 'elevenlabs'], '--audio-target must use <provider>=<model>')
  await reject(['--audio-target', 'a=b=c'], '--audio-target must use <provider>=<model>')
})

test('comic generate-images rejects invalid and duplicate image models', () => {
  expect(() => parseGenerateImagesArgs(['script.md', '--image-model', 'not-a-model'])).toThrow('Invalid image model "not-a-model"')
  expect(() => parseGenerateImagesArgs(['script.md', '--image-model', 'gpt-image-2,gpt-image-2'])).toThrow('Duplicate image model "gpt-image-2" is not allowed')
})

test('comic shorthand resolution errors name the expected directory and prefix', async () => {
  await expect(resolveComicScriptReference('99-01'))
    .rejects.toThrow('Expected exactly one Markdown file in "input/scripts/99-script" beginning with "01-"')
})

test('comic generate-images continuity flags require the QA-only audit chain', () => {
  expect(() => parseGenerateImagesArgs(['script.md', '--qa-only', '--continuity-only'])).toThrow('--continuity-only requires --continuity-qa')
  expect(() => parseGenerateImagesArgs(['script.md', '--continuity-qa'])).toThrow('--continuity-qa requires --qa-only')
  expect(() => parseGenerateImagesArgs(['script.md', '--qa-only', '--labels', 'labels.json'])).toThrow('--labels requires --continuity-qa')
  expect(() => parseGenerateImagesArgs(['script.md', '--qa-only', '--continuity-qa', '--trusted-anchor-panel', 'two'])).toThrow('Invalid trusted anchor panel "two"')
})

test('comic generate-images rejects the prompts target as invalid', () => {
  expect(() => parseGenerateImagesArgs(['script.md', '--target', 'prompts'])).toThrow('Invalid target "prompts"')
})

test('comic generate-images rejects variations with non-final targets', () => {
  expect(() => parseGenerateImagesArgs(['script.md', '--target', 'sketches', '--variation', 'cinematic-depth']))
    .toThrow('--variation only applies when --target is images or both')
})

test('comic draft-scenes rejects invalid concurrency values', () => {
  expect(() => parseDraftScenesArgs(['script.md', '--concurrency', '0'])).toThrow('Invalid concurrency')
})

test('comic reference-voice is a nested alias of the public voice verbs', async () => {
  const reject = async (argv: string[], msg: string) => {
    const parsed = parseRoot(argv)
    await expect(parsed.command!.handler(asCtx(parsed))).rejects.toThrow(msg)
  }
  expectUnknownCommand(['comic', 'reference-voice', 'not-an-action'], 'comic reference-voice not-an-action')
  expect(() => parseRoot(['comic', 'reference-voice', 'clone'])).toThrow('Missing required parameter: subject-key')
  await reject(
    ['comic', 'reference-voice', 'clone', 'hero', '--price'],
    '--provider is required.'
  )
  await reject(
    ['comic', 'reference-voice', 'audition', 'vr_123', '--price'],
    'Voice registration generation was not found.'
  )
  await reject(
    ['comic', 'reference-voice', 'audition', 'vr_123', '--approve', '--price'],
    '--actor-id is required.'
  )
  const listed = parseRoot(['comic', 'reference-voice'])
  expect(listed.mode).toBe('command')
  expect(listed.command?.name).toBe('comic reference-voice list')
  await listed.command!.handler(asCtx(listed))
  await reject(
    ['comic', 'reference-voice', 'consent', '--revoke', 'protected-consent:v1:STORE:ASSET:SHA256', '--actor-id', 'casting_editor'],
    '--reason is required.'
  )
  for (const action of ['discover', 'materialize', 'revoke-consent', 'reconcile', 'revoke', 'status', 'inspect']) {
    expectUnknownCommand(['comic', 'reference-voice', action], `comic reference-voice ${action}`)
  }
})
