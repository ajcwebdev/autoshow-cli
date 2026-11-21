import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { REFERENCE_LOCATION_OPTIONS_NOTE } from '~/cli/flags/reference-option-contract'
import {
  draftScenesFlags,
  draftTreatmentFlags,
  comicGenerateAudioFlags,
  comicGenerateSlideshowFlags,
  comicReviewFlags,
  generateImagesFlags,
  referenceSketchFlags
} from '~/cli/flags/comic-flags'
import { defineCliCommand } from '~/cli/native/native-types'
import {
  DRAFT_SCENES_COMMAND,
  DRAFT_TREATMENT_COMMAND,
  GENERATE_AUDIO_COMMAND,
  GENERATE_IMAGES_COMMAND,
  REFERENCE_SKETCH_COMMAND,
  REVIEW_COMMAND
} from './cli-args'
import {
  handleDraftScenes,
  handleDraftTreatment,
  handleGenerateAudio,
  handleGenerateImages,
  handleGenerateSlideshow,
  handleReferenceSketch,
  handleReview,
} from './subcommand-handlers'
import type { CliCommandDefinition } from '~/types'
import { referenceVoiceCommandDefinition } from '../comic-commands/reference-voice/reference-voice-command'

const SCRIPT_PATH_PARAMETER = {
  key: '<script-path>',
  description: 'Path to a script markdown file, or NN-SC shorthand (e.g. 01-01 or input/scripts/01-script/01-opening.md)'
} as const

const TREATMENT_PATH_PARAMETER = {
  key: '<treatment-path>',
  description: 'Path to a prose treatment as .md, .txt, or .pdf (e.g. input/camp.md)'
} as const

const ARTIFACT_NOTE = 'Comic artifacts are read from input and written under output.'

const DRAFT_TREATMENT_DESCRIPTION = 'Adapt a prose treatment into a fixed-count episode script plus bootstrapped character and location catalog entries'
const DRAFT_SCENES_DESCRIPTION = 'Prepare the structured script and draft prompt locally, draft the scene JSON, then build panel prompt bundles'
const GENERATE_IMAGES_DESCRIPTION = 'Generate review sketches and/or final panel images from panel prompt bundles with one image model per run'
const REFERENCE_SKETCH_DESCRIPTION = 'Generate and register a character sheet or one canonical location view'
const GENERATE_AUDIO_DESCRIPTION = 'Render approved character voices from an existing compatible structured comic scene'
const GENERATE_SLIDESHOW_DESCRIPTION = 'Synchronize the selected still panels with one complete manifest-backed audio run using local FFmpeg'
const REVIEW_DESCRIPTION = 'Build the local review sheet of selected panels, preview an image run\'s candidates with --run, and adopt them explicitly with --use'

export const draftTreatmentCommandDefinition = defineCliCommand({
  name: `comic ${DRAFT_TREATMENT_COMMAND}`,
  description: DRAFT_TREATMENT_DESCRIPTION,
  parameters: [TREATMENT_PATH_PARAMETER],
  flags: draftTreatmentFlags,
  help: {
    examples: [
      [`bun autoshow comic ${DRAFT_TREATMENT_COMMAND} input/camp.md --episode 02 --speaker papa-bear`, 'Draft a ten-panel script and catalog entries from a treatment'],
      [`bun autoshow comic ${DRAFT_TREATMENT_COMMAND} input/camp.md --panel-count 8 --slug camp-manzanita --style-seed camp-manzanita--style-seed.png`, 'Choose the panel count, slug, and style seed image'],
      [`bun autoshow comic ${DRAFT_TREATMENT_COMMAND} input/camp-manzanita-treatment.pdf --price`, 'Estimate the drafting call from a PDF treatment without provider calls'],
    ],
    notes: [
      'Makes one structured LLM call plus one validator retry, then writes input/scripts/<episode>-script/<scene>-<slug>.md so the NN-SC shorthand works for every later stage.',
      'Narration is written under NARRATION labels; quoted lines from --speaker characters become their dialogue and every other quote is folded into narration.',
      'New characters and locations are merged into the catalogs without touching existing keys. The style seed PNG named by --style-seed must already exist under the characters root.',
      `Continue with ${CLI_INVOCATION} comic ${DRAFT_SCENES_COMMAND} <episode>-<scene> --only prepare, reference-sketch for every new key, then --only scene --panel-count <n>.`,
      ARTIFACT_NOTE
    ]
  }
}, handleDraftTreatment)

