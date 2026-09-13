import { UsageError } from '~/utils/error-handler'
import { resolveHelpWidth, wrapHelpDescription } from './help-line-wrap'
import { getHelpTopics } from './help-topics'
import type { CliHelpRenderOptions } from '~/types'
import {
  colorText,
  HELP_DEFAULT_VALUE_COLOR_NAME,
  HELP_TYPE_COLOR
} from '~/cli/help-colors'
import { getNativeRenderableCommands } from './builtins'
import { globalFlagsForCommand } from './global-flag-support'
import type { CliCommandDefinition, CliCommandHelpDefinition, CliFlagDefinition, CliFlagsDefinition, CliParameterDefinition, CliRootDefinition } from '~/types'

export const HELP_EXAMPLE_ALIGN_COLUMN_CAP = 100

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g

const formatType = (definition: CliFlagDefinition): string => {
  const label = Array.isArray(definition.type)
    ? 'Array<String>'
    : definition.type === Boolean
      ? 'Boolean'
      : 'String'
  return colorText(label, HELP_TYPE_COLOR)
}

const formatParameterType = (parameter: CliParameterDefinition): string =>
  parameter.key.includes('...')
    ? 'Array<string>'
    : 'string'

const formatDefaultValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  return String(value)
}

const formatDefault = (value: unknown): string =>
  colorText(`[default: ${formatDefaultValue(value)}]`, HELP_DEFAULT_VALUE_COLOR_NAME)

const visibleLength = (value: string): number =>
  value.replace(ANSI_ESCAPE_PATTERN, '').length

const padRight = (value: string, width: number): string =>
  visibleLength(value) >= width ? value : `${value}${' '.repeat(width - visibleLength(value))}`

const flagGroup = (definition: CliFlagDefinition): string | undefined => {
  const group = definition.help?.['group']
  return typeof group === 'string' ? group : undefined
}

const isFlagHidden = (definition: CliFlagDefinition): boolean =>
  definition.help?.hidden === true

const isCommandHidden = (command: CliCommandHelpDefinition): boolean =>
  command.help?.hidden === true

const formatFlagName = (name: string, definition: CliFlagDefinition): string => {
  if (definition.type === Boolean && definition.negatable === true) {
    return definition.short ? `--${name}, --no-${name}, -${definition.short}` : `--${name}, --no-${name}`
  }
  return definition.short ? `--${name}, -${definition.short}` : `--${name}`
}

const shouldRenderDefault = (definition: CliFlagDefinition): boolean => {
  if (!('default' in definition) || definition.default === undefined) {
    return false
  }
  if (definition.type === Boolean && definition.default === false) {
    return false
  }
  return true
}

const renderFlagRows = (flags: CliFlagsDefinition, indent = '  ', width = 120): string[] => {
  const rows = Object.entries(flags).filter(([, definition]) => !isFlagHidden(definition)).map(([name, definition]) => {
    const defaultSuffix = shouldRenderDefault(definition) ? ` ${formatDefault(definition.default)}` : ''
    return [
      formatFlagName(name, definition),
      formatType(definition),
      `${definition.description}${defaultSuffix}`
    ] as const
  })
  const nameWidth = rows.reduce((width, [name]) => Math.max(width, visibleLength(name)), 0)
  const typeWidth = rows.reduce((width, [, type]) => Math.max(width, visibleLength(type)), 0)
  return rows.map(([name, type, description]) => {
    const prefix = `${indent}${padRight(name, nameWidth)}  ${padRight(type, typeWidth)}  `
    if (visibleLength(prefix) > width * 0.6) {
      return `${indent}${name}  ${type}\n${wrapHelpDescription(`${indent}  `, description, width)}`
    }
    return wrapHelpDescription(prefix, description, width)
  })
}

const orderGlobalFlags = (flags: CliFlagsDefinition): CliFlagsDefinition => {
  const entries = Object.entries(flags)
  const order = ['version', 'help']
  const orderedEntries = [
    ...order.flatMap((name) => {
      const definition = flags[name]
      return definition ? [[name, definition] as const] : []
    }),
    ...entries.filter(([name]) => !order.includes(name))
  ]
  return Object.fromEntries(orderedEntries) as CliFlagsDefinition
}

