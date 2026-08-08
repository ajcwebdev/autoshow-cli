import { defineCliCommand } from '~/cli/native/native-types'
import { CLIUsageError, rethrowAsUsage } from '~/utils/error-handler'
import { referenceSketchCommand } from './comic-commands/reference-sketch/reference-sketch-command'
import { draftScenesCommand } from './comic-commands/draft-scenes/draft-scenes-command'
import { generateImagesCommand } from './comic-commands/generate-images/generate-images-command'
import { DRAFT_SCENES_COMMAND, GENERATE_IMAGES_COMMAND, REFERENCE_SKETCH_COMMAND, parseDraftScenesArgs, parseGenerateImagesArgs, parseReferenceSketchArgs } from './comic-utils/cli-args'
import {
  COMIC_SUBCOMMAND_SUMMARIES,
  DRAFT_SCENES_DESCRIPTION,
  GENERATE_IMAGES_DESCRIPTION,
  REFERENCE_SKETCH_DESCRIPTION,
  hasComicSubcommandHelp,
  printComicSubcommandHelp
} from './comic-utils/subcommand-help'
import { renderCommandHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { resolveComicScriptReference, resolveSceneSlug } from './comic-utils/project-paths'
import { estimateCharacterSketchPrice, estimateDraftScenesPrice, estimateGenerateImagesPrice, estimateLocationReferencePrice } from './comic-utils/price-estimate'
import type { ComicSubcommandDefinition } from '~/types'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { stripDefinedGlobalArgs } from '~/cli/native/global-arg-stripper'
import { withCharacterCatalog } from './comic-utils/character-reference-config'

const PUBLIC_COMIC_COMMANDS = [
  DRAFT_SCENES_COMMAND,
  GENERATE_IMAGES_COMMAND,
  REFERENCE_SKETCH_COMMAND,
] as const

const printComicHelp = (): void => {
  console.log(renderCommandHelp(createNativeRootDefinition(), comicCommand))
}

const parseArgsOrUsage = <T>(parse: () => T): T => rethrowAsUsage(parse)

const resolveComicScriptReferenceOrUsage = (scriptReference: string): Promise<string> =>
  rethrowAsUsage(() => resolveComicScriptReference(scriptReference))

const comicSubcommands = [
  {
    name: REFERENCE_SKETCH_COMMAND,
    description: REFERENCE_SKETCH_DESCRIPTION,
    run: async (rawArgs) => {
      const { showHelp, price, ...options } = parseArgsOrUsage(() => parseReferenceSketchArgs(rawArgs))
      if (showHelp) { printComicSubcommandHelp(REFERENCE_SKETCH_COMMAND); return }
      if (price) {
        if (options.location) {
          await estimateLocationReferencePrice(options)
        } else await withCharacterCatalog(async () => await estimateCharacterSketchPrice(options))
        return
      }
      if (options.location) await referenceSketchCommand(options)
      else await withCharacterCatalog(async () => await referenceSketchCommand(options))
    },
  },
  {
    name: DRAFT_SCENES_COMMAND,
    description: DRAFT_SCENES_DESCRIPTION,
    run: async (rawArgs) => {
      const parsed = parseArgsOrUsage(() => parseDraftScenesArgs(rawArgs))
      if (parsed.showHelp) {
        printComicSubcommandHelp(DRAFT_SCENES_COMMAND)
        return
      }
      if (!parsed.scriptPath) {
        throw CLIUsageError('Missing script path. Usage: bun autoshow comic draft-scenes <script-path>')
      }
      const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
      const sceneSlug = resolveSceneSlug(scriptPath)
      const options = { ...parsed, scriptPath, sceneSlug }
      if (parsed.price) {
        await estimateDraftScenesPrice(options)
      } else {
        await withCharacterCatalog(async () => await draftScenesCommand(options))
      }
    },
  },
  {
    name: GENERATE_IMAGES_COMMAND,
    description: GENERATE_IMAGES_DESCRIPTION,
    run: async (rawArgs) => {
      const parsed = parseArgsOrUsage(() => parseGenerateImagesArgs(rawArgs))
      if (parsed.showHelp) {
        printComicSubcommandHelp(GENERATE_IMAGES_COMMAND)
        return
      }
      if (!parsed.scriptPath) {
        throw CLIUsageError('Missing script path. Usage: bun autoshow comic generate-images <script-path>')
      }
      const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
      const sceneSlug = resolveSceneSlug(scriptPath)
      const options = { ...parsed, scriptPath, sceneSlug }
      if (parsed.price) {
        await estimateGenerateImagesPrice(options)
        return
      }
      await generateImagesCommand(options)
    },
  },
] as const satisfies readonly ComicSubcommandDefinition[]

const comicSubcommandMap = new Map<string, ComicSubcommandDefinition>(
  comicSubcommands.map(command => [command.name, command])
)

const formatPublicSubcommands = (): string => PUBLIC_COMIC_COMMANDS.join(', ')

const dispatchComicSubcommand = async (rawArgs: string[]): Promise<void> => {
  const subcommand = rawArgs[0]
  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    printComicHelp()
    return
  }

  if (subcommand === 'help') {
    const helpTarget = rawArgs[1]
    if (helpTarget !== undefined && hasComicSubcommandHelp(helpTarget)) {
      printComicSubcommandHelp(helpTarget)
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

  const command = comicSubcommandMap.get(subcommand)
  if (!command) {
    throw CLIUsageError(`Unknown comic subcommand "${subcommand}". Use one of: ${formatPublicSubcommands()}`)
  }

  await command.run(rawArgs.slice(1))
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
  }))
})
