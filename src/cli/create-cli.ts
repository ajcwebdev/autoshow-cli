import { configCommand } from './commands/setup-and-utilities/config/define-config-command'
import { metadataCommand } from '~/cli/commands/process-steps/step-0-metadata/define-metadata-command'
import { downloadCommand } from '~/cli/commands/process-steps/step-1-download/define-download-command'
import { extractCommand } from '~/cli/commands/process-steps/step-2-extract/define-extract-command'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { resumeCommand } from '~/cli/commands/setup-and-utilities/resume/define-resume-command'
import { ttsCommand } from '~/cli/commands/process-steps/step-4-tts/define-tts-command'
import { imageCommand } from '~/cli/commands/process-steps/step-5-image/define-image-command'
import { videoCommand } from '~/cli/commands/process-steps/step-6-video/define-video-command'
import { musicCommand } from '~/cli/commands/process-steps/step-7-music/define-music-command'
import { comicCommand } from '~/cli/commands/process-steps/step-8-comic/define-comic-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { installProcessFailureHandlers } from '~/cli/failure-handlers'
import { extractErrorHints, isUsageError, normalizeExitCode, usageMessage } from '~/utils/error-handler'
import { linksCommand } from '~/cli/commands/setup-and-utilities/links/define-links-command'
import { benchmarkCommand } from '~/cli/commands/setup-and-utilities/benchmark/define-benchmark-command'
import * as l from '~/utils/app-logger/app-logger'
import type { HelpCommandGroupKey } from '~/types'
import {
  colorizeFlagDescriptions,
  helpColorsEnabled
} from '~/cli/help-colors'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
const cliErrorHandler = (error: unknown): void => {
  if (isUsageError(error)) {
    l.error(`Usage error: ${usageMessage(error)}`)
    for (const hint of extractErrorHints(error)) {
      l.write('info', hint)
    }
    process.exit(2)
  }

  const exitCode = normalizeExitCode(error)
  l.error('Command failed', error)

  for (const hint of extractErrorHints(error)) {
    l.write('info', hint)
  }

  process.exit(exitCode)
}

const HELP_COMMAND_GROUP_BY_NAME: Readonly<Record<string, HelpCommandGroupKey>> = {
  version: 'core',
  help: 'core',
  config: 'setup',
  setup: 'setup',
  links: 'setup',
  resume: 'setup',
  metadata: 'processing',
  download: 'processing',
  extract: 'processing',
  write: 'processing',
  tts: 'processing',
  image: 'processing',
  video: 'processing',
  music: 'processing',
  comic: 'processing',
  benchmark: 'setup'
}

const COMMAND_DEFINITIONS = [
  configCommand,
  setupCommand,
  linksCommand,
  metadataCommand,
  downloadCommand,
  extractCommand,
  resumeCommand,
  writeCommand,
  ttsCommand,
  imageCommand,
  videoCommand,
  musicCommand,
  comicCommand,
  benchmarkCommand
] as const

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

  for (const command of COMMAND_DEFINITIONS) {
    colorizeFlagDescriptions(command.flags as Record<string, unknown> | undefined)
    for (const subcommand of command.subcommands ?? []) {
      colorizeFlagDescriptions(subcommand.flags as Record<string, unknown> | undefined)
    }
  }

  helpDescriptionColorsApplied = true
}

const main = async (): Promise<void> => {
  applyUniversalHelpDescriptionColors()
  const argv = Bun.argv.slice(2)
  await dispatchNativeCli(argv, createNativeRootDefinition(), COMMAND_DEFINITIONS)
}

installProcessFailureHandlers()

try {
  await main()
} catch (error) {
  cliErrorHandler(error)
}
