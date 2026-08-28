import { describe, expect, test } from 'bun:test'
import { NativeMissingFlagValueError, NativeNoSuchCommandError, NativeUnknownFlagError } from '~/cli/native/native-errors'
import { defineCliCommand } from '~/cli/native/native-types'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { parseCommandArgv, parseCommandInvocation, parseNativeCli } from '~/cli/native/native-parser'
import { getUnknownFlagSpellings } from '~/cli/native/unknown-flag-spellings'
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
  },
  tag: {
    description: 'Repeatable global tag',
    type: [String] as [StringConstructor],
    default: [] as string[]
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
    prompt: {
      description: 'Adjacent prompt names',
      type: [String] as [StringConstructor],
      default: [] as string[],
      consumeAdjacentValues: true
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

const nestedRunCommand = defineCliCommand({
  name: 'nested run',
  description: 'Nested command parser fixture',
  parameters: [{ key: '<input>', description: 'Input value' }],
  flags: {
    name: {
      description: 'Name',
      type: String
    }
  }
}, () => {})

const nestedCommand = defineCliCommand({
  name: 'nested',
  description: 'Nested command parent fixture',
  subcommands: [nestedRunCommand]
}, () => {})

const defaultedStatusCommand = defineCliCommand({
  name: 'defaulted status',
  description: 'Default child fixture',
  flags: {
    name: {
      description: 'Name',
      type: String
    }
  }
}, () => {})

const defaultedCommand = defineCliCommand({
  name: 'defaulted',
  description: 'Parent with a default subcommand',
  defaultSubcommand: 'status',
  subcommands: [defaultedStatusCommand]
}, () => {})

const commands = [runCommand, linksCommand, subcommandsCommand, variadicCommand, nestedCommand, defaultedCommand] as const satisfies readonly CliCommandDefinition[]

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
    expect(parsed.rawParsed.flagOccurrences).toEqual([
      { name: 'dry', raw: '--dry=false', value: false, known: true },
      { name: 'feature', raw: '--no-feature', value: false, known: true },
      { name: 'quiet', raw: '-q', value: true, known: true },
      { name: 'dry', raw: '-d', value: true, known: true },
      { name: 'name', raw: '--name=fixture', value: 'fixture', known: true },
      { name: 'model', raw: '--model', value: true, known: true },
      { name: 'model', raw: '--model', value: 'gpt-test', known: true },
      { name: 'model', raw: '--model=glm-test', value: 'glm-test', known: true },
      { name: 'long-name', raw: '--long-name', value: 'dashed', known: true }
    ])
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

  test('consumes adjacent values only for opted-in repeatable flags', () => {
    const parsed = parseNativeCli([
      'run',
      'input.txt',
      '--prompt',
      'shortSummary',
      'longSummary',
      '--prompt=chapterTitles',
      '--prompt',
      'keyPoints'
    ], commands, globalFlags)

    expect(parsed.parameters.input).toBe('input.txt')
    expect(parsed.flags['prompt']).toEqual(['shortSummary', 'longSummary', 'chapterTitles', 'keyPoints'])
    expect(parsed.rawParsed.flagOccurrences.filter((occurrence) => occurrence.name === 'prompt')).toEqual([
      { name: 'prompt', raw: '--prompt', value: 'shortSummary', known: true },
      { name: 'prompt', raw: '--prompt=chapterTitles', value: 'chapterTitles', known: true },
      { name: 'prompt', raw: '--prompt', value: 'keyPoints', known: true }
    ])
  })

  test('requires the positional input before a whitespace-form multi-value flag', () => {
    expect(() => parseNativeCli([
      'run',
      '--prompt',
      'shortSummary',
      'longSummary',
      'input.txt'
    ], commands, globalFlags)).toThrow('Missing required parameter: input')

    const equalsForm = parseNativeCli(['run', '--prompt=shortSummary', 'input.txt'], commands, globalFlags)
    expect(equalsForm.parameters.input).toBe('input.txt')
    expect(equalsForm.flags['prompt']).toEqual(['shortSummary'])
  })

  test('tracks unknown flags and missing string values', () => {
    const parsed = parseNativeCli(['run', 'input.txt', '--unknown-flag'], commands, globalFlags)
    expect(parsed.rawParsed.unknown).toEqual({ unknownFlag: true })
    expect(parsed.rawParsed.flagOccurrences).toEqual([
      { name: 'unknownFlag', raw: '--unknown-flag', value: true, known: false }
    ])

    expect(() => parseNativeCli(['run', 'input.txt', '--name'], commands, globalFlags))
      .toThrow(NativeMissingFlagValueError)
  })

  test('formats unknown flags from raw occurrences without exposing inline values or duplicates', async () => {
    const argv = [
      'run',
      'input.txt',
      '--misspelled-long=secret',
      '-x',
      '--misspelled-long=other-secret',
      '--Mixed--spelling'
    ]
    const expectedMessage = 'Unexpected flags: --misspelled-long, -x, --Mixed--spelling'

    expect(() => parseCommandInvocation(argv, runCommand, globalFlags)).toThrow(expectedMessage)
    await expect(dispatchNativeCli(argv, root, commands)).rejects.toThrow(expectedMessage)

    let unknownFlagError: NativeUnknownFlagError | undefined
    try {
      parseCommandInvocation(argv, runCommand, globalFlags)
    } catch (error) {
      expect(error).toBeInstanceOf(NativeUnknownFlagError)
      unknownFlagError = error as NativeUnknownFlagError
    }
    if (!unknownFlagError) expect.unreachable('Expected parseCommandInvocation to reject unknown flags')
    expect(unknownFlagError.flagSpellings).toEqual(['--misspelled-long', '-x', '--Mixed--spelling'])
    expect(unknownFlagError.flagNames).toBe(unknownFlagError.flagSpellings)
    expect(unknownFlagError.message).not.toContain('secret')
  })

  test('falls back to normalized unknown keys for synthetic parse results without unknown occurrences', () => {
    const parsed = parseCommandArgv(['run', 'input.txt', '--misspelled-long'], runCommand, globalFlags)
    parsed.rawParsed.flagOccurrences = []

    expect(getUnknownFlagSpellings(parsed.rawParsed)).toEqual(['--misspelledLong'])
  })

  test('parses a resolved command argv through the reusable command boundary', () => {
    const argv = ['run', 'input.txt', '--name', 'fixture']
    expect(parseCommandArgv(argv, runCommand, globalFlags))
      .toEqual(parseNativeCli(argv, commands, globalFlags))
  })

  test('routes root help/version and command help/version', () => {
    expect(parseNativeCli(['--help'], commands, globalFlags).mode).toBe('help')
    expect(parseNativeCli(['-h'], commands, globalFlags).mode).toBe('help')
    expect(parseNativeCli(['--version'], commands, globalFlags).mode).toBe('version')
    expect(parseNativeCli(['-v'], commands, globalFlags).mode).toBe('version')
    expect(() => parseNativeCli(['-V'], commands, globalFlags)).toThrow(NativeNoSuchCommandError)
    expect(() => parseCommandInvocation(['run', 'input.txt', '-V'], runCommand, globalFlags)).toThrow(NativeUnknownFlagError)

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

  test('routes one subcommand level and parses global flags exactly once', () => {
    const parsed = parseNativeCli([
      'nested',
      '--tag',
      'before',
      'run',
      'input.txt',
      '--tag=after',
      '--name=fixture'
    ], commands, globalFlags)

    expect(parsed.mode).toBe('command')
    expect(parsed.command).toBe(nestedRunCommand)
    expect(parsed.calledAs).toBe('nested run')
    expect(parsed.parameters.input).toBe('input.txt')
    expect(parsed.flags['tag']).toEqual(['before', 'after'])
    expect(parsed.rawParsed.flagOccurrences.filter((occurrence) => occurrence.name === 'tag')).toHaveLength(2)
    expect(parseNativeCli(['nested'], commands, globalFlags).mode).toBe('help')
    expect(parseNativeCli(['defaulted'], commands, globalFlags)).toEqual(expect.objectContaining({
      mode: 'command',
      command: defaultedStatusCommand
    }))
    expect(parseNativeCli(['defaulted', '--name=fixture'], commands, globalFlags).flags['name']).toBe('fixture')
    expect(parseNativeCli(['defaulted', '--help'], commands, globalFlags)).toEqual(expect.objectContaining({
      mode: 'help',
      command: defaultedCommand
    }))
    expect(parseNativeCli(['defaulted', 'help'], commands, globalFlags).mode).toBe('help')
    expect(parseNativeCli(['nested', 'run', '--help'], commands, globalFlags).command).toBe(nestedRunCommand)
    expect(parseNativeCli(['help', 'nested', 'run'], commands, globalFlags).command).toBe(nestedRunCommand)
    expect(parseNativeCli(['nested', '--unknown'], commands, globalFlags).rawParsed.unknown).toEqual({ unknown: true })
    expect(() => parseNativeCli(['nested', 'run', 'input.txt', 'extra.txt'], commands, globalFlags))
      .toThrow('Unexpected parameter "extra.txt"')
  })

  test('native dispatcher rejects unknown flags unless a command explicitly permits them', async () => {
    await expect(dispatchNativeCli(['run', 'input.txt', '--unknown'], root, commands))
      .rejects.toThrow(NativeUnknownFlagError)

    await expect(dispatchNativeCli(['links', '--openai', 'stt'], root, commands))
      .resolves.toBeUndefined()

    const allowed = parseCommandInvocation(['links', '--openai', 'stt'], linksCommand, globalFlags)
    expect(allowed.rawParsed.unknown).toEqual({ openai: true })
    expect(allowed.rawParsed.flagOccurrences).toEqual([
      { name: 'openai', raw: '--openai', value: true, known: false }
    ])
  })
})
