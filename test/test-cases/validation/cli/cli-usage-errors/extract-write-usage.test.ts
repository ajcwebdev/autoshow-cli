import { expect, test } from 'bun:test'
import { LOCAL_EXAMPLE_AUDIO_PATH } from '../../../../test-utils/test-helpers'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { validateOcrProviderModeCommandFlags } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/command-validation'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { runExtractTranscriptVideo } from '~/cli/commands/process-steps/step-2-extract/transcript-video/run-transcript-video'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { asCtx, commandNamed, expectUnknownFlag } from './shared'

test('extract rejects invalid OCR provider modes before dispatch', () => {
  expect(() => buildOptsFromFlags({ 'ocr-provider-mode': 'round-robin' }))
    .toThrow('Expected fanout or pool')
})

test('extract rejects primary OCR selection in pool mode before dispatch', async () => {
  const parsed = parseCommandInvocation(
    ['extract', 'input.pdf', '--ocr-provider-mode', 'pool', '--primary-ocr', 'openai'],
    commandNamed('extract'),
    GLOBAL_FLAG_DEFINITIONS
  )
  expect(() => validateOcrProviderModeCommandFlags(asCtx(parsed))).toThrow(
    '--primary-ocr cannot be used with --ocr-provider-mode pool'
  )
})

test('write rejects extract OCR flags', () => {
  expectUnknownFlag(['write', 'notes.md', '--ocr-provider-mode', 'pool'], '--ocr-provider-mode')
  expectUnknownFlag(['write', 'notes.md', '--primary-ocr', 'openai'], '--primary-ocr')
})

test('extract rejects LLM-only provider flags as unknown flags', () => {
  expectUnknownFlag(['extract', LOCAL_EXAMPLE_AUDIO_PATH, '--llama'], '--llama')
})

test('extract rejects unsupported URL article option flags', () => {
  expectUnknownFlag(
    ['extract', 'https://example.com/article', '--url-include-selector', 'article'],
    '--url-include-selector'
  )
  expectUnknownFlag(
    ['extract', 'https://example.com/article', '--url-provider', 'firecrawl'],
    '--url-provider'
  )
})

test('resume rejects public --url-provider on extract resume', () => {
  expectUnknownFlag(['resume', 'output/x', '--url-provider', 'supadata'], '--url-provider')
})

test('extract rejects invalid URL article backend names', () => {
  expect(() => buildOptsFromFlags({ 'url-provider': 'browserless' }))
    .toThrow('Invalid --url-provider value "browserless". Expected "defuddle", "firecrawl", "glm-reader", "spider", "supadata", or "zyte".')
})

test('extract rejects unsupported ScrapeCreators STT modes', () => {
  expect(() => buildOptsFromFlags({ 'scrapecreators-stt': 'auto' }))
    .toThrow('Invalid model "auto" for --provider/--stt scrapecreators[=model]. Allowed values: youtube-transcript')
})

test('extract transcript-video flags require transcript-video mode', async () => {
  const parsed = parseCommandInvocation(
    ['extract', LOCAL_EXAMPLE_AUDIO_PATH, '--transcript-result', 'output/run/result.json'],
    commandNamed('extract'),
    GLOBAL_FLAG_DEFINITIONS
  )
  await expect(extractCommand.handler(asCtx(parsed)))
    .rejects.toThrow('--transcript-result require --transcript-video')
})

test('extract transcript-video manual mode requires audio and one transcript source', async () => {
  await expect(runExtractTranscriptVideo(undefined, { 'transcript-video': true, 'transcript-result': 'output/run/result.json' }))
    .rejects.toThrow('Manual transcript-video mode requires --audio')
  await expect(runExtractTranscriptVideo(undefined, { 'transcript-video': true, audio: LOCAL_EXAMPLE_AUDIO_PATH }))
    .rejects.toThrow('Manual transcript-video mode requires exactly one of --transcript-result or --transcript-text')
})
