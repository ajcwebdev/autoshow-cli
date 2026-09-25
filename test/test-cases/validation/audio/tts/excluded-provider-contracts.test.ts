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
  expect(excluded).toHaveLength(4)
  const targets = collectTtsTargets(buildOptsFromFlags({ 'all-tts': true }))
  expect(Object.values(getModelRegistry().tts).flatMap(provider => Object.keys(provider.models))).toHaveLength(7)
  expect(targets).toHaveLength(7)
  expect([...new Set(targets.map(target => target.service))].sort()).toEqual(
    ['elevenlabs', 'gemini', 'grok', 'inworld', 'openai', 'soniox']
  )
  expect(TTS_PROVIDERS).toHaveLength(6)
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
        )).toThrow(/provider|no longer supported/i)
      }
    }
    expectUnknownFlag(['tts', 'missing.txt', `--${provider}-tts`, models[0]!], `--${provider}-tts`)
    expect(() => buildOptsFromFlags({ 'openai-tts': true, 'tts-voice': `${provider}=voice-id` })).toThrow(/provider|no longer supported/i)
    expect(() => normalizeTtsTurnControls({ 'dialogue-turn-001': { [provider]: { speed: 1 } } })).toThrow(/provider|no longer supported/i)
    const parsed = parseRootCli(['voice', 'list', '--provider', provider, '--price'])
    await expect(parsed.command!.handler({ argv: parsed.argv, command: parsed.command!, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, store: {} })).rejects.toThrow(/provider|no longer supported/i)
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

test('Mistral TTS removal rejects voice provider selection, comic selection, raw settings and reference flag without network', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
  const { resolveComicAudioInvocation } = await import('~/cli/commands/visuals/comic/comic-commands/generate-audio/comic-audio-invocation')
  for (const argv of [
    ['voice', 'list', '--provider', 'mistral', '--price'],
    ['voice', 'import', 'hero', '--provider', 'mistral', '--model', 'voxtral-mini-tts-2603', '--voice-id', 'saved', '--price'],
    ['voice', 'clone', 'hero', '--provider', 'mistral', '--model', 'voxtral-mini-tts-2603', '--price'],
  ]) {
    const parsed = parseRootCli(argv)
    await expect(parsed.command!.handler({ argv: parsed.argv, command: parsed.command!, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, store: {} })).rejects.toThrow('mistral is no longer supported for TTS or voice management.')
  }
  const parsed = parseRootCli(['comic', 'generate-audio', '01-01', '--provider', 'mistral=voxtral-mini-tts-2603', '--price'])
  await expect(resolveComicAudioInvocation({ argv: parsed.argv, command: parsed.command!, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, store: {} }, 'unused.md')).rejects.toThrow(/provider|no longer supported/i)
  expect(() => collectTtsTargets({ mistralTtsModels: ['voxtral-mini-tts-2603'] } as never)).toThrow('no longer supported')
  for (const flag of ['tts-voice', 'tts-response-format', 'tts-speed', 'tts-instructions']) expect(() => buildOptsFromFlags({ 'openai-tts': true, [flag]: 'mistral=voice' })).toThrow(/provider|no longer supported/i)
  expectUnknownFlag(['tts', 'missing.txt', '--tts-ref-audio', 'reference.wav'], '--tts-ref-audio')
  expect(calls).toHaveLength(0)
})

test('saved Mistral voices reject audition and management without changing retained assets or dispatching', async () => {
  const calls = installMockFetch(() => { throw new Error('Unexpected dispatch') })
  const { buildReadyVoiceRegistrationDraft } = await import('~/cli/commands/audio/voice/voice-registration-management')
  const { planCanonicalVoiceAudition, runCanonicalVoiceAudition } = await import('~/cli/commands/audio/voice/canonical-voice-audition')
  const { configureCharactersRoot, getCharactersRoot } = await import('~/cli/commands/command-shared/characters-root')
  const { resolveCharacterVoiceRegistryPaths } = await import('~/cli/commands/audio/voice/character-voice-registry')
  const brief = {
    subjectKey: 'hero', profileKey: 'default', language: 'en', locale: 'en-US',
    timbre: 'warm', mannerisms: [], prohibitedCaricatures: [], pronunciations: [],
    allowedOrigins: ['provider-stock' as const],
  }
  const draft = buildReadyVoiceRegistrationDraft({
    subjectKey: brief.subjectKey, profileKey: brief.profileKey, brief,
    provider: 'elevenlabs', providerModel: 'eleven_v3',
    providerVoice: {
      kind: 'remote-resource', provider: 'elevenlabs', resourceId: 'saved-voice',
      namespace: 'provider', origin: 'provider-stock', ownership: 'provider',
      deletion: { state: 'provider-managed', checkedAt: '2026-09-25T00:00:00.000Z' },
    },
    provenanceRef: 'project:casting', capabilityFixtureHash: 'b'.repeat(64),
  })
  const saved = { ...draft, provider: 'mistral', providerModel: 'voxtral-mini-tts-2603' }
  expect(() => planCanonicalVoiceAudition(saved as never, brief, 'We leave at dawn.')).toThrow('no longer supported for voice auditions')
  await expect(runCanonicalVoiceAudition({
    registration: saved as never, brief, representativeLine: 'We leave at dawn.',
    protectedStore: {} as never,
  })).rejects.toThrow('no longer supported for voice auditions')
  const previousRoot = getCharactersRoot()
  const root = await dirs.make()
  const catalogPath = resolveCharacterVoiceRegistryPaths(root).registrations
  const retained = JSON.stringify({ schemaVersion: 1, registrations: [saved] })
  await Bun.write(catalogPath, retained)
  configureCharactersRoot(root)
  try {
    for (const operation of ['list', 'audition', 'delete']) {
      const parsed = parseRootCli(['voice', operation, saved.registrationId, '--generation-id', saved.generationId, '--price'])
      await expect(parsed.command!.handler({ argv: parsed.argv, command: parsed.command!, flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed, store: {} })).rejects.toThrow(/provider/i)
      expect(await Bun.file(catalogPath).text()).toBe(retained)
    }
  } finally {
    configureCharactersRoot(previousRoot)
  }
  expect(calls).toHaveLength(0)
})
