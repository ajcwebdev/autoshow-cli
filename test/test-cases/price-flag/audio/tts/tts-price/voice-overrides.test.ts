import { expect, test } from 'bun:test'
import { STABLE_TTS_MD_PATH } from '../../../../../test-utils/test-helpers'
import { expectPriceEstimateForModel, runTtsPriceCommand } from './shared'

test('Mistral selectors fail locally in price mode', async () => {
  const result = await runTtsPriceCommand(['src/cli/create-cli.ts', 'tts', STABLE_TTS_MD_PATH, '--provider', 'mistral=voxtral-mini-tts-2603', '--price', '--json'])
  expect(result.exitCode).toBe(2)
  expect(result.stderr + result.stdout).toContain('mistral')
})

test('all-provider price includes supported models and excludes Mistral', async () => {
  const result = await runTtsPriceCommand(['src/cli/create-cli.ts', 'tts', STABLE_TTS_MD_PATH, '--all-providers', '--price', '--json'])
  expectPriceEstimateForModel(result, 'gpt-4o-mini-tts-2025-12-15')
  expect(result.stdout).not.toContain('voxtral-mini-tts')
})
