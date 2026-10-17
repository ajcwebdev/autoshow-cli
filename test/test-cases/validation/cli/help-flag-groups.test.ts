import { describe, expect, test } from 'bun:test'
import { stripAnsi } from '~/utils/terminal-colors'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from '~/cli/command-definitions'
import { HELP_FLAG_GROUPS } from '~/cli/native/help-groups'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import type { CliFlagsDefinition } from '~/types'
import { isRecord } from '../../../test-utils/test-helpers'

const COMMANDS = COMMAND_DEFINITIONS

const GROUPED_FLAG_SETS: (CliFlagsDefinition | undefined)[] = COMMANDS.flatMap((command) => [
  command.flags,
  ...(command.subcommands ?? []).map((subcommand) => subcommand.flags)
])

const collectClaimedGroups = (): Set<string> => {
  const claimed = new Set<string>()
  for (const flags of GROUPED_FLAG_SETS) {
    if (!isRecord(flags)) continue
    for (const definition of Object.values(flags)) {
      if (!isRecord(definition)) continue
      const help = definition['help']
      if (!isRecord(help)) continue
      const group = help['group']
      if (typeof group === 'string') claimed.add(group)
    }
  }
  return claimed
}

const declaredGroupKeys = (): string[] => HELP_FLAG_GROUPS.map(([key]) => key)

