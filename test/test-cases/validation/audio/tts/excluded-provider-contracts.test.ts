import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { TTS_PROVIDERS, type TtsProvider } from '~/types'
import { getModelRegistry, getTtsPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getRetiredModelReplacement } from '~/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { normalizeTtsTurnControls } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { findHostedTtsCredential } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { expectUnknownFlag, parseRootCli } from '../../../../test-utils/cli-assertions'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

// The exclusion decision owns historical identities; runtime code must contain no compatibility inventory.
const decision = readFileSync('docs/adr/ADR-010-hosted-model-registry-lifecycle-and-capability-policy.md', 'utf8')
const section = decision.split('<!-- excluded-tts-providers:start -->')[1]!.split('<!-- excluded-tts-providers:end -->')[0]!
const excluded = section.split('\n').filter(line => /^\| [A-Z][a-z]+\s*\| `/.test(line)).map(line => {
  const cells = line.split('|')
  return { provider: cells[1]!.trim().toLowerCase(), models: [...cells[2]!.matchAll(/`([^`]+)`/g)].map(match => match[1]!) }
})
const dirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-excluded-provider-' })

test('excluded provider decision remains disjoint from active selection, credentials and historical rates', () => {
  expect(excluded).toHaveLength(3)
  const targets = collectTtsTargets(buildOptsFromFlags({ 'all-tts': true }))
  expect(Object.values(getModelRegistry().tts).flatMap(provider => Object.keys(provider.models))).toHaveLength(8)
  expect(targets).toHaveLength(7)
  // Mistral requires a saved voice or an explicitly authorized reference, so it is opt-in.
  expect([...new Set(targets.map(target => target.service))].sort()).toEqual(
    ['elevenlabs', 'gemini', 'grok', 'inworld', 'openai', 'soniox']
  )
  expect(TTS_PROVIDERS).toHaveLength(7)
  for (const { provider, models } of excluded) {
    expect(TTS_PROVIDERS as readonly string[]).not.toContain(provider)
    expect(getModelRegistry().tts[provider]).toBeUndefined()
    expect(findHostedTtsCredential(provider as TtsProvider)).toBeUndefined()
    expect(models.length).toBeGreaterThan(0)
    for (const model of models) {
      expect(targets.some(target => target.service === provider || target.model === model)).toBe(false)
      expect(getTtsPricing(provider, model)).toEqual({})
      expect(getRetiredModelReplacement('tts', provider, model)).toBeUndefined()
    }
  }
})

test('excluded selectors, controls, voice operations and resume fail before network dispatch', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected network dispatch') })
  for (const { provider, models } of excluded) {
    for (const selector of [provider, ...models.map(model => `${provider}=${model}`)]) {
      for (const flag of ['provider', 'tts']) {
        expect(() => normalizeGenericProviderSelectorFlags(
          { [flag]: selector }, new Set([flag]), [{ name: flag, raw: `--${flag}`, value: selector, known: true }],
          flag, STANDALONE_TTS_PROVIDER_TARGETS
        )).toThrow(/provider/i)
      }
    }
    expectUnknownFlag(['tts', 'missing.txt', `--${provider}-tts`, models[0]!], `--${provider}-tts`)
    expect(() => buildOptsFromFlags({ 'openai-tts': true, 'tts-voice': `${provider}=voice-id` })).toThrow(/provider/i)
    expect(() => normalizeTtsTurnControls({ 'dialogue-turn-001': { [provider]: { speed: 1 } } })).toThrow(/provider/i)
    const parsed = parseRootCli(['voice', 'list', '--provider', provider, '--price'])
    await expect(parsed.command!.handler({ argv: parsed.argv, command: parsed.command!, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, store: {} })).rejects.toThrow(/provider/i)
    await expect(ttsResumeConfig.resolveStoredTargets!(
      [{ service: 'openai', model: 'gpt-4o-mini-tts-2025-12-15' }, { service: provider, model: models[0]! }],
      {}, {} as never, {} as never, {} as never
    )).rejects.toThrow('no longer supported for TTS')
  }
  expect(calls).toHaveLength(0)
})

test('obsolete saved configuration and the removed single-provider control are rejected locally', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected network dispatch') })
  const file = join(await dirs.make(), 'config.json')
  for (const { provider, models } of excluded) {
    await Bun.write(file, JSON.stringify({ defaults: { tts: { [`${provider}Tts`]: [models[0]] } } }))
    await expect(loadConfig(file)).rejects.toThrow()
  }
  const removedFlag = decision.match(/only implementation of `(--[^`]+)`/)![1]!
  const configKey = removedFlag.slice('--tts-'.length).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
  expectUnknownFlag(['tts', 'missing.txt', removedFlag, '1'], removedFlag)
  await Bun.write(file, JSON.stringify({ defaults: { tts: { [configKey]: 1 } } }))
  await expect(loadConfig(file)).rejects.toThrow()
  await Bun.write(file, JSON.stringify({ defaults: { tts: { sonioxTts: ['tts-rt-v2'] } } }))
  expect((await loadConfig(file)).defaults?.tts?.sonioxTts).toEqual(['tts-rt-v2'])
  expect(calls).toHaveLength(0)
})
