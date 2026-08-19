import { describe, expect, test } from 'bun:test'
import { CLI_SOURCE_ENTRY, injectGlobalCliFlags } from '../../../../test-utils/test-helpers'

const OUTPUT_ROOT = '/tmp/harness-output-root'

describe('harness global flag injection', () => {
  test('appends the output root for a processing command', () => {
    expect(injectGlobalCliFlags([CLI_SOURCE_ENTRY, 'tts', 'input.md'], OUTPUT_ROOT, undefined)).toEqual([
      CLI_SOURCE_ENTRY, 'tts', 'input.md', '--output-root', OUTPUT_ROOT
    ])
  })

  test('appends the bin dir override after the output root', () => {
    expect(injectGlobalCliFlags([CLI_SOURCE_ENTRY, 'extract', 'a.mp3'], OUTPUT_ROOT, '/opt/bin')).toEqual([
      CLI_SOURCE_ENTRY, 'extract', 'a.mp3', '--output-root', OUTPUT_ROOT, '--bin-dir', '/opt/bin'
    ])
  })

  test('inserts injected flags before a passthrough separator so AutoShow parses them', () => {
    // Flags placed after `--` would be forwarded to yt-dlp instead of parsed by AutoShow.
    expect(injectGlobalCliFlags(
      [CLI_SOURCE_ENTRY, 'download', 'https://example.com/v', '--', '-f', 'ba'],
      OUTPUT_ROOT,
      '/opt/bin'
    )).toEqual([
      CLI_SOURCE_ENTRY, 'download', 'https://example.com/v',
      '--output-root', OUTPUT_ROOT, '--bin-dir', '/opt/bin',
      '--', '-f', 'ba'
    ])
  })

  test('inserts before the first passthrough separator when a later `--` is a passthrough value', () => {
    expect(injectGlobalCliFlags(
      [CLI_SOURCE_ENTRY, 'download', 'u', '--', '-f', '--'],
      OUTPUT_ROOT,
      undefined
    )).toEqual([
      CLI_SOURCE_ENTRY, 'download', 'u', '--output-root', OUTPUT_ROOT, '--', '-f', '--'
    ])
  })

  test('leaves help invocations untouched', () => {
    const args = [CLI_SOURCE_ENTRY, 'tts', '--help']
    expect(injectGlobalCliFlags(args, OUTPUT_ROOT, '/opt/bin')).toBe(args)

    const shortArgs = [CLI_SOURCE_ENTRY, 'tts', '-h']
    expect(injectGlobalCliFlags(shortArgs, OUTPUT_ROOT, '/opt/bin')).toBe(shortArgs)
  })

  test('leaves non-processing commands and non-CLI entrypoints untouched', () => {
    const setupArgs = [CLI_SOURCE_ENTRY, 'setup', 'whisper']
    expect(injectGlobalCliFlags(setupArgs, OUTPUT_ROOT, '/opt/bin')).toBe(setupArgs)

    const bundleArgs = ['dist/cli.js', 'tts', 'input.md']
    expect(injectGlobalCliFlags(bundleArgs, OUTPUT_ROOT, '/opt/bin')).toBe(bundleArgs)
  })
})
