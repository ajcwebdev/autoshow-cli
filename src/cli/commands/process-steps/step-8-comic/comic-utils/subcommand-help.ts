import {
  characterSketchFlags,
  draftScenesFlags,
  generateImagesFlags,
  referenceSketchFlags
} from '~/cli/flags/comic-flags'
import { renderCommandHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import {
  CHARACTER_SKETCH_COMMAND,
  DRAFT_SCENES_COMMAND,
  GENERATE_IMAGES_COMMAND,
  REFERENCE_SKETCH_COMMAND
} from './cli-args'
import type { CliCommandDefinition } from '~/types'

type ComicSubcommandHelpDefinition = Omit<CliCommandDefinition, 'handler'>

const SCRIPT_PATH_PARAMETER = {
  key: '<script-path>',
  description: 'Path to a script markdown file, or NN-SC shorthand (e.g. 01-01 or input/episode-scripts/01-script/01-opening.md)'
} as const

const ARTIFACT_NOTE = 'Comic artifacts are read from input and written under output.'

export const DRAFT_SCENES_DESCRIPTION = 'Run script markdown to structured script JSON to draft prompt bundles to scene JSON to panel prompt bundles'
export const GENERATE_IMAGES_DESCRIPTION = 'Run panel prompt bundles to review sketches and/or final panel images'
export const REFERENCE_SKETCH_DESCRIPTION = 'Generate and register a character or canonical multi-view location sheet'
export const CHARACTER_SKETCH_DESCRIPTION = 'Generate and register a flat three-view character outline sheet'

const draftScenesHelp: ComicSubcommandHelpDefinition = {
  name: `comic ${DRAFT_SCENES_COMMAND}`,
  description: DRAFT_SCENES_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: draftScenesFlags,
  help: {
    examples: [
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01`, 'Run every drafting stage for a scene'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} input/episode-scripts/01-script/01-opening.md`, 'Run every drafting stage from an explicit script path'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --only panel-prompts`, 'Build only the panel prompt bundles'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --price`, 'Estimate the drafting cost without calling any provider']
    ],
    notes: [
      'Stages run in order: structure, prompt, scene, panel-prompts. --only runs a single stage.',
      `Panel prompt bundles produced here are consumed by bun autoshow comic ${GENERATE_IMAGES_COMMAND}.`,
      ARTIFACT_NOTE
    ]
  }
}

const generateImagesHelp: ComicSubcommandHelpDefinition = {
  name: `comic ${GENERATE_IMAGES_COMMAND}`,
  description: GENERATE_IMAGES_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
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
}

const referenceSketchHelp: ComicSubcommandHelpDefinition = {
  name: `comic ${REFERENCE_SKETCH_COMMAND}`,
  description: REFERENCE_SKETCH_DESCRIPTION,
  flags: referenceSketchFlags,
  help: {
    examples: [
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --character hero`, 'Generate a character reference sheet'],
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --location cargo-bay`, 'Generate a canonical location reference'],
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --character hero --revise --notes "shorter jacket"`, 'Revise an existing sheet'],
      [`bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --location cargo-bay --price`, 'Estimate the sheet cost without calling any provider']
    ],
    notes: [
      'Exactly one of --character or --location is required.',
      'Generated sheets are registered in the characters root (see --characters-root).',
      ARTIFACT_NOTE
    ]
  }
}

const characterSketchHelp: ComicSubcommandHelpDefinition = {
  name: `comic ${CHARACTER_SKETCH_COMMAND}`,
  description: CHARACTER_SKETCH_DESCRIPTION,
  flags: characterSketchFlags,
  help: {
    examples: [
      [`bun autoshow comic ${CHARACTER_SKETCH_COMMAND} --character hero`, 'Generate a character sketch reference'],
      [`bun autoshow comic ${CHARACTER_SKETCH_COMMAND} --character hero --price`, 'Estimate the sketch cost without calling any provider']
    ],
    notes: [
      `Compatibility alias for bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --character <key>.`,
      `--location is not accepted here; use bun autoshow comic ${REFERENCE_SKETCH_COMMAND} --location <key>.`,
      ARTIFACT_NOTE
    ]
  }
}

const COMIC_SUBCOMMAND_HELP: Readonly<Record<string, ComicSubcommandHelpDefinition>> = {
  [DRAFT_SCENES_COMMAND]: draftScenesHelp,
  [GENERATE_IMAGES_COMMAND]: generateImagesHelp,
  [REFERENCE_SKETCH_COMMAND]: referenceSketchHelp,
  [CHARACTER_SKETCH_COMMAND]: characterSketchHelp
}

export const COMIC_SUBCOMMAND_SUMMARIES: ReadonlyArray<readonly [name: string, description: string]> =
  Object.entries(COMIC_SUBCOMMAND_HELP).map(([name, definition]) => [name, definition.description] as const)

export const hasComicSubcommandHelp = (subcommand: string): boolean =>
  Object.hasOwn(COMIC_SUBCOMMAND_HELP, subcommand)

export const printComicSubcommandHelp = (subcommand: string): void => {
  const definition = COMIC_SUBCOMMAND_HELP[subcommand]
  if (definition === undefined) {
    return
  }
  console.log(renderCommandHelp(createNativeRootDefinition(), definition))
}
