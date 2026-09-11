import {
  draftScenesFlags,
  draftTreatmentFlags,
  comicGenerateAudioFlags,
  comicGenerateSlideshowFlags,
  comicReviewFlags,
  comicReviewNotesFlags,
  comicReviewSheetFlags,
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
  REVIEW_COMMAND,
  REVIEW_NOTES_COMMAND,
  REVIEW_SHEET_COMMAND
} from './cli-args'
import {
  handleDraftScenes,
  handleDraftTreatment,
  handleGenerateAudio,
  handleGenerateImages,
  handleGenerateSlideshow,
  handleReferenceSketch,
  handleReview,
  handleReviewNotes,
  handleReviewSheet,
} from './subcommand-handlers'
import type { CliCommandDefinition } from '~/types'
import { referenceVoiceCommandDefinition } from '../comic-commands/reference-voice/reference-voice-command'
import * as l from '~/utils/app-logger/app-logger'

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
const DRAFT_SCENES_DESCRIPTION = 'Run script markdown to structured script JSON to draft prompt bundles to a blocking plan to scene JSON to panel prompt bundles'
const GENERATE_IMAGES_DESCRIPTION = 'Run panel prompt bundles to review sketches and/or final panel images'
const REFERENCE_SKETCH_DESCRIPTION = 'Generate and register a character sheet or one canonical location view'
const GENERATE_AUDIO_DESCRIPTION = 'Render approved character voices from an existing compatible structured comic scene'
const GENERATE_SLIDESHOW_DESCRIPTION = 'Synchronize canonical still panels with one complete manifest-backed audio run using local FFmpeg'
const REVIEW_NOTES_DESCRIPTION = 'Map a Markdown review-notes file onto reviewed panels and emit paste-ready staging directives'
const REVIEW_SHEET_DESCRIPTION = 'Build a static per-panel review sheet with contracts, stage boards, canonical images, and QA evidence'

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
      `Continue with bun autoshow comic ${DRAFT_SCENES_COMMAND} <episode>-<scene> --only structure, reference-sketch for every new key, then --only scene --panel-count <n>.`,
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
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --only panel-prompts`, 'Build only the panel prompt bundles'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --only blocking --blocking-plan input/blocking/05-01.json`, 'Import a hand-authored blocking plan without calling any provider'],
      [`bun autoshow comic ${DRAFT_SCENES_COMMAND} 05-01 --price`, 'Estimate the drafting cost without calling any provider']
    ],
    notes: [
      'Stages run in order: structure, prompt, blocking, scene, panel-prompts. --only runs a single stage; --no-blocking skips the blocking stage in a full run and drafts the scene plan-free.',
      'The blocking stage binds to a reviewed metadata/scene.json automatically (writing metadata/blocking-bindings.json); --blocking-plan imports a plan and --rebind remaps citations, neither calling a provider.',
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
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --qa-only --panels 1-5 --price`, 'Estimate a non-generating audit of existing canonical panels'],
      [`bun autoshow comic ${GENERATE_IMAGES_COMMAND} 05-01 --no-qa --price`, 'Estimate the image cost with QA disabled']
    ],
    notes: [
      'Reviewed scene and panel prompt bundles are required; --force only regenerates image outputs.',
      `To rebuild panel prompts explicitly, run: bun autoshow comic ${DRAFT_SCENES_COMMAND} <script-path> --only panel-prompts`,
      'QA-only mode reads canonical individual panels and writes a separate audit report without generation, repairs, promotion, or image-manifest changes.',
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
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --provider hume=octave-2`, 'Render with approved Hume castings'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --provider mistral=voxtral-mini-tts-2603 --mode segmented`, 'Render approved Mistral saved/reference voices'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --provider elevenlabs=eleven_v3 --sfx-provider elevenlabs=eleven_text_to_sound_v2`, 'Render dialogue plus authored sound effects and ambience'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --sfx-provider replicate=sepal/audiogen@154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8 --sfx-license-use noncommercial`, 'Render authored action SFX and ambience with pinned AudioGen'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --sfx-provider stability=stable-audio-3`, 'Render authored action SFX and ambience with Stability Stable Audio 3'],
      [`bun autoshow comic ${GENERATE_AUDIO_COMMAND} 05-01 --all-providers --profile default --price`, 'Plan every selected target without calls or writes'],
    ],
    notes: [
      'The command consumes a compatible existing comic scene run and never creates a replacement run.',
      'Every speaking subject requires an approved current registration for every selected provider/model/profile.',
      'Authored SFX, VOCAL SFX, or AMBIENCE requires an explicit --sfx-provider unless a compatible retained sound-effect render plan supplies the exact target.',
      'Replicate AudioGen also requires --sfx-license-use noncommercial; commercial or unknown use is rejected before credentials or dispatch.',
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
      'Every reviewed panel must exist as canonical panels/panel-NN.png with identical even dimensions.',
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
  description: 'Build a local review sheet or map supplied review notes to staging directives',
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: comicReviewFlags,
  help: {
    examples: [
      ['bun autoshow comic review 02-01', 'Build the per-panel HTML review sheet'],
      ['bun autoshow comic review 02-01 --export-doc', 'Also export a shared-document review sheet'],
      ['bun autoshow comic review 02-01 --notes review/pass-2.md', 'Map supplied notes to paste-ready staging directives'],
    ],
    notes: [
      'Without --notes, writes metadata/review/review-sheet.html; --export-doc also writes metadata/review/export-doc.md.',
      'Supplying --notes selects notes processing only and cannot be combined with --export-doc. Notes use Markdown ### Panel NN headings.',
      'Notes processing writes metadata/review/review-notes-<run-id>.md and never rewrites the source script or reviewed scene.',
      'Both modes read local artifacts and make no provider call. Only notes processing requires the character catalog.',
      'Deprecated aliases: comic review-sheet and comic review-notes retain their original flags for one compatibility release.',
      ARTIFACT_NOTE,
    ],
  },
}, handleReview)

