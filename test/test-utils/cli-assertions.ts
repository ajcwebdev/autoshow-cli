import { expect } from 'bun:test'
import type { CliCommandDefinition, CommandFailureExpectation, CommandResultBase, RunCommandResult } from '~/types'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { NativeNoSuchCommandError, NativeUnknownFlagError } from '~/cli/native/native-errors'
import { parseCommandInvocation, parseNativeCli } from '~/cli/native/native-parser'
import { AppUsageError, extractErrorHints, isAppError, normalizeExitCode } from '~/utils/error-handler'
import { runCommand } from './test-helpers'

export const parseRootCli = (argv: string[]) =>
  parseNativeCli(argv, COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)

export const commandNamed = (name: string): CliCommandDefinition => {
  const command = COMMAND_DEFINITIONS.find((entry) => entry.name === name)
  if (!command) throw new Error(`missing command ${name}`)
  return command
}

const combinedOutput = (result: Pick<CommandResultBase, 'stdout' | 'stderr'>): string =>
  `${result.stdout}\n${result.stderr}`

export const expectUsageMessage = (error: unknown, expected: string): void => {
  const err = error instanceof Error ? error : new Error(String(error))
  expect([err.message, ...extractErrorHints(err)].join('\n')).toContain(expected)
}

export const expectUsageClassification = (error: unknown, expected: string): void => {
  expectUsageMessage(error, expected)
  expect(isAppError(error)).toBe(true)
  expect(error).toBeInstanceOf(AppUsageError)
  expect(normalizeExitCode(error)).toBe(2)
}

export const thrownMessage = (fn: () => unknown): string => {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return expect.unreachable('Expected the call to throw')
}

export const rejectionMessage = async (fn: () => unknown): Promise<string> => {
  try {
    await fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  return expect.unreachable('Expected the call to reject')
}

export const expectUsageThrow = (fn: () => unknown, expected: string): void => {
  try {
    fn()
  } catch (error) {
    expectUsageMessage(error, expected)
    return
  }
  expect.unreachable(`Expected usage error containing ${JSON.stringify(expected)}`)
}

export const expectUnknownCommand = (argv: string[], name: string): void => {
  expect(() => parseRootCli(argv)).toThrow(NativeNoSuchCommandError)
  expect(() => parseRootCli(argv)).toThrow(`Unknown command "${name}"`)
}

export const expectUnknownFlag = (argv: string[], flag: string): void => {
  const command = commandNamed(argv[0] as string)
  expect(() => parseCommandInvocation(argv, command, GLOBAL_FLAG_DEFINITIONS)).toThrow(NativeUnknownFlagError)
  expect(() => parseCommandInvocation(argv, command, GLOBAL_FLAG_DEFINITIONS)).toThrow(`Unexpected flag: ${flag}`)
}

const expectCommandFailure = async (
  args: string[],
  expectation: CommandFailureExpectation = {}
): Promise<RunCommandResult> => {
  const result = await runCommand(['src/cli/create-cli.ts', ...args], {
    env: { NO_COLOR: '1', ...(expectation.env ?? {}) }
  })
  const output = combinedOutput(result)

  expect(result.exitCode).toBe(expectation.exitCode ?? 2)
  for (const fragment of toFragments(expectation.contains)) {
    expect(output).toContain(fragment)
  }
  for (const fragment of toFragments(expectation.notContains)) {
    expect(output).not.toContain(fragment)
  }
  return result
}

export const expectUsageExit = async (args: string[], expectedMessage: string): Promise<void> => {
  await expectCommandFailure(args, { exitCode: 2, contains: expectedMessage })
}

const toFragments = (value: string | readonly string[] | undefined): readonly string[] => {
  if (value === undefined) return []
  return typeof value === 'string' ? [value] : value
}
