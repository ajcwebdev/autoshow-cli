import { describe, expect, test } from 'bun:test'
import { NativeMissingFlagValueError, NativeUnknownFlagError } from '~/cli/native/native-errors'
import { defineCliCommand } from '~/cli/native/native-types'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { parseNativeCli } from '~/cli/native/native-parser'
import type {
  CliCommandDefinition,
  CliFlagsDefinition,
  CliRootDefinition
} from '~/types'

const globalFlags = {
  help: {
    description: 'Show help',
    short: 'h',
    type: Boolean,
    default: false,
    negatable: false
  },
  version: {
    description: 'Print version',
    short: 'v',
    type: Boolean,
    default: false,
    negatable: false
  },
  quiet: {
    description: 'Quiet output',
    short: 'q',
    type: Boolean,
    default: false,
    negatable: false
  },
  'config-path': {
    description: 'Config path',
    type: String
  }
} as const satisfies CliFlagsDefinition

const runCommand = defineCliCommand({
  name: 'run',
  description: 'Run a parser fixture',
  parameters: [{ key: '<input>', description: 'Input value' }],
  flags: {
    dry: {
      description: 'Dry run',
      short: 'd',
      type: Boolean,
      default: false,
      negatable: false
    },
    feature: {
      description: 'Negatable feature',
      type: Boolean,
      default: true,
      negatable: true
    },
    name: {
      description: 'Name',
      type: String
    },
    model: {
      description: 'Repeatable model',
      type: [String] as [StringConstructor],
      default: [] as string[]
    },
    'long-name': {
      description: 'Dashed flag',
      type: String
    }
  }
}, () => {})

const linksCommand = defineCliCommand({
  name: 'links',
  description: 'Links parser fixture',
  allowUnknownFlags: true,
  allowExcessParameters: true
}, () => {})

const subcommandsCommand = defineCliCommand({
  name: 'subcommands',
  description: 'Subcommand parser fixture',
  parameters: [{ key: '[args...]', description: 'Subcommand args' }],
  allowUnknownFlags: true,
  allowExcessParameters: true,
  passThroughHelpAfterFirstPositional: true
}, () => {})

const variadicCommand = defineCliCommand({
  name: 'variadic',
  description: 'Variadic parser fixture',
  parameters: [{ key: '<items...>', description: 'Required items' }],
  flags: {
    name: {
      description: 'Name',
      type: String
    },
    model: {
      description: 'Repeatable model',
      type: [String] as [StringConstructor],
      default: [] as string[]
    }
  }
}, () => {})

const commands = [runCommand, linksCommand, subcommandsCommand, variadicCommand] as const satisfies readonly CliCommandDefinition[]

const root: CliRootDefinition = {
  scriptName: 'bun test-cli',
  description: 'Parser fixture',
  version: '0.0.0-test',
  globalFlags,
  commandGroups: [],
  flagGroups: []
}

