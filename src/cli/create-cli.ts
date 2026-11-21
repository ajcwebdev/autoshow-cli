import { childEnv } from '~/utils/child-env'
import { installProcessFailureHandlers } from '~/cli/failure-handlers'
import { extractErrorHints, extractErrorMetadata, formatErrorMessage, isUsageError, normalizeExitCode, UsageError, usageMessage } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
import { resetLoggerForInvocation } from '~/utils/app-logger/app-logger'
import { createRunId } from '~/utils/app-logger/core'
import { discardStagedResult, flushStagedResult, runWithResultInvocation, setResultFile, stageFailureResult } from '~/utils/app-logger/result-emitter'
import { configureColor } from '~/utils/terminal-colors'
import type { HelpCommandGroupKey } from '~/types'
import {
  colorizeFlagDescriptions,
  helpColorsEnabled
} from '~/cli/help-colors'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { parseNativeCli } from '~/cli/native/native-parser'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { HTTP_PAYLOAD_MAX_BYTES_ENV, validateHttpPayloadEnvironment } from '~/utils/http-payload'
import { buildSetupProviderPresence, SETUP_PROVIDER_PRESENCE_ENV } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from './command-definitions'

export { COMMAND_DEFINITIONS, HELP_COMMAND_GROUP_BY_NAME } from './command-definitions'

export const SETUP_NO_ORPHANS_MARKER = 'AUTOSHOW_SETUP_NO_ORPHANS_CHILD'

export const shouldRelaunchSetupWithNoOrphans = (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
  isStandaloneExecutable = Bun.isStandaloneExecutable
): boolean => {
  if (isStandaloneExecutable || argv[0] !== 'setup' || env[SETUP_NO_ORPHANS_MARKER] === '1') return false
  try {
    const parsed = parseNativeCli([...argv], COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)
    if (parsed.mode === 'help' || parsed.mode === 'version') return false
    return !['doctor', 'show', 'reset', 'dry-run'].some(flag => parsed.flags[flag] === true)
  } catch {
    // The regular dispatcher owns invalid-argument diagnostics.
    return true
  }
}


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

export const preScanResultFile = (argv: readonly string[]): string | undefined => {
  let path: string | undefined
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    if (arg === '--') break
    if (arg.startsWith('--result-file=')) path = arg.slice('--result-file='.length)
    else if (arg === '--result-file') {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw UsageError('--result-file requires a path.')
      path = value
    }
  }
  return path
}

const stripResultFileArgs = (argv: readonly string[]): string[] => {
  const out: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    if (arg === '--') { out.push(...argv.slice(index)); break }
    if (arg === '--result-file') { index += 1; continue }
    if (!arg.startsWith('--result-file=')) out.push(arg)
  }
  return out
}

export const normalizeCliDispatchArgs = (argv: readonly string[]): string[] =>
  stripResultFileArgs(stripJsonProtocolArgs(argv))

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

  return await runWithResultInvocation({ json, runId, processFatal: true }, async () => {
    try {
      const resultFile = preScanResultFile(argv)
      if (resultFile !== undefined) setResultFile(resultFile)
      validateHttpPayloadEnvironment()
      await dispatchNativeCli(normalizeCliDispatchArgs(argv), createNativeRootDefinition(), COMMAND_DEFINITIONS)
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

export const buildSetupChildEnv = (): Record<string, string> => childEnv({
  allow: ['TMPDIR', 'AUTOSHOW_PROJECT_ROOT', 'AUTOSHOW_DISABLE_HTTP_KEEPALIVE', HTTP_PAYLOAD_MAX_BYTES_ENV, 'AUTOSHOW_BUDGET_LEDGER', 'AUTOSHOW_BUDGET_CENTS', 'AUTOSHOW_BUDGET_RESERVE_CENTS'],
  set: {
    [SETUP_NO_ORPHANS_MARKER]: '1',
    [SETUP_PROVIDER_PRESENCE_ENV]: buildSetupProviderPresence(process.env)
  }
})

const main = async (): Promise<void> => {
  const argv = Bun.argv.slice(2)
  if (shouldRelaunchSetupWithNoOrphans(argv)) {
    const proc = Bun.spawn([
      process.execPath,
      ...buildSetupNoOrphansArgs(import.meta.path, argv)
    ], {
      env: buildSetupChildEnv(),
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
