import type { CliCommandContext, CliCommandDefinition, CliRootDefinition, LogFormat, LogLevel } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { clearSuppressedLogCategories, LOG_FORMAT_CHOICES, LOG_LEVEL_CHOICES, reconfigureLogger, runWithLogContext } from '~/utils/app-logger/app-logger'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { configurePinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { applyConfiguredYtDlpAuth } from '~/cli/commands/setup-and-utilities/config-command/config-auth'
import { configureBinDir } from '~/utils/runtime-paths'
import { configureColor } from '~/utils/terminal-colors'
import { parseNativeCli } from './native-parser'
import { renderCommandHelp, renderRootHelp } from './help-renderer'
import { NativeUnknownFlagError } from './native-errors'
import { cookieFlagNameFromSpelling, commandAcceptsGlobalFlag, unsupportedCookieFlagError, unsupportedGlobalFlagError } from './global-flag-support'
import { getUnknownFlagSpellings } from './unknown-flag-spellings'

const formatVersion = (version: string): string =>
  version.startsWith('v') ? version : `v${version}`

export const dispatchNativeCli = async (
  argv: string[],
  root: CliRootDefinition,
  commands: readonly CliCommandDefinition[]
): Promise<void> => {
  const parsed = parseNativeCli(argv, commands, root.globalFlags)

  // Help and --version are sanctioned stdout payloads rather than diagnostics: they
  // are the requested document, and sink decoration (timestamps, level symbols,
  // indentation) would corrupt them. The bare "no command" status line that used to
  // precede the help text was a diagnostic, and the help output below says the same
  // thing, so it is gone rather than relocated.
  if (parsed.mode === 'help') {
    if (parsed.command) {
      console.log(renderCommandHelp(root, parsed.command))
      return
    }
    console.log(renderRootHelp(root, commands))
    return
  }

  if (parsed.mode === 'version') {
    console.log(formatVersion(root.version))
    return
  }

  const command = parsed.command
  if (command === undefined) {
    return
  }

  const unknownFlagSpellings = getUnknownFlagSpellings(parsed.rawParsed)
  const unknownCookieFlag = unknownFlagSpellings
    .map((spelling) => cookieFlagNameFromSpelling(spelling))
    .find((flagName) => flagName !== undefined)
  if (unknownCookieFlag !== undefined) {
    throw unsupportedCookieFlagError(command.name, unknownCookieFlag)
  }
  if (!command.allowUnknownFlags && unknownFlagSpellings.length > 0) {
    throw new NativeUnknownFlagError(unknownFlagSpellings)
  }

  for (const flagName of parsed.rawParsed.explicitFlags) {
    if (!Object.hasOwn(root.globalFlags, flagName)) continue
    if (!commandAcceptsGlobalFlag(command.name, flagName)) {
      throw unsupportedGlobalFlagError(command.name, flagName)
    }
  }

  const logLevelFlag = typeof parsed.flags['log-level'] === 'string'
    ? parsed.flags['log-level'].trim().toLowerCase()
    : undefined
  const logFormatFlag = typeof parsed.flags['log-format'] === 'string'
    ? parsed.flags['log-format'].trim().toLowerCase()
    : undefined
  const logLevel = LOG_LEVEL_CHOICES.includes(logLevelFlag as LogLevel) ? logLevelFlag as LogLevel : undefined
  const logFormat = LOG_FORMAT_CHOICES.includes(logFormatFlag as Exclude<LogFormat, 'auto'>)
    ? logFormatFlag as Exclude<LogFormat, 'auto'>
    : undefined

  // Category suppression is per-command state (comic opts in mid-handler), so it is reset
  // here rather than left to accumulate on the process-wide logger.
  clearSuppressedLogCategories()
  reconfigureLogger({
    verbose: parsed.flags['verbose'] === true,
    quiet: parsed.flags['quiet'] === true,
    json: parsed.flags['json'] === true,
    ...(logLevel ? { logLevel } : {}),
    ...(logFormat ? { logFormat } : {})
  })

  const outputRoot = typeof parsed.flags['output-root'] === 'string' ? parsed.flags['output-root'] : undefined
  if (outputRoot) configureOutputRoot(outputRoot)

  const outputDir = typeof parsed.flags['output-dir'] === 'string' ? parsed.flags['output-dir'] : undefined
  if (parsed.rawParsed.explicitFlags.has('output-dir')) {
    configurePinnedRunDir(outputDir ?? '')
  }

  const charactersRoot = typeof parsed.flags['characters-root'] === 'string' ? parsed.flags['characters-root'] : undefined
  if (charactersRoot) configureCharactersRoot(charactersRoot)

  const binDir = typeof parsed.flags['bin-dir'] === 'string' ? parsed.flags['bin-dir'] : undefined
  if (binDir) configureBinDir(binDir)

  const colorFlag = parsed.flags['color']
  if (colorFlag === true) configureColor('force')
  else if (colorFlag === false) configureColor('disable')

  const configPathOverride = typeof parsed.flags['config-path'] === 'string' ? parsed.flags['config-path'] : undefined

  await applyConfiguredYtDlpAuth(configPathOverride)

  const store: Record<string, unknown> = { startedAtMs: Date.now() }
  const ctx: CliCommandContext = {
    argv: parsed.argv,
    ...(parsed.calledAs ? { calledAs: parsed.calledAs } : {}),
    command,
    flags: parsed.flags,
    parameters: parsed.parameters,
    rawParsed: parsed.rawParsed,
    store
  }

  await runWithLogContext({ command: parsed.calledAs ?? command.name }, async () => {
    await command.handler(ctx)
  })

  const startedAtMs = store['startedAtMs']
  if (typeof startedAtMs === 'number') {
    const elapsedMs = Date.now() - startedAtMs
    l.debug(`Command "${parsed.calledAs ?? command.name}" completed in ${elapsedMs}ms`, {
      category: 'command',
      metadata: { command: parsed.calledAs ?? command.name, elapsedMs }
    })
  }
}
