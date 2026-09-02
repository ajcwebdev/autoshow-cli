import { installProcessFailureHandlers } from '~/cli/failure-handlers'
import { extractErrorHints, extractErrorMetadata, formatErrorMessage, isUsageError, normalizeExitCode, usageMessage } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { resetLoggerForInvocation } from '~/utils/app-logger/app-logger'
import { createRunId } from '~/utils/app-logger/core'
import { discardStagedResult, flushStagedResult, runWithResultInvocation, stageFailureResult } from '~/utils/app-logger/result-emitter'
import { configureColor } from '~/utils/terminal-colors'
import type { HelpCommandGroupKey } from '~/types'
import {
  colorizeFlagDescriptions,
  helpColorsEnabled
} from '~/cli/help-colors'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from './command-definitions'

export { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from './command-definitions'

export const SETUP_NO_ORPHANS_MARKER = 'AUTOSHOW_SETUP_NO_ORPHANS_CHILD'

export const shouldRelaunchSetupWithNoOrphans = (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  isStandaloneExecutable = Bun.isStandaloneExecutable
): boolean => !isStandaloneExecutable && argv[0] === 'setup' && env[SETUP_NO_ORPHANS_MARKER] !== '1'

export const buildSetupNoOrphansArgs = (
  entrypoint: string,
  argv: readonly string[]
): string[] => ['--no-env-file', '--no-orphans', entrypoint, ...argv]

const cliErrorHandler = (error: unknown): number => {
  if (isUsageError(error)) {
    l.error(`Usage error: ${usageMessage(error)}`, { category: 'usage', metadata: extractErrorMetadata(error), error })
    for (const hint of extractErrorHints(error)) {
      l.write('info', hint, { category: 'usage' })
    }
    stageFailureResult(error, 2, usageMessage(error), extractErrorHints(error))
    return 2
  }

  const exitCode = normalizeExitCode(error)
  const message = formatErrorMessage(error)
  l.error(`Command failed: ${message}`, { category: 'command', error })

  for (const hint of extractErrorHints(error)) {
    l.write('info', hint, { category: 'command' })
  }
  stageFailureResult(error, exitCode, message, extractErrorHints(error))
  return exitCode
}

export const preScanJsonMode = (argv: readonly string[]): boolean => {
  let enabled = false
  for (const arg of argv) {
    if (arg === '--') break
    if (arg === '--json') enabled = true
    else if (arg === '--no-json') enabled = false
    else if (arg.startsWith('--json=')) {
      const value = arg.slice('--json='.length).trim().toLowerCase()
      enabled = value !== 'false' && value !== '0' && value !== 'no'
    }
  }
  return enabled
}

export const stripJsonProtocolArgs = (argv: readonly string[]): string[] => {
  const out: string[] = []
  let afterTerminator = false
  for (const arg of argv) {
    if (afterTerminator) {
      out.push(arg)
      continue
    }
    if (arg === '--') {
      afterTerminator = true
      out.push(arg)
      continue
    }
    if (arg === '--json' || arg === '--no-json' || arg.startsWith('--json=')) continue
    out.push(arg)
  }
  return out
}

const setCommandHelpGroup = (command: unknown, group: HelpCommandGroupKey): void => {
  if (typeof command !== 'object' || command === null) {
    return
  }

  const commandDefinition = command as { help?: Record<string, unknown> }
  const existingHelp = commandDefinition.help
  commandDefinition.help = {
    ...(typeof existingHelp === 'object' && existingHelp !== null && !Array.isArray(existingHelp) ? existingHelp : {}),
    group
  }
}

const applyCommandHelpGroups = (): void => {
  for (const command of COMMAND_DEFINITIONS) {
    const group = HELP_COMMAND_GROUP_BY_NAME[command.name]
    if (group !== undefined) {
      setCommandHelpGroup(command, group)
    }
  }
}

applyCommandHelpGroups()

let helpDescriptionColorsApplied = false
const applyUniversalHelpDescriptionColors = (): void => {
  if (!helpColorsEnabled || helpDescriptionColorsApplied) {
    return
  }

  colorizeFlagDescriptions(GLOBAL_FLAG_DEFINITIONS as Record<string, unknown> | undefined)
  for (const command of COMMAND_DEFINITIONS) {
    colorizeFlagDescriptions(command.flags as Record<string, unknown> | undefined)
    for (const subcommand of command.subcommands ?? []) {
      colorizeFlagDescriptions(subcommand.flags as Record<string, unknown> | undefined)
    }
  }

  helpDescriptionColorsApplied = true
}

export const runCliInProcess = async (argv: string[]): Promise<number> => {
  applyUniversalHelpDescriptionColors()
  const json = preScanJsonMode(argv)
  const runId = createRunId()
  resetLoggerForInvocation(json, runId)
  configureColor(json ? 'disable' : 'auto')

  return await runWithResultInvocation({ json, runId }, async () => {
    try {
      await dispatchNativeCli(stripJsonProtocolArgs(argv), createNativeRootDefinition(), COMMAND_DEFINITIONS)
      try {
        flushStagedResult()
        return 0
      } catch (error) {
        discardStagedResult()
        const exitCode = cliErrorHandler(error)
        flushStagedResult()
        return exitCode
      }
    } catch (error) {
      discardStagedResult()
      const exitCode = cliErrorHandler(error)
      flushStagedResult()
      return exitCode
    }
  })
}

const main = async (): Promise<void> => {
  const argv = Bun.argv.slice(2)
  if (shouldRelaunchSetupWithNoOrphans(argv)) {
    const proc = Bun.spawn([
      process.execPath,
      ...buildSetupNoOrphansArgs(import.meta.path, argv)
    ], {
      env: {
        ...process.env,
        [SETUP_NO_ORPHANS_MARKER]: '1'
      },
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    })
    process.exitCode = await proc.exited
    return
  }
  process.exitCode = await runCliInProcess(argv)
}

if (import.meta.main) {
  installProcessFailureHandlers()

  await main()
}
