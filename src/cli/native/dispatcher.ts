import type { LogFormat, LogLevel } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { LOG_FORMAT_CHOICES, LOG_LEVEL_CHOICES, reconfigureLogger, runWithLogContext } from '~/utils/app-logger/app-logger'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { configurePinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { CLIUsageError } from '~/utils/error-handler'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureYtDlpAuth } from '~/cli/commands/process-steps/shared/shared-yt-dlp-options'
import { configureBinDir } from '~/utils/runtime-paths'
import { configureColor } from '~/utils/terminal-colors'
import { configureModelPath } from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-config'
import { parseNativeCli } from './native-parser'
import { renderCommandHelp, renderRootHelp } from './help-renderer'
import { NativeUnknownFlagError } from './native-errors'
import { getUnknownFlagSpellings } from './unknown-flag-spellings'
import type { CliCommandContext, CliCommandDefinition, CliRootDefinition } from '~/types'

// Commands that only read, resume, or configure existing directories. Accepting --output-dir there
// would silently do nothing, so it is rejected instead.
const COMMANDS_WITHOUT_RUN_DIRECTORIES = new Set(['config', 'setup', 'links', 'resume', 'voice', 'comic reference-voice'])

const formatVersion = (version: string): string =>
  version.startsWith('v') ? version : `v${version}`

export const dispatchNativeCli = async (
  argv: string[],
  root: CliRootDefinition,
  commands: readonly CliCommandDefinition[]
): Promise<void> => {
  const parsed = parseNativeCli(argv, commands, root.globalFlags)

  if (parsed.mode === 'help') {
    if (parsed.argv.length === 0) {
      console.log('No command specified. Showing help:\n')
    }
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
  if (!command.allowUnknownFlags && unknownFlagSpellings.length > 0) {
    throw new NativeUnknownFlagError(unknownFlagSpellings)
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
    if (COMMANDS_WITHOUT_RUN_DIRECTORIES.has(command.name) || COMMANDS_WITHOUT_RUN_DIRECTORIES.has(command.name.split(' ')[0]!)) {
      throw CLIUsageError(
        `--output-dir is not supported by "${command.name}" because it does not create a run directory.`,
        'Use --output-root to change the base output directory.'
      )
    }
    configurePinnedRunDir(outputDir ?? '')
  }

  const charactersRoot = typeof parsed.flags['characters-root'] === 'string' ? parsed.flags['characters-root'] : undefined
  if (charactersRoot) configureCharactersRoot(charactersRoot)

  const binDir = typeof parsed.flags['bin-dir'] === 'string' ? parsed.flags['bin-dir'] : undefined
  if (binDir) configureBinDir(binDir)

  const colorFlag = parsed.flags['color']
  if (colorFlag === true) configureColor('force')
  else if (colorFlag === false) configureColor('disable')

  const cookies = typeof parsed.flags['cookies'] === 'string' ? parsed.flags['cookies'] : undefined
  const cookiesFromBrowser = typeof parsed.flags['cookies-from-browser'] === 'string' ? parsed.flags['cookies-from-browser'] : undefined
  const modelPath = typeof parsed.flags['model-path'] === 'string' ? parsed.flags['model-path'] : undefined

  if (cookies || cookiesFromBrowser) configureYtDlpAuth({ ...(cookies ? { cookies } : {}), ...(cookiesFromBrowser ? { cookiesFromBrowser } : {}) })
  if (modelPath) configureModelPath(modelPath)

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
    l.debug(`Command "${parsed.calledAs ?? command.name}" completed in ${elapsedMs}ms`)
  }
}
