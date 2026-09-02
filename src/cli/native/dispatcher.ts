import type { CliCommandContext, CliCommandDefinition, CliRootDefinition, LogLevel } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { isJsonResultActive, LOG_LEVEL_CHOICES, reconfigureLogger, runWithLogContext } from '~/utils/app-logger/app-logger'
import { setResultCommand, stageResult } from '~/utils/app-logger/result-emitter'
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
import { UsageError } from '~/utils/error-handler'

const formatVersion = (version: string): string =>
  version.startsWith('v') ? version : `v${version}`

const PIPELINE_STEP_BY_COMMAND: Readonly<Record<string, string>> = {
  metadata: 'step-0-metadata',
  download: 'step-1-download',
  extract: 'step-2-extract',
  write: 'step-3-write',
  tts: 'step-4-tts',
  image: 'step-5-image',
  video: 'step-6-video',
  music: 'step-7-music',
  comic: 'step-8-comic'
}

export const dispatchNativeCli = async (
  argv: string[],
  root: CliRootDefinition,
  commands: readonly CliCommandDefinition[]
): Promise<void> => {
  const parsed = parseNativeCli(argv, commands, root.globalFlags)

  if (parsed.mode === 'help') {
    const document = parsed.command
      ? renderCommandHelp(root, parsed.command)
      : renderRootHelp(root, commands)
    const commandName = parsed.calledAs ?? parsed.command?.name ?? 'help'
    setResultCommand(commandName)
    stageResult({ document }, 'Help')
    if (isJsonResultActive()) return
    if (parsed.command) {
      console.log(document)
      return
    }
    console.log(document)
    return
  }

  if (parsed.mode === 'version') {
    const version = formatVersion(root.version)
    setResultCommand(parsed.calledAs ?? 'version')
    stageResult({ version }, 'Version')
    if (!isJsonResultActive()) console.log(version)
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
  const logLevel = LOG_LEVEL_CHOICES.includes(logLevelFlag as LogLevel) ? logLevelFlag as LogLevel : undefined

  reconfigureLogger({
    verbose: parsed.flags['verbose'] === true,
    quiet: parsed.flags['quiet'] === true,
    json: isJsonResultActive(),
    ...(logLevel ? { logLevel } : {})
  })

  if (isJsonResultActive() && command.name === 'metadata' && parsed.flags['markdown'] === true) {
    throw UsageError('--json cannot be combined with metadata --markdown because both own stdout', {
      hints: ['Remove --markdown for the JSON result protocol, or remove --json for raw Markdown output.']
    })
  }

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
  const commandName = (parsed.calledAs ?? command.name).trim().replace(/\s+/g, ' ')
  setResultCommand(commandName)
  const ctx: CliCommandContext = {
    argv: parsed.argv,
    ...(parsed.calledAs ? { calledAs: parsed.calledAs } : {}),
    command,
    flags: parsed.flags,
    parameters: parsed.parameters,
    rawParsed: parsed.rawParsed,
    store
  }

  const commandRoot = commandName.split(' ', 1)[0] as string
  const pipelineStep = PIPELINE_STEP_BY_COMMAND[commandRoot]
  await runWithLogContext({ command: commandName, ...(pipelineStep ? { step: pipelineStep } : {}) }, async () => {
    await command.handler(ctx)
  })

  const startedAtMs = store['startedAtMs']
  if (typeof startedAtMs === 'number') {
    const elapsedMs = Date.now() - startedAtMs
    l.debug(`Command "${commandName}" completed in ${elapsedMs}ms`, {
      category: 'command',
      metadata: { command: commandName, elapsedMs }
    })
  }
}
