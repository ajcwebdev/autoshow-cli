import { describe, expect, test } from 'bun:test'
import { CONTROL_SPECS } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import {
  GENERIC_TTS_CONTROL_MAP,
  GENERIC_TTS_IDENTITY_MAP,
  ttsControlsForFlag
} from '~/cli/flags/service-selector-normalization/generic-tts-controls'
import { GENERIC_TTS_OPTION_PROVIDERS } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import {
  GENERIC_STT_OPTION_FLAGS,
  genericSttOptionDefault,
  sttControlsForFlag
} from '~/cli/flags/service-selector-normalization/generic-stt-controls'
import { STT_ENGINE_OPTION_CAPABILITIES, STT_ENGINE_PROVIDER_NAME } from '~/cli/commands/stt/stt-cli'
import { WRITE_STT_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import type { CliFlagDefinition } from '~/types'

// CONTROL_SPECS is index-signature typed, so the compile-time key check in GenericTtsControlMap
// cannot alone prove the named key exists at run time. This is the runtime half of that contract.
describe('generic option registries cannot drift from their capability tables', () => {
  test('every generic TTS flag names a control CONTROL_SPECS defines for that provider', () => {
    const missing: string[] = []
    for (const [flagName, mapping] of Object.entries(GENERIC_TTS_CONTROL_MAP)) {
      for (const [provider, key] of Object.entries(mapping as Record<string, string>)) {
        const spec = (CONTROL_SPECS as Record<string, Record<string, unknown>>)[provider]?.[key]
        if (spec === undefined) missing.push(`--${flagName} -> ${provider}.${key}`)
      }
    }

    expect(missing).toEqual([])
  })

  test('the computed provider list agrees with the control and identity maps', () => {
    for (const flagName of Object.keys(GENERIC_TTS_CONTROL_MAP)) {
      expect(GENERIC_TTS_OPTION_PROVIDERS[flagName]?.providers).toEqual(Object.keys(ttsControlsForFlag(flagName)))
      expect(GENERIC_TTS_OPTION_PROVIDERS[flagName]?.voiceIdentity).toBe(false)
    }
    for (const [flagName, providers] of Object.entries(GENERIC_TTS_IDENTITY_MAP)) {
      expect(GENERIC_TTS_OPTION_PROVIDERS[flagName]?.providers).toEqual([...providers])
      expect(GENERIC_TTS_OPTION_PROVIDERS[flagName]?.voiceIdentity).toBe(true)
    }
  })

  test('every generic STT flag names a capability the engine table declares', () => {
    const declared = new Set<string>()
    for (const capabilities of Object.values(STT_ENGINE_OPTION_CAPABILITIES)) {
      for (const key of Object.keys(capabilities)) declared.add(key)
    }

    for (const flagName of GENERIC_STT_OPTION_FLAGS) {
      const providers = Object.keys(sttControlsForFlag(flagName))
      expect(providers.length).toBeGreaterThan(0)
      for (const provider of providers) expect(provider in WRITE_STT_PROVIDER_TARGETS).toBe(true)
    }
    expect([...declared].sort()).toEqual(['chunkSize', 'languageHint', 'organizationId', 'responseFormat', 'verbatim'])
  })

  test('the engine-to-provider map covers exactly the public STT provider spellings', () => {
    const publicNames = Object.values(STT_ENGINE_PROVIDER_NAME).filter((name): name is string => name !== undefined)

    expect(publicNames.toSorted()).toEqual(Object.keys(WRITE_STT_PROVIDER_TARGETS).toSorted())
  })

  // The two halves of the scoped-repeatable convention: what --help prints and what resolution
  // falls back to must both come from the capability table.
  test('rendered array defaults equal the values derived from the registry', () => {
    const flagSets = COMMAND_DEFINITIONS.flatMap((command) => [
      command.flags,
      ...(command.subcommands ?? []).map((subcommand) => subcommand.flags)
    ])
    let checked = 0
    for (const flags of flagSets) {
      if (!flags) continue
      for (const flagName of GENERIC_STT_OPTION_FLAGS) {
        const definition = flags[flagName] as CliFlagDefinition | undefined
        if (!definition) continue
        checked++
        expect(definition.default).toEqual(genericSttOptionDefault(flagName))
      }
    }

    expect(checked).toBeGreaterThan(0)
  })
})
