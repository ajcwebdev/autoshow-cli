import { defineCliCommand } from '~/cli/native/native-types'
import { CLIUsageError, rethrowAsUsage } from '~/utils/error-handler'
import { parseComicSubcommandArgv } from './comic-utils/cli-args'
import {
  COMIC_SUBCOMMAND_SUMMARIES,
  getComicSubcommand,
  printComicSubcommandHelp,
} from './comic-utils/subcommand-help'
import { renderCommandHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { stripDefinedGlobalArgs } from '~/cli/native/global-arg-stripper'

const printComicHelp = (): void => {
  console.log(renderCommandHelp(createNativeRootDefinition(), comicCommand))
}

const formatPublicSubcommands = (): string =>
  COMIC_SUBCOMMAND_SUMMARIES.map(([name]) => name).join(', ')

const dispatchComicSubcommand = async (
  rawArgs: string[],
  store: Record<string, unknown>
): Promise<void> => {
  const subcommand = rawArgs[0]
  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    printComicHelp()
    return
  }

  if (subcommand === 'help') {
    const helpTarget = rawArgs[1]
    const helpCommand = helpTarget === undefined ? undefined : getComicSubcommand(helpTarget)
    if (helpCommand) {
      printComicSubcommandHelp(helpCommand)
      return
    }
    if (helpTarget !== undefined && !helpTarget.startsWith('-')) {
      throw CLIUsageError(`Unknown comic subcommand "${helpTarget}". Use one of: ${formatPublicSubcommands()}`)
    }
    printComicHelp()
    return
  }

  if (subcommand.startsWith('-')) {
    throw CLIUsageError(
      `Missing comic subcommand before "${subcommand}". Use one of: ${formatPublicSubcommands()}`
    )
  }

  const command = getComicSubcommand(subcommand)
  if (!command) {
    throw CLIUsageError(`Unknown comic subcommand "${subcommand}". Use one of: ${formatPublicSubcommands()}`)
  }

  const parsed = rethrowAsUsage(() => parseComicSubcommandArgv(rawArgs.slice(1), command))
  if (parsed.mode === 'help') {
    printComicSubcommandHelp(command)
    return
  }
  if (parsed.mode !== 'command') return

  await command.handler({
    argv: parsed.argv,
    ...(parsed.calledAs ? { calledAs: parsed.calledAs } : {}),
    command,
    flags: parsed.flags,
    parameters: parsed.parameters,
    rawParsed: parsed.rawParsed,
    store,
  })
}

export const comicCommand = defineCliCommand({
  name: 'comic',
  description: 'Generate comic scenes, sketches, and panel images from project-defined characters and locations',
  parameters: [{ key: '[subcommand...]', description: 'Comic subcommand and its flags' }],
  allowUnknownFlags: true,
  allowExcessParameters: true,
  passThroughHelpAfterFirstPositional: true,
  help: {
    subcommands: COMIC_SUBCOMMAND_SUMMARIES,
    examples: [
      ['bun autoshow comic draft-scenes 05-01', 'Draft structured scene JSON'],
      ['bun autoshow comic draft-scenes input/scripts/01-script/01-opening.md --only panel-prompts', 'Build panel prompt bundles'],
      ['bun autoshow comic generate-images 05-01 --panels-per-image 6', 'Generate page images'],
      ['bun autoshow comic reference-sketch --character hero', 'Generate a character reference sheet'],
      ['bun autoshow comic reference-sketch --location cargo-bay', 'Generate a canonical location reference'],
      ['bun autoshow comic generate-images --help', 'Show the flags for one subcommand']
    ],
    notes: [
      'Each subcommand has its own flags: bun autoshow comic <subcommand> --help',
      'Comic artifacts are read from input and written under output.'
    ]
  }
}, async (ctx) => {
  await dispatchComicSubcommand(stripDefinedGlobalArgs(ctx.argv.slice(1), GLOBAL_FLAG_DEFINITIONS, {
    preserve: ['help', 'version']
  }), ctx.store)
})
