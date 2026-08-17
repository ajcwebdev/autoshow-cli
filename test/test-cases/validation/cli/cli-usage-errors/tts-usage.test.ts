import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { runSingleTtsInput } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { assertNoVoiceIdentityWithDialogue, normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_TTS_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { assertDialogueFormatIsUsable } from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { commandNamed, expectUsageExit, registerUsageErrorCleanup, makeTempRoot } from './shared'

registerUsageErrorCleanup()

test('tts rejects missing inputs', async () => {
  const root = await makeTempRoot('autoshow-tts-missing-')
  await expectUsageExit(
    ['tts', join(root, 'missing.md'), '--price'],
    `File not found: ${join(root, 'missing.md')}`
  )
})

test('tts rejects non-text single files', async () => {
  const root = await makeTempRoot('autoshow-tts-non-text-')
  const inputPath = join(root, 'source.json')
  await writeFile(inputPath, '{"text":"hello"}\n')

  expect(isTextInputPath(inputPath)).toBe(false)
  await expect(runSingleTtsInput(inputPath, {} as never, [], undefined))
    .rejects.toThrow(`tts only accepts .md or .txt files. Got: ${inputPath}`)
})

test('tts rejects ambiguous generic TTS options with multiple providers', () => {
  const parsed = parseCommandInvocation(
    ['tts', 'input/examples/tts/1-tts.md', '--provider', 'openai=gpt-4o-mini-tts-2025-12-15', '--provider', 'elevenlabs=eleven_v3', '--tts-voice', 'alloy'],
    commandNamed('tts'),
    GLOBAL_FLAG_DEFINITIONS
  )
  const providers = normalizeGenericProviderSelectorFlags(
    parsed.flags as Record<string, unknown>,
    parsed.rawParsed.explicitFlags,
    parsed.rawParsed.flagOccurrences,
    'provider',
    STANDALONE_TTS_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-tts' }
  )
  expect(() => normalizeGenericTtsOptionFlags(providers.flags, providers.explicitFlags, providers.flagOccurrences))
    .toThrow('--tts-voice requires provider=value when multiple TTS providers are selected.')
})

test('tts rejects --tts-voice combined with dialogue flags', () => {
  expect(() => assertNoVoiceIdentityWithDialogue(
    { ttsSpeakers: ['Host=Jasper'] },
    new Set(['openai-voice'])
  )).toThrow('--tts-voice cannot be combined with --tts-speaker/--tts-dialogue-format; per-speaker voices come from --tts-speaker mappings.')
})

test('tts rejects reference audio combined with dialogue flags', () => {
  expect(() => assertNoVoiceIdentityWithDialogue(
    { ttsSpeakers: ['Host=Jasper'] },
    new Set(['mistral-tts-ref-audio'])
  )).toThrow('Voice identity options such as --tts-ref-audio cannot be combined with --tts-speaker/--tts-dialogue-format; per-speaker voices come from --tts-speaker mappings.')
})


test('tts rejects --tts-dialogue-format without speaker mappings', () => {
  const opts = buildOptsFromFlags(false, {
    'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
    'tts-dialogue-format': 'labeled'
  }, {}, new Set(['tts-dialogue-format']))
  expect(() => assertDialogueFormatIsUsable(opts, new Set(['tts-dialogue-format'])))
    .toThrow('--tts-dialogue-format requires at least one --tts-speaker SPEAKER=VOICE mapping. Speaker mappings select multi-speaker TTS; a dialogue format alone selects nothing.')
})