describe('help flag group catalog contracts', () => {
  test('every declared group is claimed by at least one flag', () => {
    const claimed = collectClaimedGroups()

    expect(declaredGroupKeys().filter((key) => !claimed.has(key))).toEqual([])
  })

  test('every claimed group is declared, so no flag renders ungrouped', () => {
    const declared = new Set(declaredGroupKeys())

    expect([...collectClaimedGroups()].filter((key) => !declared.has(key)).sort()).toEqual([])
  })

  test('declared group keys are unique', () => {
    const keys = declaredGroupKeys()

    expect(keys.length).toBe(new Set(keys).size)
  })

  test('every registered command has a help group', () => {
    expect(COMMAND_DEFINITIONS.map((command) => command.name).sort()).toEqual(
      Object.keys(HELP_COMMAND_GROUP_BY_NAME).filter((name) => name !== 'version' && name !== 'help').sort()
    )
  })

  test('flag descriptions do not restate a concrete metadata default', () => {
    const restated: string[] = []
    const flagSets: (CliFlagsDefinition | undefined)[] = [...GROUPED_FLAG_SETS, GLOBAL_FLAG_DEFINITIONS]
    for (const flags of flagSets) {
      if (!isRecord(flags)) continue
      for (const [name, definition] of Object.entries(flags)) {
        if (!isRecord(definition) || !('default' in definition)) continue
        const description = definition['description']
        if (typeof description !== 'string') continue
        if (descriptionRestatesDefault(description, definition['default'])) {
          restated.push(`--${name}`)
        }
      }
    }

    expect(restated).toEqual([])
  })

  // Every prose "(default ...)" must either be a declared metadata default the renderer prints, or a
  // recorded exception whose effective default depends on runtime context or meaningful omission.
  // Adding a row here requires a reason a concrete parser default would alter the command contract.
  test('flag descriptions state a prose default only when it cannot be declared as metadata', () => {
    const undeclared: string[] = []
    const flagSets: (CliFlagsDefinition | undefined)[] = [...GROUPED_FLAG_SETS, GLOBAL_FLAG_DEFINITIONS]
    for (const flags of flagSets) {
      if (!isRecord(flags)) continue
      for (const [name, definition] of Object.entries(flags)) {
        if (!isRecord(definition)) continue
        const description = definition['description']
        if (typeof description !== 'string') continue
        if (!statesProseDefault(description)) continue
        if ('default' in definition && definition['default'] !== undefined) continue
        if (Object.hasOwn(RUNTIME_DEFAULT_ALLOWLIST, name)) continue
        undeclared.push(`--${name}`)
      }
    }

    expect([...new Set(undeclared)].sort()).toEqual([])
  })

  test('every allowlisted prose default is still claimed by a registered flag', () => {
    const named = new Set<string>()
    const flagSets: (CliFlagsDefinition | undefined)[] = [...GROUPED_FLAG_SETS, GLOBAL_FLAG_DEFINITIONS]
    for (const flags of flagSets) {
      if (!isRecord(flags)) continue
      for (const [name, definition] of Object.entries(flags)) {
        if (!isRecord(definition)) continue
        const description = definition['description']
        if (typeof description !== 'string') continue
        if (statesProseDefault(description) && !('default' in definition && definition['default'] !== undefined)) named.add(name)
      }
    }

    expect(Object.keys(RUNTIME_DEFAULT_ALLOWLIST).filter((name) => !named.has(name)).sort()).toEqual([])
  })

  test('flag descriptions do not contain conflicting parenthetical default annotations when metadata default is present', () => {
    const conflicting: string[] = []
    const flagSets: (CliFlagsDefinition | undefined)[] = [...GROUPED_FLAG_SETS, GLOBAL_FLAG_DEFINITIONS]
    for (const flags of flagSets) {
      if (!isRecord(flags)) continue
      for (const [name, definition] of Object.entries(flags)) {
        if (!isRecord(definition) || !('default' in definition) || definition['default'] === undefined) continue
        const description = definition['description']
        if (typeof description !== 'string') continue
        if (/\(default/i.test(stripAnsi(description))) {
          conflicting.push(`--${name}`)
        }
      }
    }

    expect(conflicting).toEqual([])
  })
})

const descriptionRestatesDefault = (description: string, defaultValue: unknown): boolean => {
  if (typeof defaultValue !== 'string' && typeof defaultValue !== 'number' && typeof defaultValue !== 'boolean') {
    return false
  }
  const escaped = String(defaultValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\(default:?\\s*["']?${escaped}["']?(?:\\)|\\s*[;,])`, 'i').test(stripAnsi(description))
}

// "(default …)" and ", default: …" are both prose statements of a default value.
const statesProseDefault = (description: string): boolean =>
  /\(defaults?\b|\bdefaults?\s*:/i.test(stripAnsi(description))

// Effective defaults that cannot be seeded as concrete flag values. These exceptions preserve
// provider/profile/stage selection, omitted optional values, and repeatable-list semantics.
// Static defaults that can be applied safely still belong in the flag definition's `default` field.
const RUNTIME_DEFAULT_ALLOWLIST: Record<string, string> = {
  'tts-bitrate': 'Format-dependent: mp3, m4a, and m4b each have their own default bitrate, derived from DEFAULT_TTS_EXPORT_BITRATE_KBPS.',
  provider: 'Route- and domain-dependent: STT, OCR, URL, LLM, TTS and media routes each pick a different default target.',
  llm: 'Resolved as the cheapest registered hosted model at run time.',
  stt: 'Route-dependent local/hosted selection.',
  ocr: 'Route-dependent local/hosted selection.',
  duration: 'Per-provider: ElevenLabs and Gemini Lyria carry different defaults, and the video route differs again.',
  count: 'Per-provider: Gemini and Luma Labs reject the flag entirely rather than defaulting it.',
  'response-mode': 'Gemini-native only; other image providers reject the flag rather than defaulting it.',
  quality: 'Per-provider: OpenAI and Grok resolve "auto" to different concrete values.',
  format: 'Per-provider output format defaults.',
  background: 'OpenAI-only default.',
  'caption-container': 'Derived from the source container at run time (MP4 in, MP4 out; otherwise MKV).',
  'config-path': 'Resolved at run time relative to the project root.',
  'output-root': 'Resolved at run time relative to the project root.',
  'characters-root': 'Resolved at run time relative to the project root.',
  color: 'Auto-detected from the TTY unless FORCE_COLOR/NO_COLOR is set.',
  'panels-per-image': 'Two stage-specific defaults: the final-image stage and the sketch stage differ.',
  prompt: 'Repeatable flag: a seeded array default would be appended to, not replaced by, explicit values.',
  'tts-trim-silence': 'Profile-dependent: an omitted flag keeps the audio profile preset, and any supplied value is rejected with --tts-audio-profile legacy-16k.',
  'gemini-tts-mode': 'Must stay unset when omitted: any value, including unary, requires an explicit Gemini TTS selection.',
  'gemini-tts-batch-wait-seconds': 'Must stay unset when omitted: any value requires --gemini-tts-mode batch.',
  'provider-job-action': 'Must stay unset when omitted: any value is rejected for resume directories without a recorded Gemini provider job.',
  'aspect-ratio': 'Image omission preserves provider sizing, OpenAI requires --size instead, and video defaults differ for fal.ai frame-input routes; no one ratio applies to all consumers.',
  candidates: 'Voice Design resolves three candidates for ElevenLabs and one for Inworld/Gemini; a seeded count would erase the provider-dependent choice.',
  compression: 'Only OpenAI jpeg/webp accepts this optional override; omission delegates compression to the provider, while any concrete value enables an override and is invalid for other providers/formats.',
  image: 'Setup persists image selectors only when supplied; there is no provider to seed for the no-saved-selection state, and seeding a provider would create a configuration change.',
  length: 'Omission means no export-length cap; accepted values are positive integer character-thousands, so no concrete accepted value represents the unlimited state.',
  'max-generation-slots': 'Omission allows all unresolved comic audio slots; any accepted positive integer adds a checkpoint limit, so no concrete value represents the unlimited state.',
  'max-model-cents': 'Omission disables per-model filtering; every finite non-negative amount imposes a ceiling and can exclude targets.',
  'max-repairs': 'Comic generation defaults to two repairs, QA-only and revision plans default to zero, and character references reject the option entirely.',
  music: 'Setup persists music selectors only when supplied; no-saved-selection is absence rather than a provider value, and a seeded provider would create a configuration change.',
  'negative-prompt': 'Omission sends no negative-prompt field; a literal none would change the prompt, and the control is accepted only by the selected Replicate models.',
  only: 'Comic draft-scenes uses absence for the full pipeline; its accepted values select individual stages and contain no all-stages sentinel.',
  'panel-count': 'Treatment drafting has a concrete count default, but scene drafting leaves the count unconstrained unless supplied; a seeded count would require matching authored panel notes.',
  resolution: 'Video resolution defaults vary by provider/model, including Grok 480p, LTX 1080p, H3 2k, and H3 Max 768p; one parser value would override those choices.',
  seed: 'Video omission requests provider randomness; voice design also accepts the seed only for ElevenLabs. No fixed integer preserves random generation or unsupported-provider omission.',
  size: 'Image sizing varies by provider/model; comic reference sketches also select portrait versus landscape by character/location, so a shared concrete size would override route defaults.',
  speaker: 'Treatment dialogue speaker assignments are repeatable; omission means narration only, and any seeded character key changes the cast and dialogue routing.',
  'stt-audio-profile': 'Absence remains an optional runtime value passed into media preparation and recorded settings; the default compression fallback is resolved later rather than setting an explicit profile.',
  'tts-channels': 'Native delivery preserves provider channels, audiobook resolves mono, and legacy-16k rejects overrides; a concrete parser value would force channels or create a profile conflict.',
  'tts-chunk-size': 'Omission uses the selected provider/model input limit; any fixed maximum changes chunk boundaries and retained plan identity for at least some models.',
  'tts-cover': 'Omission adds no cover; every concrete path requests a file and is validated against the export format, including rejection for WAV.',
  'tts-dialogue-format': 'Omission preserves single-voice mode; any accepted screenplay/labeled value enables dialogue validation and requires --tts-speaker mappings.',
  'tts-instructions': 'Repeatable provider-scoped free-form instructions are absent by default; a seeded string changes delivery, and empty instruction strings are invalid.',
  'tts-language': 'Provider-scoped language defaults differ: Soniox en, Grok auto, and ElevenLabs language detection; seeded assignments also append to explicit repeatable values.',
  'tts-lead-in': 'Profile-dependent silence is zero for native and 500 ms for audiobook; legacy-16k rejects mastering overrides.',
  'tts-lead-out': 'Profile-dependent silence is zero for native and 1000 ms for audiobook; legacy-16k rejects mastering overrides.',
  'tts-loudness': 'Native delivery omits normalization, audiobook uses -19 LUFS, and legacy-16k rejects overrides; neither off nor a numeric target preserves every profile.',
  'tts-metadata': 'Omission emits no tags; repeatable nonempty key=value entries request tagging and are invalid for WAV, so no concrete seeded entry preserves absence.',
  'tts-pronunciation-dictionary': 'Repeatable ElevenLabs dictionary locators are absent by default; a seeded locator changes pronunciation, requires a real dictionary ID, and is unsupported by other providers.',
  'tts-response-format': 'Gemini defaults to WAV for unary/batch and PCM for streaming while ElevenLabs defaults to mp3_44100_128; seeded repeatable assignments cannot preserve transport/provider choices.',
  'tts-sample-rate': 'Native delivery preserves provider sample rate, audiobook resolves 44100 Hz, and legacy-16k rejects overrides; one parser rate would force resampling or fail.',
  'tts-seed': 'Omission retains provider randomness; every valid integer fixes a generation seed, and the provider-scoped repeatable flag is supported only by ElevenLabs.',
  'tts-similarity': 'Omission preserves the ElevenLabs voice setting; every numeric value overrides it, and eleven_v3 rejects the control.',
  'tts-speaker': 'Repeatable dialogue voice mappings are absent in single-voice mode; a seeded SPEAKER=VOICE would enable dialogue and require a matching speaker and voice.',
  'tts-speaker-boost': 'Omission preserves the ElevenLabs voice setting; seeded true or false forces an override, and eleven_v3 rejects this control.',
  'tts-speed': 'Soniox resolves speed 1 while other providers omit the override; Eleven v3 rejects numeric speed, and seeded repeatable assignments would apply controls to unsupported selections.',
  'tts-stability': 'Omission preserves the ElevenLabs voice setting; every numeric value explicitly changes stability, and a seeded provider assignment would be invalid for other selected providers.',
  'tts-style': 'Omission preserves the ElevenLabs voice setting; every numeric value changes style, and eleven_v3 rejects the control.',
  'tts-text-normalization': 'Grok resolves false while ElevenLabs delegates to its provider setting and accepts a different value type; a shared seeded assignment would override that distinction.',
  'tts-true-peak': 'The ceiling depends on the chosen normalization policy: audiobook -3 dBTP or native loudness override -1.5; native without normalization and legacy-16k reject the control.',
  variation: 'Omitted comic variations use canonical generation with legacy output paths; explicitly selecting canonical enables variation-specific output paths, so seeding canonical changes artifact locations.'
}
