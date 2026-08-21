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

/**
 * The CLI writes usage failures across both channels (hints to stderr, partial help to
 * stdout), so assertions read the pair as one string. Kept here rather than hand-written
 * per site so the joining rule has exactly one definition.
 */
const combinedOutput = (result: Pick<CommandResultBase, 'stdout' | 'stderr'>): string =>
  `${result.stdout}\n${result.stderr}`

/**
 * Asserts the message a user would actually see for a usage error: the message plus the
 * structured hints the top-level handler prints. Built on `extractErrorHints` rather than
 * duck-typing `err.hints`, so a hint source the handler honors is honored here too.
 */
export const expectUsageMessage = (error: unknown, expected: string): void => {
  const err = error instanceof Error ? error : new Error(String(error))
  expect([err.message, ...extractErrorHints(err)].join('\n')).toContain(expected)
}

/** As `expectUsageMessage`, and additionally pins the AppError classification. */
export const expectUsageClassification = (error: unknown, expected: string): void => {
  expectUsageMessage(error, expected)
  expect(isAppError(error)).toBe(true)
  expect(error).toBeInstanceOf(AppUsageError)
  expect(normalizeExitCode(error)).toBe(2)
}

/**
 * The message a throwing call produced, for the assertions `expectUsageThrow` cannot make:
 * an exact `toBe` comparison, or a transformation of the message (the standalone image
 * command retargets flag spellings before asserting). Two suites had their own copy of
 * this and of the async variant below.
 */
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

/**
 * Runs the CLI and pins the failure contract: exact exit code plus combined-output
 * content. `not.toBe(0)` is deliberately not offered — an exact code is what distinguishes
 * a usage rejection (2) from an execution failure (1).
 */
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

/** Spawned-CLI counterpart to `expectUsageThrow`: exit 2 plus the message. */
export const expectUsageExit = async (args: string[], expectedMessage: string): Promise<void> => {
  await expectCommandFailure(args, { exitCode: 2, contains: expectedMessage })
}

const toFragments = (value: string | readonly string[] | undefined): readonly string[] => {
  if (value === undefined) return []
  return typeof value === 'string' ? [value] : value
}
