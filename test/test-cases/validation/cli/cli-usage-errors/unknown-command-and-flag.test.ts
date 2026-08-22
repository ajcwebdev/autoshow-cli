import { expect, test } from 'bun:test'
import { LOCAL_EXAMPLE_AUDIO_PATH } from '../../../../test-utils/test-helpers'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { cookieFlagNameFromSpelling, unsupportedCookieFlagError, unsupportedGlobalFlagError } from '~/cli/native/global-flag-support'
import { getUnknownFlagSpellings } from '~/cli/native/unknown-flag-spellings'
import { coerceAndValidateDraftScenes } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { draftScenesCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { expectUnknownCommand, expectUnknownFlag, expectUsageThrow, parseRoot } from './shared'

test('unknown command exits 2', () => {
  expectUnknownCommand(['definitely-not-a-command'], 'definitely-not-a-command')
})

test('hosted commands reject invalid concurrency modes before dispatch', () => {
  expect(() => buildOptsFromFlags({ 'concurrency-mode': 'fast' }))
    .toThrow('Invalid --concurrency-mode value "fast". Expected "ramp" or "immediate".')
  expect(() => buildOptsFromFlags({ 'concurrency-mode': 'adaptive' }))
    .toThrow('Invalid --concurrency-mode value "adaptive". Expected "ramp" or "immediate".')
  expect(() => coerceAndValidateDraftScenes(parseCommandInvocation(
    ['comic draft-scenes', 'input/scripts/example.md', '--concurrency-mode', 'burst'],
    draftScenesCommandDefinition,
    GLOBAL_FLAG_DEFINITIONS
  ))).toThrow('Invalid --concurrency-mode value "burst". Expected "ramp" or "immediate".')
})

test('unknown flag exits 2', () => {
  expectUnknownFlag(['write', LOCAL_EXAMPLE_AUDIO_PATH, '--structured'], '--structured')
})

test('hosted-only generation commands reject local-only controls', () => {
  for (const argv of [
    ['image', 'prompt', '--all-local'],
    ['video', 'prompt', '--all-local'],
    ['music', 'prompt', '--all-local'],
    ['tts', 'prompt', '--all-local'],
    ['image', 'prompt', '--local-concurrency', '1'],
    ['video', 'prompt', '--local-concurrency', '1'],
    ['music', 'prompt', '--local-concurrency', '1'],
    ['tts', 'prompt', '--local-concurrency', '1']
  ]) {
    expectUnknownFlag(argv, argv[2]!)
  }
})

test('commands reject --characters-root outside voice and comic', () => {
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('extract', 'characters-root') }, '--characters-root is not supported by "extract"')
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('extract', 'characters-root') }, 'Use bun autoshow voice or bun autoshow comic.')
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('config', 'characters-root') }, '--characters-root is not supported by "config"')
})

test('commands reject cookie flags outside config', () => {
  const extractParsed = parseRoot(['extract', '--cookies', './cookies.txt'])
  const extractCookie = getUnknownFlagSpellings(extractParsed.rawParsed)
    .map(cookieFlagNameFromSpelling)
    .find((flagName) => flagName !== undefined)
  expect(extractCookie).toBe('cookies')
  expectUsageThrow(() => { throw unsupportedCookieFlagError(extractParsed.command!.name, extractCookie!) }, '--cookies is not supported by "extract"')
  expectUsageThrow(() => { throw unsupportedCookieFlagError('extract', 'cookies') }, 'Use bun autoshow config --cookies <file> or bun autoshow config --cookies-from-browser <browser>.')
  expectUsageThrow(() => { throw unsupportedCookieFlagError('download', 'cookies-from-browser') }, '--cookies-from-browser is not supported by "download"')
  expectUsageThrow(() => { throw unsupportedCookieFlagError('download', 'cookies-from-browser') }, 'Use bun autoshow config --cookies <file> or bun autoshow config --cookies-from-browser <browser>.')
})

test('commands reject --allow-over-budget on unbudgeted commands', () => {
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('config', 'allow-over-budget') }, '--allow-over-budget is not supported by "config"')
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('config', 'allow-over-budget') }, 'Use --allow-over-budget with pipeline and generation commands that check costs.')
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('voice', 'allow-over-budget') }, '--allow-over-budget is not supported by "voice"')
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('setup', 'allow-over-budget') }, '--allow-over-budget is not supported by "setup"')
  expectUsageThrow(() => { throw unsupportedGlobalFlagError('links', 'allow-over-budget') }, '--allow-over-budget is not supported by "links"')
})
