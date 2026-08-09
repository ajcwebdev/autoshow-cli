import {
  draftScenesFlags,
  generateImagesFlags,
  referenceSketchFlags
} from '~/cli/flags/comic-flags'
import { defineCliCommand } from '~/cli/native/native-types'
import { renderCommandHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import {
  DRAFT_SCENES_COMMAND,
  GENERATE_IMAGES_COMMAND,
  REFERENCE_SKETCH_COMMAND
} from './cli-args'
import {
  handleDraftScenes,
  handleGenerateImages,
  handleReferenceSketch,
} from './subcommand-handlers'
import type { CliCommandDefinition } from '~/types'

const SCRIPT_PATH_PARAMETER = {
  key: '<script-path>',
  description: 'Path to a script markdown file, or NN-SC shorthand (e.g. 01-01 or input/scripts/01-script/01-opening.md)'
} as const

const ARTIFACT_NOTE = 'Comic artifacts are read from input and written under output.'

export const DRAFT_SCENES_DESCRIPTION = 'Run script markdown to structured script JSON to draft prompt bundles to scene JSON to panel prompt bundles'
export const GENERATE_IMAGES_DESCRIPTION = 'Run panel prompt bundles to review sketches and/or final panel images'
export const REFERENCE_SKETCH_DESCRIPTION = 'Generate and register a character sheet or one canonical location view'

export const draftScenesCommandDefinition = defineCliCommand({
  name: `comic ${DRAFT_SCENES_COMMAND}`,
  description: DRAFT_SCENES_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  allowExcessParameters: true,
  flags: draftScenesFlags,
  help: {
    examples: [
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01`, 'Run every drafting stage for a scene'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} input/scripts/01-script/01-opening.md`, 'Run every drafting stage from an explicit script path'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --only panel-prompts`, 'Build only the panel prompt bundles'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --price`, 'Estimate the drafting cost without calling any provider']
    ],
    notes: [
      'Stages run in order: structure, prompt, scene, panel-prompts. --only runs a single stage.',
      `Panel prompt bundles produced here are consumed by bun autoshow comic ${GENERATE_IMAGES_COMMAND}.`,
      ARTIFACT_NOTE
    ]
  }
}, handleDraftScenes)

export const generateImagesCommandDefinition = defineCliCommand({
  name: `comic ${GENERATE_IMAGES_COMMAND}`,
  description: GENERATE_IMAGES_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  allowExcessParameters: true,
  flags: generateImagesFlags,
  help: {
    examples: [
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01`, 'Generate final panel images for a scene'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --target sketches --panels 1-4`, 'Generate review sketches for panels 1 through 4'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --panels-per-image 6`, 'Generate multi-panel page images'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --no-qa --price`, 'Estimate the image cost with QA disabled']
    ],
    notes: [
      'Scene drafts and panel prompts are auto-detected and only rebuilt when missing; pass --force to rebuild them.',
      `To rebuild panel prompts explicitly, run: bun autoshow comic ${DRAFT_SCENES_COMMAND} <script-path> --only panel-prompts`,
      'QA options (--qa, --qa-model, --max-repairs) only apply when --target is images or both.',
      ARTIFACT_NOTE
    ]
  }
}, handleGenerateImages)

export const referenceSketchCommandDefinition = defineCliCommand({
  name: `comic ${REFERENCE_SKETCH_COMMAND}`,
  description: REFERENCE_SKETCH_DESCRIPTION,
  allowExcessParameters: true,
  flags: referenceSketchFlags,
  help: {
    examples: [
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --character hero`, 'Generate a character reference sheet'],
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --location cargo-bay`, 'Generate a canonical location reference'],
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --location cargo-bay --view reverse`, 'Add the reverse location view'],
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --character hero --revise --notes "shorter jacket"`, 'Revise an existing sheet'],
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --location cargo-bay --view side --price`, 'Estimate one location view without calling any provider']
    ],
    notes: [
      'Exactly one of --character or --location is required.',
      'Location generation targets exactly one view. Establishing is the default and must exist before reverse or side; an existing target is a validated no-op unless --revise --notes is used.',
      'Character sheets are registered in the characters root. Location views are registered separately in its sibling locations root and honor each catalog entry\'s safe root-relative referenceDirectory and establishing referenceFilename.',
      ARTIFACT_NOTE
    ]
  }
}, handleReferenceSketch)

export const COMIC_SUBCOMMAND_DEFINITIONS = [
  draftScenesCommandDefinition,
  generateImagesCommandDefinition,
  referenceSketchCommandDefinition,
] as const satisfies readonly CliCommandDefinition[]

const COMIC_SUBCOMMANDS: Readonly<Record<string, CliCommandDefinition>> = Object.fromEntries(
  COMIC_SUBCOMMAND_DEFINITIONS.map(definition => [definition.name.slice('comic '.length), definition])
)

export const COMIC_SUBCOMMAND_SUMMARIES: ReadonlyArray<readonly [name: string, description: string]> =
  Object.entries(COMIC_SUBCOMMANDS).map(([name, definition]) => [name, definition.description] as const)

export const getComicSubcommand = (subcommand: string): CliCommandDefinition | undefined =>
  COMIC_SUBCOMMANDS[subcommand]

export const printComicSubcommandHelp = (definition: CliCommandDefinition): void => {
  console.log(renderCommandHelp(createNativeRootDefinition(), definition))
}
