import { describe, expect, test } from 'bun:test'
import { stripAnsi } from '~/utils/terminal-colors'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from '~/cli/command-definitions'
import { HELP_FLAG_GROUPS } from '~/cli/native/help-groups'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import type { CliFlagsDefinition } from '~/types'

const COMMANDS = COMMAND_DEFINITIONS

const GROUPED_FLAG_SETS: (CliFlagsDefinition | undefined)[] = COMMANDS.flatMap((command) => [
  command.flags,
  ...(command.subcommands ?? []).map((subcommand) => subcommand.flags)
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
  // A group key nothing claims is invisible: `renderGroupedFlags` skips empty
  // groups, so a stale entry survives every `--help` run without a symptom.
  test('every declared group is claimed by at least one flag', () => {
    const claimed = collectClaimedGroups()

    expect(declaredGroupKeys().filter((key) => !claimed.has(key))).toEqual([])
  })

  // The failure this one catches is user-visible but quiet: `renderGroupedFlags`
  // dumps flags whose group is missing from the catalog into an unlabeled block
  // after every labeled section, so the flags still print — just detached from
  // any heading. That is how the fal.ai video flags went unnoticed.
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
