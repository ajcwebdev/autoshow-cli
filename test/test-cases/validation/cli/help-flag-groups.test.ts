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
  // recorded exception whose default genuinely cannot be one static value. Adding a row here is the
  // only way to keep a prose default, so a new one has to justify itself.
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
        if (Object.hasOwn(PROVIDER_DEPENDENT_DEFAULT_ALLOWLIST, name)) continue
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

    expect(Object.keys(PROVIDER_DEPENDENT_DEFAULT_ALLOWLIST).filter((name) => !named.has(name)).sort()).toEqual([])
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

// Flags whose default is genuinely not one static value, with the reason each one cannot move into
// the `default` field. Keep this list short; anything else belongs in metadata.
const PROVIDER_DEPENDENT_DEFAULT_ALLOWLIST: Record<string, string> = {
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
  prompt: 'Repeatable flag: a seeded array default would be appended to, not replaced by, explicit values.'
}
