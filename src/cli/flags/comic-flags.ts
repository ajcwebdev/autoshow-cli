import { boolFlag, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { ttsCommandFlags } from './tts-flags'
import { colorizeHelpDescription } from '~/cli/help-colors'
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_QA_MODEL
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_SIZE_HELP
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/image-size'
import { IMAGE_PROMPT_VARIATIONS } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/prompt-variations'
import { BLOCKING_HARD_CANDIDATE_STATUSES } from '~/cli/commands/process-steps/step-8-comic/schemas/blocking-plan-schemas'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  DEFAULT_SKETCH_PANELS_PER_IMAGE
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import { DEFAULT_CONCURRENCY_FLAG_VALUE } from '~/utils/concurrency-defaults'
import { IMAGE_GENERATION_QUALITIES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { sharedConcurrencyFlags } from './shared-flags'

const comicPriceFlag = {
  price: boolFlag(colorizeHelpDescription('Dry run: estimate API cost without making any calls'))
} as const satisfies CliFlagsDefinition

const comicConcurrencyFlag = {
  concurrency: strFlag(colorizeHelpDescription('Number of image/prompt tasks to run in parallel'), DEFAULT_CONCURRENCY_FLAG_VALUE),
  'concurrency-mode': sharedConcurrencyFlags['concurrency-mode']
} as const satisfies CliFlagsDefinition

const comicImageFlags = {
  'image-model': strFlag(colorizeHelpDescription('Image model ID from the central image registry'), DEFAULT_IMAGE_MODEL),
  size: strFlag(colorizeHelpDescription(`Image size: ${IMAGE_SIZE_HELP}`)),
  quality: strFlag(colorizeHelpDescription(`Image quality: ${IMAGE_GENERATION_QUALITIES.join('|')}`))
} as const satisfies CliFlagsDefinition

const comicQaFlags = {
  qa: {
    description: colorizeHelpDescription('Enable or disable final-image QA (default: enabled)'),
    type: Boolean,
    negatable: true
  },
  'qa-only': boolFlag(colorizeHelpDescription('Judge existing canonical individual panels without generating, repairing, or promoting images')),
  'qa-model': strFlag(colorizeHelpDescription('Vision judge model: an OpenAI or Gemini vision-capable LLM'), DEFAULT_QA_MODEL),
  'max-repairs': strFlag(colorizeHelpDescription('Maximum repair attempts after the initial image; stagnation may restart once or stop early'), '2')
} as const satisfies CliFlagsDefinition

const generateImagesBlooperFlags = {
  bloopers: boolFlag(colorizeHelpDescription('Copy every non-promoted panel attempt into output/bloopers/ with a provenance sidecar for the blooper reel; opt-in and governed by the project policy for retaining failed attempts')),
} as const satisfies CliFlagsDefinition

const generateImagesUnattendedFlags = {
  'stop-on-provider-error': boolFlag(colorizeHelpDescription('Abort the remaining panels on the first provider error instead of continuing; already written attempts are preserved and the run exits non-zero')),
  'credit-preflight': boolFlag(colorizeHelpDescription('Verify the provider credential and account credit with one zero-cost models request before any paid call; in --price mode it only reports that it would run')),
} as const satisfies CliFlagsDefinition

const generateImagesBlockingFlags = {
  'blocking-hard-keys': strFlag(colorizeHelpDescription(`Blocking audit statuses promoted from advisory to hard QA failures as a comma list: ${BLOCKING_HARD_CANDIDATE_STATUSES.join('|')}; default empty leaves every blocking status advisory`)),
  'blocking-layout-guide': boolFlag(colorizeHelpDescription('Attach the compiled screen-space marker guide to dense single-panel blocking requests; experimental and off by default')),
} as const satisfies CliFlagsDefinition

const draftScenesStageFlags = {
  only: strFlag(colorizeHelpDescription('Run one stage: structure|prompt|blocking|scene|panel-prompts')),
  blocking: {
    description: colorizeHelpDescription('Enable or disable the blocking-plan stage in a full run (default: enabled); --no-blocking drafts the scene plan-free'),
    type: Boolean,
    negatable: true
  },
  'blocking-plan': strFlag(colorizeHelpDescription('Import a hand-authored blocking plan JSON for the blocking stage instead of drafting one; makes no provider call')),
  rebind: boolFlag(colorizeHelpDescription('Remap the existing blocking plan citations to the current structured script by segment content hash and report unresolved ones; requires --only blocking and makes no provider call')),
  'reconcile-from-directives': boolFlag(colorizeHelpDescription('Apply the script\'s CAMERA, BREAK-180, COSTUME, and EXTRAS staging directives to the reviewed scene and blocking plan without an LLM call; panel splits and merges are rejected')),
  'llm-model': strFlag(colorizeHelpDescription('Text model for blocking-plan and scene drafting'), DEFAULT_LLM_MODEL)
} as const satisfies CliFlagsDefinition

export const draftScenesFlags = {
  ...withHelpGroup(draftScenesStageFlags, 'comic-stages'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const generateImagesPanelFlags = {
  target: strFlag(colorizeHelpDescription('What to generate: images|sketches|both'), 'images'),
  panels: strFlag(colorizeHelpDescription('Panels to process: all, 1-8, 1,3,7, or 1-4,9; overlong ranges clamp'), 'all'),
  'panels-per-image': strFlag(colorizeHelpDescription(`Panels drawn per generated image; overrides both stages (final default: ${DEFAULT_FINAL_PANELS_PER_IMAGE}; sketch default: ${DEFAULT_SKETCH_PANELS_PER_IMAGE})`)),
  grid: strFlag(colorizeHelpDescription(`Compose individual final panels into local page grids as <columns>x<rows>; requires --panels-per-image 1 and --size ${COMIC_GRID_PANEL_SIZE}`))
} as const satisfies CliFlagsDefinition

const generateImagesVariationFlag = {
  variation: strFlag(colorizeHelpDescription(`Final-image prompt variations as name[,name...]: ${IMAGE_PROMPT_VARIATIONS.join('|')}`))
} as const satisfies CliFlagsDefinition

const generateImagesRevisionFlags = {
  'revision-plan': strFlag(colorizeHelpDescription('Schema-validated, hash-bound targeted panel revision plan')),
  'comparison-passes': strFlag(colorizeHelpDescription('Order-swapped comparison judgments per completed original/candidate pair; revision mode requires 2'), '2'),
  promote: strFlag(colorizeHelpDescription('Revision promotion policy; revision mode requires clear-winners')),
} as const satisfies CliFlagsDefinition

const generateImagesForceFlag = {
  force: {
    description: colorizeHelpDescription('Regenerate and overwrite image outputs only'),
    type: Boolean,
    short: 'f',
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const generateImagesContinuityFlags = {
  'continuity-qa': boolFlag(colorizeHelpDescription('Run the audit-only continuity judge beside the page judge; requires --qa-only')),
  'continuity-only': boolFlag(colorizeHelpDescription('Skip the page judge and run only the continuity judge; requires --continuity-qa')),
  labels: strFlag(colorizeHelpDescription('Human continuity labels JSON in the qa/continuity-labels.json shape; adds per-key precision and recall to the continuity report and requires --continuity-qa')),
  'trusted-anchor-panel': strFlag(colorizeHelpDescription('Panel number the continuity audit anchors on instead of the labels file value or panel 1; requires --continuity-qa')),
} as const satisfies CliFlagsDefinition

export const generateImagesFlags = {
  ...withHelpGroup(generateImagesPanelFlags, 'comic-panels'),
  ...withHelpGroup({ 'image-model': comicImageFlags['image-model'] }, 'comic-image'),
  ...withHelpGroup(generateImagesVariationFlag, 'comic-image'),
  ...withHelpGroup(generateImagesRevisionFlags, 'comic-image'),
  ...withHelpGroup({ size: comicImageFlags.size, quality: comicImageFlags.quality }, 'comic-image'),
  ...withHelpGroup(comicQaFlags, 'comic-qa'),
  ...withHelpGroup(generateImagesBlockingFlags, 'comic-qa'),
  ...withHelpGroup(generateImagesContinuityFlags, 'comic-qa'),
  ...withHelpGroup(generateImagesBlooperFlags, 'comic-run'),
  ...withHelpGroup(generateImagesUnattendedFlags, 'comic-run'),
  ...withHelpGroup(generateImagesForceFlag, 'comic-run'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const comicAudioSelectionFlags = pickFlags(ttsCommandFlags, [
  'provider',
  'all-providers',
  'provider-concurrency',
  'tts-chunk-concurrency',
  'concurrency-mode',
])

const comicSoundscapeSelectionFlags = {
  'sfx-provider': strFlag(colorizeHelpDescription('Dedicated sound-effect target as provider=model; accepts elevenlabs=eleven_text_to_sound_v2, replicate=sepal/audiogen@<pinned-version>, or stability=stable-audio-3 and has no hosted default')),
  'sfx-license-use': strFlag(colorizeHelpDescription('Required intended-use declaration for license-restricted SFX targets: noncommercial|commercial|unknown; never inferred from model selection')),
  'sfx-concurrency': strFlag(colorizeHelpDescription('Bounded parallel sound-effect requests'), '2'),
  'soundscape-timing-policy': strFlag(colorizeHelpDescription('Inline cue timing: strict|proportional; proportional records its estimate and error bound'), 'strict'),
} as const satisfies CliFlagsDefinition

const comicAudioContractFlags = {
  profile: strFlag(colorizeHelpDescription('Approved casting profile key'), 'default'),
  mode: strFlag(colorizeHelpDescription('Render strategy: auto|native|segmented'), 'auto'),
  'delivery-policy': strFlag(colorizeHelpDescription('Authored delivery handling: strict|best-effort'), 'strict'),
  'pacing-profile': strFlag(colorizeHelpDescription('Deterministic local dialogue pacing: none|loose-comedy'), 'none'),
  'allow-ambiguous-redispatch': boolFlag(colorizeHelpDescription('Explicitly authorize repurchasing a provider-admitted slot that has no recoverable audio')),
  'max-generation-slots': strFlag(colorizeHelpDescription('Generate at most this many unresolved immutable slots, checkpoint, and exit without a final WAV')),
  role: strListFlag(colorizeHelpDescription('Map an uncatalogued or compound speaker label to a logical voice subject, LABEL=role:key or LABEL=voice:key; repeatable')),
  slideshow: boolFlag(colorizeHelpDescription('Automatically render the synchronized still-panel MP4 video upon audio completion')),
} as const satisfies CliFlagsDefinition

export const comicGenerateAudioFlags = {
  ...withHelpGroup(comicAudioSelectionFlags, 'provider-selection'),
  ...withHelpGroup(comicSoundscapeSelectionFlags, 'provider-selection'),
  ...withHelpGroup(comicAudioContractFlags, 'comic-audio'),
  ...withHelpGroup(comicPriceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition

const comicPresentationFlags = {
  'audio-target': strFlag(colorizeHelpDescription('Select one complete canonical audio run as provider=model; inferred only when selection is unambiguous')),
  'untimed-panel-ms': strFlag(colorizeHelpDescription('Hold duration for a panel without dialogue or a discrete effect'), '2000'),
  fps: strFlag(colorizeHelpDescription('Constant output frame rate from 1 through 120'), '30'),
} as const satisfies CliFlagsDefinition

const comicPresentationPriceFlag = {
  price: boolFlag(colorizeHelpDescription('Report the $0 local render cost without provider calls or writes')),
} as const satisfies CliFlagsDefinition

export const comicGenerateSlideshowFlags = {
  ...withHelpGroup(comicPresentationFlags, 'comic-presentation'),
  ...withHelpGroup(comicPresentationPriceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition

const comicReviewNotesInputFlags = {
  notes: strFlag(colorizeHelpDescription('Markdown review-notes file whose ### Panel NN headings hold the notes for each reviewed panel'))
} as const satisfies CliFlagsDefinition

export const comicReviewNotesFlags = {
  ...withHelpGroup(comicReviewNotesInputFlags, 'comic-review')
} as const satisfies CliFlagsDefinition

const comicReviewSheetInputFlags = {
  'export-doc': boolFlag(colorizeHelpDescription('Also write metadata/review/export-doc.md with one "### Panel NN" heading and image line per panel for a shared document'))
} as const satisfies CliFlagsDefinition

export const comicReviewSheetFlags = {
  ...withHelpGroup(comicReviewSheetInputFlags, 'comic-review')
} as const satisfies CliFlagsDefinition

const referenceSketchSheetFlags = {
  character: strFlag(colorizeHelpDescription('Catalog character key (mutually exclusive with --location)')),
  location: strFlag(colorizeHelpDescription('Canonical location key (mutually exclusive with --character)')),
  view: strFlag(colorizeHelpDescription('Location camera view: establishing|reverse|side'), 'establishing'),
  revise: {
    description: colorizeHelpDescription('Revision mode; requires --notes'),
    type: Boolean,
    short: 'r',
    default: false,
    negatable: false
  },
  notes: strFlag(colorizeHelpDescription('Revision instructions (requires --revise)')),
  'llm-model': strFlag(colorizeHelpDescription('Text model used to draft the sheet prompt'), DEFAULT_LLM_MODEL)
} as const satisfies CliFlagsDefinition

export const referenceSketchFlags = {
  ...withHelpGroup(referenceSketchSheetFlags, 'comic-reference'),
  ...withHelpGroup(comicImageFlags, 'comic-image'),
  ...withHelpGroup(comicQaFlags, 'comic-qa'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