describe('native CLI parser contracts', () => {
  test('parses booleans, strings, repeatable strings, equals values, shorts, defaults, and explicit flags', () => {
    const parsed = parseNativeCli([
      'run',
      'input.txt',
      '--dry=false',
      '--no-feature',
      '-q',
      '-d',
      '--name=fixture',
      '--model',
      '--model',
      'gpt-test',
      '--model=glm-test',
      '--long-name',
      'dashed'
    ], commands, globalFlags)

    expect(parsed.mode).toBe('command')
    expect(parsed.command?.name).toBe('run')
    expect(parsed.parameters.input).toBe('input.txt')
    expect(parsed.flags['quiet']).toBe(true)
    expect(parsed.flags['dry']).toBe(true)
    expect(parsed.flags['feature']).toBe(false)
    expect(parsed.flags['name']).toBe('fixture')
    expect(parsed.flags['model']).toEqual([true, 'gpt-test', 'glm-test'])
    expect(parsed.flags['long-name']).toBe('dashed')
    expect(parsed.flags['longName']).toBeUndefined()
    expect(parsed.rawParsed.explicitFlags.has('dry')).toBe(true)
    expect(parsed.rawParsed.explicitFlags.has('feature')).toBe(true)
    expect(parsed.rawParsed.explicitFlags.has('quiet')).toBe(true)
    expect(parsed.rawParsed.explicitFlags.has('model')).toBe(true)
    expect(parsed.rawParsed.explicitFlags.has('long-name')).toBe(true)
  })

  test('collects double-dash passthrough without parsing provider-looking args after the separator', () => {
    const parsed = parseNativeCli([
      'run',
      'input.txt',
      '--name',
      'before',
      '--',
      '--name',
      'after',
      '--unknown-after-separator'
    ], commands, globalFlags)

    expect(parsed.flags['name']).toBe('before')
    expect(parsed.rawParsed.doubleDash).toEqual(['--name', 'after', '--unknown-after-separator'])
    expect(parsed.rawParsed.unknown).toEqual({})
  })

  test('tracks unknown flags and missing string values', () => {
    const parsed = parseNativeCli(['run', 'input.txt', '--unknown-flag'], commands, globalFlags)
    expect(parsed.rawParsed.unknown).toEqual({ unknownFlag: true })

    expect(() => parseNativeCli(['run', 'input.txt', '--name'], commands, globalFlags))
      .toThrow(NativeMissingFlagValueError)
  })

  test('routes root help/version and command help/version', () => {
    expect(parseNativeCli(['--help'], commands, globalFlags).mode).toBe('help')
    expect(parseNativeCli(['-h'], commands, globalFlags).mode).toBe('help')
    expect(parseNativeCli(['--version'], commands, globalFlags).mode).toBe('version')
    expect(parseNativeCli(['-v'], commands, globalFlags).mode).toBe('version')
    expect(parseNativeCli(['-V'], commands, globalFlags).mode).toBe('version')

    const commandHelp = parseNativeCli(['run', '--help'], commands, globalFlags)
    expect(commandHelp.mode).toBe('help')
    expect(commandHelp.command?.name).toBe('run')

    const helpCommand = parseNativeCli(['help', 'run'], commands, globalFlags)
    expect(helpCommand.mode).toBe('help')
    expect(helpCommand.command?.name).toBe('run')

    const commandVersion = parseNativeCli(['run', '--version'], commands, globalFlags)
    expect(commandVersion.mode).toBe('version')
    expect(commandVersion.command?.name).toBe('run')
  })

  test('passes help through only after the first positional when enabled', () => {
    const parentHelp = parseNativeCli(['subcommands', '--help'], commands, globalFlags)
    expect(parentHelp.mode).toBe('help')
    expect(parentHelp.command?.name).toBe('subcommands')

    const parentShortHelp = parseNativeCli(['subcommands', '-h'], commands, globalFlags)
    expect(parentShortHelp.mode).toBe('help')
    expect(parentShortHelp.command?.name).toBe('subcommands')

    const childHelp = parseNativeCli(['subcommands', 'child', '--help'], commands, globalFlags)
    expect(childHelp.mode).toBe('command')
    expect(childHelp.command?.name).toBe('subcommands')
    expect(childHelp.flags['help']).toBe(true)

    const childShortHelp = parseNativeCli(['subcommands', 'child', '-h'], commands, globalFlags)
    expect(childShortHelp.mode).toBe('command')
    expect(childShortHelp.command?.name).toBe('subcommands')
    expect(childShortHelp.flags['help']).toBe(true)

    const unchangedCommandHelp = parseNativeCli(['run', 'input.txt', '--help'], commands, globalFlags)
    expect(unchangedCommandHelp.mode).toBe('help')
    expect(unchangedCommandHelp.command?.name).toBe('run')
  })

  test('parses variadic positional parameters as arrays and tracks raw positional indexes', () => {
    const parsed = parseNativeCli([
      'variadic',
      'one',
      '--name',
      'flag-value',
      'two',
      '--model',
      'model-value',
      'three'
    ], commands, globalFlags)

    expect(parsed.parameters['items']).toEqual(['one', 'two', 'three'])
    expect(parsed.rawParsed.positionals).toEqual([
      { value: 'one', index: 1 },
      { value: 'two', index: 4 },
      { value: 'three', index: 7 }
    ])

    expect(() => parseNativeCli(['variadic'], commands, globalFlags))
      .toThrow('Missing required parameter: items')
  })

  test('keeps optional variadic passthrough parameters optional', () => {
    const parsed = parseNativeCli(['subcommands', 'child', '--help', 'topic'], commands, globalFlags)

    expect(parsed.mode).toBe('command')
    expect(parsed.parameters['args']).toEqual(['child', 'topic'])
    expect(parsed.flags['help']).toBe(true)
  })

  test('native dispatcher rejects unknown flags except for links selectors', async () => {
    await expect(dispatchNativeCli(['run', 'input.txt', '--unknown'], root, commands))
      .rejects.toThrow(NativeUnknownFlagError)

    await expect(dispatchNativeCli(['links', '--openai', 'stt'], root, commands))
      .resolves.toBeUndefined()
  })
})