const renderGroupedFlags = (
  flags: CliFlagsDefinition,
  groups: CliRootDefinition['flagGroups'],
  width: number
): string[] => {
  const entries = Object.entries(flags)
  if (entries.length === 0) {
    return []
  }

  const groupedKeys = new Set<string>()
  const lines: string[] = []
  for (const [groupKey, label] of groups) {
    const groupEntries = entries.filter(([, definition]) => flagGroup(definition) === groupKey)
    if (groupEntries.length === 0) {
      continue
    }
    for (const [key] of groupEntries) {
      groupedKeys.add(key)
    }
    const visibleGroupFlags = Object.fromEntries(
      groupEntries.filter(([, definition]) => !isFlagHidden(definition))
    ) as CliFlagsDefinition
    if (Object.keys(visibleGroupFlags).length === 0) {
      continue
    }
    lines.push(`  ${label}`, ...renderFlagRows(visibleGroupFlags, '    ', width), '')
  }

  const ungrouped = Object.fromEntries(
    entries.filter(([name, definition]) => !groupedKeys.has(name) && !isFlagHidden(definition))
  ) as CliFlagsDefinition
  if (Object.keys(ungrouped).length > 0) {
    lines.push(...renderFlagRows(ungrouped, '  ', width), '')
  }

  return lines
}

const renderParameters = (command: CliCommandHelpDefinition): string[] => {
  const parameters = command.parameters ?? []
  if (parameters.length === 0) {
    return []
  }

  const rows = parameters.map((parameter) => [
    parameter.key,
    formatParameterType(parameter),
    parameter.description ?? ''
  ] as const)
  const nameWidth = rows.reduce((width, [name]) => Math.max(width, visibleLength(name)), 0)
  const typeWidth = rows.reduce((width, [, type]) => Math.max(width, visibleLength(type)), 0)
  return [
    'Parameters',
    ...rows.map(([name, type, description]) => {
      const prefix = `  ${padRight(name, nameWidth)}  ${padRight(type, typeWidth)}`
      return description.length > 0 ? `${prefix}  ${description}` : prefix
    }),
    ''
  ]
}

const renderSubcommands = (command: CliCommandHelpDefinition): string[] => {
  const prefix = `${command.name} `
  const subcommands = (command.subcommands ?? []).filter((subcommand) => !isCommandHidden(subcommand)).map((subcommand) => [
    subcommand.name.startsWith(prefix) ? subcommand.name.slice(prefix.length) : subcommand.name,
    subcommand.description
  ] as const)
  if (subcommands.length === 0) {
    return []
  }
  const width = subcommands.reduce((value, [name]) => Math.max(value, visibleLength(name)), 0)
  return [
    'Subcommands',
    ...subcommands.map(([name, description]) => `  ${padRight(name, width)}  ${description}`),
    ''
  ]
}

const renderExamples = (command: CliCommandHelpDefinition): string[] => {
  const examples = command.help?.examples ?? []
  if (examples.length === 0) {
    return []
  }
  const width = examples.reduce((value, [example]) => Math.max(value, visibleLength(example)), 0)
  const rows = width > HELP_EXAMPLE_ALIGN_COLUMN_CAP
    ? examples.flatMap(([example, description]) => [`  ${example}`, `    ${description}`])
    : examples.map(([example, description]) => `  ${padRight(example, width)}  -  ${description}`)
  return [
    'Examples',
    ...rows,
    ''
  ]
}

const renderNotes = (command: CliCommandHelpDefinition): string[] => {
  const notes = command.help?.notes ?? []
  if (notes.length === 0) {
    return []
  }
  return ['Notes', ...notes.map((note) => `  ${note}`), '']
}

const formatVersion = (version: string): string =>
  version.startsWith('v') ? version : `v${version}`

