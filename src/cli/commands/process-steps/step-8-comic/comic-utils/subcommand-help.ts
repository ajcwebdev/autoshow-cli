import {
  draftScenesFlags,
  comicGenerateAudioFlags,
  generateImagesFlags,
  referenceSketchFlags
} from '~/cli/flags/comic-flags'
import { defineCliCommand } from '~/cli/native/native-types'
import {
  DRAFT_SCENES_COMMAND,
  GENERATE_AUDIO_COMMAND,
  GENERATE_IMAGES_COMMAND,
  REFERENCE_SKETCH_COMMAND
} from './cli-args'
import {
  handleDraftScenes,
  handleGenerateAudio,
  handleGenerateImages,
  handleReferenceSketch,
} from './subcommand-handlers'
import type { CliCommandDefinition } from '~/types'
import { referenceVoiceCommandDefinition } from '../comic-commands/reference-voice/reference-voice-command'

const SCRIPT_PATH_PARAMETER = {
  key: '<script-path>',
  description: 'Path to a script markdown file, or NN-SC shorthand (e.g. 01-01 or input/scripts/01-script/01-opening.md)'
} as const

const ARTIFACT_NOTE = 'Comic artifacts are read from input and written under output.'

export const DRAFT_SCENES_DESCRIPTION = 'Run script markdown to structured script JSON to draft prompt bundles to scene JSON to panel prompt bundles'
export const GENERATE_IMAGES_DESCRIPTION = 'Run panel prompt bundles to review sketches and/or final panel images'
export const REFERENCE_SKETCH_DESCRIPTION = 'Generate and register a character sheet or one canonical location view'
export const GENERATE_AUDIO_DESCRIPTION = 'Render approved character voices from an existing compatible structured comic scene'

export const draftScenesCommandDefinition = defineCliCommand({
  name: `comic ${DRAFT_SCENES_COMMAND}`,
  description: DRAFT_SCENES_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
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
  flags: generateImagesFlags,
  help: {
    examples: [
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01`, 'Generate final panel images for a scene'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --target sketches --panels 1-4`, 'Generate review sketches for panels 1 through 4'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --panels-per-image 6`, 'Generate multi-panel page images'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --no-qa --price`, 'Estimate the image cost with QA disabled']
    ],
    notes: [
      'Reviewed scene and panel prompt bundles are required; --force only regenerates image outputs.',
      `To rebuild panel prompts explicitly, run: bun autoshow comic ${DRAFT_SCENES_COMMAND} <script-path> --only panel-prompts`,
      'QA options (--qa, --qa-model, --max-repairs) only apply when --target is images or both.',
      ARTIFACT_NOTE
    ]
  }
}, handleGenerateImages)

export const generateAudioCommandDefinition = defineCliCommand({
  name: `comic ${GENERATE_AUDIO_COMMAND}`,
  description: GENERATE_AUDIO_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: comicGenerateAudioFlags,
  help: {
    examples: [
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --provider gemini=gemini-2.5-pro-preview-tts`, 'Render with approved Gemini castings'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --provider mistral=voxtral-mini-tts-2603 --mode segmented`, 'Render approved Mistral saved/reference voices'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --all-providers --profile default --price`, 'Plan every selected target without calls or writes'],
    ],
    notes: [
      'The command consumes a compatible existing comic scene run and never creates a replacement run.',
      'Every speaking subject requires an approved current registration for every selected provider/model/profile.',
      'Price mode performs read-only planning, includes compatible retained render progress, and writes no canonical, domain, or protected artifacts.',
      ARTIFACT_NOTE,
    ],
  },
}, handleGenerateAudio)

export const referenceSketchCommandDefinition = defineCliCommand({
  name: `comic ${REFERENCE_SKETCH_COMMAND}`,
  description: REFERENCE_SKETCH_DESCRIPTION,
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
  generateAudioCommandDefinition,
  referenceSketchCommandDefinition,
  referenceVoiceCommandDefinition,
] as const satisfies readonly CliCommandDefinition[]