export const reviewNotesCommandDefinition = defineCliCommand({
  name: `comic ${REVIEW_NOTES_COMMAND}`,
  description: REVIEW_NOTES_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: comicReviewNotesFlags,
  help: {
    hidden: true,
    examples: [
      [`bun autoshow comic ${REVIEW_NOTES_COMMAND} 02-01 --notes docs/plans/episode-2-erik-review-notes.md`, 'Map review notes onto reviewed panels'],
    ],
    notes: [
      'Deprecated: use comic review <script-path> --notes <path>. This alias is retained for one compatibility release.',
      'The notes file is Markdown whose "### Panel NN" headings hold the note text for each reviewed panel.',
      'Each note is classified as blocking, camera, axis-break, costume, or extras by a documented keyword table and rendered as a paste-ready script directive beside its target beat and script line.',
      'The command reads metadata/scene.json and metadata/structured-script.json, writes metadata/review/review-notes-<run-id>.md, and makes no provider call.',
      ARTIFACT_NOTE,
    ],
  },
}, async (ctx) => {
  l.warn('comic review-notes is deprecated; use comic review <script-path> --notes <path>.', { category: 'command' })
  await handleReviewNotes(ctx)
})

export const reviewSheetCommandDefinition = defineCliCommand({
  name: `comic ${REVIEW_SHEET_COMMAND}`,
  description: REVIEW_SHEET_DESCRIPTION,
  parameters: [SCRIPT_PATH_PARAMETER],
  flags: comicReviewSheetFlags,
  help: {
    hidden: true,
    examples: [
      [`bun autoshow comic ${REVIEW_SHEET_COMMAND} 02-01`, 'Build the static per-panel review sheet'],
      [`bun autoshow comic ${REVIEW_SHEET_COMMAND} 02-01 --export-doc`, 'Also write the shared-document export'],
    ],
    notes: [
      'Deprecated: use comic review <script-path> [--export-doc]. This alias is retained for one compatibility release.',
      'Writes metadata/review/review-sheet.html: one section per reviewed panel with its source segments, contract, stage board, canonical image, QA evidence, and a notes box.',
      'The sheet is a single self-contained file with inline CSS and one small inline script; it loads no external resource and makes no provider call.',
      'The notes box collects into the "### Panel NN" format that comic review <script-path> --notes <path> reads back.',
      ARTIFACT_NOTE,
    ],
  },
}, async (ctx) => {
  l.warn('comic review-sheet is deprecated; use comic review <script-path> [--export-doc].', { category: 'command' })
  await handleReviewSheet(ctx)
})

export const COMIC_SUBCOMMAND_DEFINITIONS = [
  draftTreatmentCommandDefinition,
  draftScenesCommandDefinition,
  generateImagesCommandDefinition,
  generateAudioCommandDefinition,
  generateSlideshowCommandDefinition,
  referenceSketchCommandDefinition,
  reviewCommandDefinition,
  referenceVoiceCommandDefinition,
  reviewNotesCommandDefinition,
  reviewSheetCommandDefinition,
] as const satisfies readonly CliCommandDefinition[]