export const renderRootHelp = (
  root: CliRootDefinition,
  commands: readonly CliCommandDefinition[],
  options: CliHelpRenderOptions = {}
): string => {
  const width = resolveHelpWidth(options.width)
  if (options.topic && !['overview', 'globals'].includes(options.topic)) throw UsageError(`Unknown root help topic \"${options.topic}\". Available topics: overview, globals.`)
  const lines = [
    `${root.scriptName} ${formatVersion(root.version)} - ${root.description}`,
    '',
    'Usage',
    `  $ ${root.scriptName} <command> [flags]`,
    '',
    'Commands'
  ]

  const commandEntries = getNativeRenderableCommands(commands).map((command) => [command, command.help?.group] as const)
  for (const [groupKey, label] of root.commandGroups) {
    const groupCommands = commandEntries
      .filter(([, group]) => group === groupKey)
      .map(([command]) => command)
    if (groupCommands.length === 0) {
      continue
    }
    lines.push(`  ${label}`)
    const nameWidth = groupCommands.reduce((width, command) => Math.max(width, visibleLength(command.name)), 0)
    for (const command of groupCommands) {
      lines.push(`    ${padRight(command.name, nameWidth)}  ${command.description}`)
    }
    lines.push('')
  }

  if (options.topic === 'globals') lines.splice(5)
  if (options.topic !== 'overview') lines.push('Global Flags', ...renderFlagRows(orderGlobalFlags(root.globalFlags), '  ', width), '')
  if (options.topic !== 'globals') lines.push('Examples', `  ${root.scriptName} extract document.pdf --price`, '    Preview local document extraction', `  ${root.scriptName} write notes.md --price`, '    Estimate a writing run', '')
  lines.push('Help Topics', '  overview  Commands and common workflows', '  globals   Shared output and diagnostic controls', '', `Run ${root.scriptName} <command> --help for command flags, or add --help-topic <topic> for focused help.`)
  return `${lines.join('\n')}\n`
}

export const renderCommandHelp = (
  root: CliRootDefinition,
  command: CliCommandHelpDefinition,
  options: CliHelpRenderOptions = {}
): string => {
  const width = resolveHelpWidth(options.width)
  const topics = getHelpTopics(root, command)
  const topic = options.topic ? topics[options.topic] : undefined
  if (options.topic && !topic) throw UsageError(`Unknown help topic \"${options.topic}\" for ${command.name}. Available topics: ${Object.keys(topics).join(', ')}.`)
  const parameters = command.parameters ?? []
  const parameterUsage = parameters.map((parameter) => parameter.key).join(' ')
  const subcommandUsage = (command.subcommands ?? []).length > 0 && parameters.length === 0
    ? '<subcommand>'
    : ''
  const usageParts = [root.scriptName, command.name, parameterUsage, subcommandUsage, '[flags]'].filter(Boolean)
  const lines = [
    `${root.scriptName} ${command.name} ${formatVersion(root.version)} - ${command.description}`,
    '',
    'Usage',
    `  $ ${usageParts.join(' ')}`,
    ''
  ]

  if (command.help?.beforeFlags?.length) lines.push('Modes', ...command.help.beforeFlags.map(note => wrapHelpDescription('  ', note, width)), '')
  lines.push(...renderParameters(command))
  lines.push(...renderSubcommands(command))

  const flags = Object.fromEntries(Object.entries(command.flags ?? {}).filter(([name, flag]) => !topic || topic.flags?.includes(name) || topic.groups?.includes(String(flag.help?.['group']))))
  if (Object.keys(flags).length > 0) {
    lines.push('Flags')
    lines.push(...renderGroupedFlags(flags, root.flagGroups, width))
    while (lines.at(-1)?.trim() === '') {
      lines.pop()
    }
    lines.push('')
  }

  const globals = globalFlagsForCommand(root.globalFlags, command.name)
  if (topic && options.topic !== 'globals') {
    for (const name of Object.keys(globals)) if (!['help', 'help-topic'].includes(name)) delete globals[name]
  }
  lines.push('Global Flags', ...renderFlagRows(orderGlobalFlags(globals), '  ', width), '')

  const examples = renderExamples(topic ? { ...command, help: { ...command.help, examples: options.topic === 'overview' ? command.help?.examples?.slice(0, 3) ?? [] : [] } } : command)
  if (examples.length > 0) {
    lines.push(...examples)
  }
  const notes = renderNotes({ ...command, help: { ...command.help, notes: [...(command.help?.notes ?? []), ...(topic?.notes ?? [])] } })
  if (notes.length > 0) {
    lines.push(...notes.map(line => line.startsWith('  ') ? wrapHelpDescription('  ', line.trim(), width) : line))
  }

  if (!topic) lines.push('Help Topics', ...Object.entries(topics).map(([name, item]) => `  ${name}  ${item.description}`), '', `Run ${root.scriptName} ${command.name} --help-topic <topic> for focused help.`, '')
  while (lines.at(-1)?.trim() === '') {
    lines.pop()
  }

  return `${lines.join('\n')}\n`
}
