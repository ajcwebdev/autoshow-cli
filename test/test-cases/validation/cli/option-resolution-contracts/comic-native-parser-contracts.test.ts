import { describe,expect,test } from 'bun:test'
import {
coerceAndValidateGenerateImages
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import {
draftScenesCommandDefinition,
generateAudioCommandDefinition,
generateImagesCommandDefinition,
generateSlideshowCommandDefinition,
referenceSketchCommandDefinition
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import {
comicGenerateAudioFlags,
comicGenerateSlideshowFlags,
draftScenesFlags,
generateImagesFlags,
referenceSketchFlags
} from '~/cli/flags/comic-flags'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'

const parseSubcommandArgs = (args: string[], command: typeof draftScenesCommandDefinition | typeof generateImagesCommandDefinition | typeof generateAudioCommandDefinition | typeof generateSlideshowCommandDefinition | typeof referenceSketchCommandDefinition) =>
  parseCommandInvocation([command.name, ...args], command, GLOBAL_FLAG_DEFINITIONS)

const parseGenerateImagesArgs = (args: string[]) =>
  coerceAndValidateGenerateImages(parseSubcommandArgs(args, generateImagesCommandDefinition))

describe('comic native parser definitions', () => {
  test('uses the help flag tables directly as the parser definitions', () => {
    expect(draftScenesCommandDefinition.flags).toBe(draftScenesFlags)
    expect(generateImagesCommandDefinition.flags).toBe(generateImagesFlags)
    expect(generateAudioCommandDefinition.flags).toBe(comicGenerateAudioFlags)
    expect(generateSlideshowCommandDefinition.flags).toBe(comicGenerateSlideshowFlags)
    expect(referenceSketchCommandDefinition.flags).toBe(referenceSketchFlags)
  })

  test('parses comic slideshow target and local timing options from its native flag table', () => {
    const parsed = parseSubcommandArgs(['script.md', '--audio-target=elevenlabs=eleven_v3', '--untimed-panel-ms', '2500', '--fps', '24', '--price'], generateSlideshowCommandDefinition)
    expect(parsed.parameters['script-path']).toBe('script.md')
    expect(parsed.flags).toMatchObject({ 'audio-target': 'elevenlabs=eleven_v3', 'untimed-panel-ms': '2500', fps: '24', price: true })
  })

  test('parses comic generate-audio --slideshow and rejects the retired --panel-video alias', () => {
    const slideshow = parseSubcommandArgs(['script.md', '--slideshow'], generateAudioCommandDefinition)
    expect(slideshow.flags['slideshow']).toBe(true)

    expect(() => parseSubcommandArgs(['script.md', '--panel-video'], generateAudioCommandDefinition))
      .toThrow('--panel-video')
  })

  test('uses native inline assignment, separator, last-wins, and positional rules', () => {
    expect(parseGenerateImagesArgs(['script.md', '--panels-per-image=1', '--grid=2x3', '--grid=3x2']).grid)
      .toEqual({ columns: 3, rows: 2 })
    expect(parseGenerateImagesArgs(['script.md', '--qa=false']).qa).toBe(false)
    expect(parseGenerateImagesArgs(['script.md', '--target=sketches', '--']).target).toBe('sketches')
    expect(() => parseGenerateImagesArgs(['script.md', 'extra.md']))
      .toThrow('Unexpected parameter "extra.md"')
  })
})