export const draftScenesCommandDefinition = defineCliCommand({
  name: `comic ${DRAFT_SCENES_COMMAND}`,
  description: DRAFT_SCENES_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: draftScenesFlags,
  help: {
    examples: [
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01`, 'Run every drafting stage for a scene'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} input/scripts/01-script/01-opening.md`, 'Run every drafting stage from an explicit script path'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --only prepare`, 'Build the structured script and draft prompt locally without calling any provider'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --only panel-prompts`, 'Build only the panel prompt bundles'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --price`, 'Estimate the drafting cost without calling any provider']
    ],
    notes: [
      'Stages run in order: prepare, scene, panel-prompts. --only runs a single stage.',
      'prepare is local: it parses the script into metadata/structured-script.json and builds metadata/draft-prompt.md from that exact structure, makes no provider call, and rejects --provider. The former --only structure and --only prompt selectors are replaced by --only prepare.',
      'scene is the only hosted stage; after editing metadata/scene.json, --only panel-prompts rebuilds the bundles with zero provider calls.',
      `Panel prompt bundles produced here are consumed by ${CLI_INVOCATION} comic ${GENERATE_IMAGES_COMMAND}.`,
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
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --panels 3 --provider openai`, 'Generate another version of panel 3 with one selected image model'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --price`, 'Estimate the outstanding image cost without calling any provider']
    ],
    notes: [
      'Reviewed scene and panel prompt bundles are required; --force only regenerates image outputs.',
      `To rebuild panel prompts explicitly, run: ${CLI_INVOCATION} comic ${DRAFT_SCENES_COMMAND} <script-path> --only panel-prompts`,
      'Each run uses exactly one --provider provider[=model]; run a separate invocation for another model. Each run gets its own image run ID and candidate directory.',
      'The first valid individual panel fills an empty slot at panels/panel-NN.png; later runs save alternatives for comic review --run <id> --use. Sketches and grouped or grid pages never fill a slot.',
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
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --provider elevenlabs=eleven_v3 --sfx-provider elevenlabs=eleven_text_to_sound_v2`, 'Render dialogue plus authored sound effects and ambience'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --all-providers --profile default --price`, 'Plan every selected target without calls or writes'],
    ],
    notes: [
      'The command consumes a compatible existing comic scene run and never creates a replacement run.',
      'Every speaking subject requires an approved current registration for every selected provider/model/profile.',
      'Authored SFX, VOCAL SFX, or AMBIENCE requires an explicit --sfx-provider unless a compatible retained sound-effect render plan supplies the exact target.',
      'Price mode performs read-only planning, includes compatible retained render progress, and writes no canonical, domain, or protected artifacts.',
      ARTIFACT_NOTE,
    ],
  },
}, handleGenerateAudio)

export const generateSlideshowCommandDefinition = defineCliCommand({
  name: 'comic generate-slideshow',
  description: GENERATE_SLIDESHOW_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: comicGenerateSlideshowFlags,
  help: {
    examples: [
      ['bun autoshow comic generate-slideshow 05-01', 'Render one synchronized still-panel slideshow'],
      ['bun autoshow comic generate-slideshow 05-01 --audio-target elevenlabs=eleven_v3 --untimed-panel-ms 2500', 'Select an exact audio target and custom untimed hold'],
      ['bun autoshow comic generate-slideshow 05-01 --price', 'Report the zero-dollar local render cost without writes'],
    ],
    notes: [
      'Uses the selected panels: every reviewed panel must exist as panels/panel-NN.png with identical even dimensions. The first valid generated panel is selected automatically; comic review --run <id> --use replaces a selection.',
      'Only complete canonical AudioRun timelines are supported; raw WAV files cannot synchronize panels.',
      'Rendering is local and uses hard cuts only: no motion, transitions, rescaling, or provider calls.',
      ARTIFACT_NOTE,
    ],
  },
}, handleGenerateSlideshow)

export const referenceSketchCommandDefinition = defineCliCommand({
  name: `comic ${REFERENCE_SKETCH_COMMAND}`,
  description: REFERENCE_SKETCH_DESCRIPTION,
  flags: referenceSketchFlags,
  help: {
    beforeFlags: [REFERENCE_LOCATION_OPTIONS_NOTE],
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

export const reviewCommandDefinition = defineCliCommand({
  name: `comic ${REVIEW_COMMAND}`,
  description: REVIEW_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: comicReviewFlags,
  help: {
    examples: [
      ['bun autoshow comic review 02-01', 'Build the per-panel HTML review sheet of the selected panels'],
      ['bun autoshow comic review 02-01 --export-doc', 'Also export a shared-document review sheet'],
      ['bun autoshow comic review 02-01 --run <image-run-id>', 'Preview that run\'s candidates beside the current selection'],
      ['bun autoshow comic review 02-01 --run <image-run-id> --use --panels 3', 'Select that run\'s panel 3'],
    ],
    notes: [
      'Writes metadata/review/review-sheet.html; --export-doc also writes metadata/review/export-doc.md. Previewing and exporting never change a selection.',
      '--run <image-run-id> shows the individual panel candidates from that comic generate-images run beside the current selection and marks panels the run did not produce.',
      '--use adopts the --run candidates as the selected panels/panel-NN.png files; without --panels it adopts all declared scene panels, and a subset run requires an explicit --panels list. Every requested panel is validated before any selection changes.',
      'Review is local and makes no provider call.',
      ARTIFACT_NOTE,
    ],
  },
}, handleReview)

export const COMIC_SUBCOMMAND_DEFINITIONS = [
  draftTreatmentCommandDefinition,
  draftScenesCommandDefinition,
  generateImagesCommandDefinition,
  generateAudioCommandDefinition,
  generateSlideshowCommandDefinition,
  referenceSketchCommandDefinition,
  reviewCommandDefinition,
  referenceVoiceCommandDefinition,
] as const satisfies readonly CliCommandDefinition[]
