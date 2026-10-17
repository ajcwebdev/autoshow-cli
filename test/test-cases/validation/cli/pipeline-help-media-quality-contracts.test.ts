import { describe, expect, test } from 'bun:test'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseNativeCli } from '~/cli/native/native-parser'
import { renderCommandHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { downloadCommand } from '~/cli/commands/sources/download/define-download-command'
import { extractCommand } from '~/cli/commands/command-shared/extract-routing/define-extract-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { validateCaptionOptions } from '~/cli/commands/stt/workflows/captions/run-caption-export'
import { SUPPORTED_WHISPERFILE_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { resolveSetupModel } from '~/cli/commands/setup-and-utilities/models/run-model-downloads'
import { stripAnsi } from '~/utils/terminal-colors'

const parse = (args: string[]) => parseNativeCli(args, COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)
const resolveDownload = (args: string[]) => {
  const parsed = parse(['download', 'source.mp4', ...args])
  return buildOptsFromFlags(parsed.flags, {}, parsed.rawParsed.explicitFlags, { scope: 'download', flagOccurrences: parsed.rawParsed.flagOccurrences })
}
const compactHelp = (command: typeof downloadCommand) => stripAnsi(renderCommandHelp(createNativeRootDefinition(), command)).replace(/\s+/g, ' ')

describe('download media preparation contract', () => {
  test('the public selector preserves every existing preparation mode and the audio default', () => {
    expect(resolveDownload([])).toMatchObject({ keepOriginalMedia: false, bestQuality: false })
    expect(resolveDownload(['--media-quality', 'audio'])).toMatchObject({ keepOriginalMedia: false, bestQuality: false })
    expect(resolveDownload(['--media-quality', 'original'])).toMatchObject({ keepOriginalMedia: true, bestQuality: false })
    expect(resolveDownload(['--media-quality', 'best'])).toMatchObject({ keepOriginalMedia: false, bestQuality: true })
  })

  test('legacy flags remain accepted and preserve old combined behavior with a seeded canonical default', () => {
    expect(resolveDownload(['--keep-original-media'])).toMatchObject({ keepOriginalMedia: true, bestQuality: false })
    expect(resolveDownload(['--best-quality'])).toMatchObject({ keepOriginalMedia: false, bestQuality: true })
    expect(resolveDownload(['--best-quality', '--keep-original-media'])).toMatchObject({ keepOriginalMedia: true, bestQuality: true })
    const help = compactHelp(downloadCommand)
    expect(help).toContain('--media-quality')
    expect(help).toContain('audio|original|best')
    expect(help).toContain('[default: "audio"]')
    expect(help).not.toContain('--keep-original-media')
    expect(help).not.toContain('--best-quality')
  })

  test('explicit canonical values override retained legacy settings, including resetting to audio', () => {
    for (const quality of ['audio', 'original', 'best']) {
      const opts = buildOptsFromFlags({ 'media-quality': quality, 'keep-original-media': true, 'best-quality': true }, {}, new Set(['media-quality']), { scope: 'download' })
      expect(opts.keepOriginalMedia).toBe(quality === 'original')
      expect(opts.bestQuality).toBe(quality === 'best')
    }
    expect(buildOptsFromFlags({ 'best-quality': true })).toMatchObject({ keepOriginalMedia: false, bestQuality: true })
  })

  test('invalid values and alias conflicts fail in the command handler before target or raw yt-dlp dispatch', async () => {
    for (const args of [
      ['missing.mp4', '--media-quality', 'unknown'],
      ['missing.mp4', '--media-quality', 'best', '--keep-original-media'],
      ['missing.mp4', '--media-quality', 'audio', '--best-quality=false'],
      ['--media-quality', 'best', '--best-quality', '--', '--list-formats', 'https://example.invalid/video']
    ]) {
      const parsed = parse(['download', ...args])
      await expect(downloadCommand.handler({ ...parsed, store: {} })).rejects.toThrow('--media-quality')
    }
    expect(() => resolveDownload(['--media-quality', 'unknown'])).toThrow('Expected audio|original|best')
  })
})

describe('pipeline help defaults and available values', () => {
  test('caption parser defaults match runtime cue limits and explicit overrides still apply', () => {
    const parsed = parse(['extract', 'saved-result.json', '--captions'])
    const baseline = validateCaptionOptions({})
    expect(validateCaptionOptions(parsed.flags)).toEqual(baseline)
    expect(parsed.flags).toMatchObject({ 'caption-max-words': '10', 'caption-max-characters': '58', 'caption-max-duration': '5', 'caption-break-gap': '0.9' })
    const overrides = parse(['extract', 'saved-result.json', '--captions', '--caption-max-words', '6', '--caption-max-characters', '30', '--caption-max-duration', '3', '--caption-break-gap', '0.5'])
    expect(validateCaptionOptions(overrides.flags).limits).toMatchObject({ maxWordsPerCue: 6, maxCharactersPerCue: 30, maxCueDurationSeconds: 3, hardBreakGapSeconds: 0.5 })
    expect(validateCaptionOptions({ 'caption-mode': 'word' }).limits.maxWordsPerCue).toBe(1)
    const help = compactHelp(extractCommand)
    expect(help).toContain('word mode always uses one word')
    for (const value of ['10', '58', '5', '0.9']) expect(help).toContain(`[default: "${value}"]`)
  })

  test('setup advertises every accepted local model and network input constraint', () => {
    const help = compactHelp(setupCommand)
    for (const model of SUPPORTED_WHISPERFILE_MODELS) {
      expect(help).toContain(model)
      expect(resolveSetupModel(model)).toBe(model)
      expect(resolveSetupModel(`whisperfile:${model}`)).toBe(model)
    }
    expect(help).toContain('1–65535')
    expect(help).toContain('Required with --network-check probe')
    expect(() => resolveSetupModel('whisperfile:missing')).toThrow()
  })
})
