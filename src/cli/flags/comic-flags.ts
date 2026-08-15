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
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  DEFAULT_SKETCH_PANELS_PER_IMAGE
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { IMAGE_GENERATION_QUALITIES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { sharedConcurrencyFlags } from './shared-flags'

// These tables are both the native parser definitions and the comic help metadata.

const comicPriceFlag = {
  price: boolFlag(colorizeHelpDescription('Dry run: estimate API cost without making any calls'))
} as const satisfies CliFlagsDefinition

const comicConcurrencyFlag = {
  concurrency: strFlag(colorizeHelpDescription(`Number of image/prompt tasks to run in parallel (default: ${DEFAULT_CLI_CONCURRENCY})`)),
  'concurrency-mode': sharedConcurrencyFlags['concurrency-mode']
} as const satisfies CliFlagsDefinition

const comicImageFlags = {
  'image-model': strFlag(colorizeHelpDescription(`Image model ID from the central image registry (default: ${DEFAULT_IMAGE_MODEL})`)),
  size: strFlag(colorizeHelpDescription(`Image size: ${IMAGE_SIZE_HELP}`)),
  quality: strFlag(colorizeHelpDescription(`Image quality: ${IMAGE_GENERATION_QUALITIES.join('|')}`))
} as const satisfies CliFlagsDefinition

const comicQaFlags = {
  qa: {
    description: colorizeHelpDescription('Enable or disable final-image QA (default: enabled)'),
    type: Boolean,
    negatable: true
  },
  'qa-model': strFlag(colorizeHelpDescription(`Vision judge model: an OpenAI vision-capable LLM (default: ${DEFAULT_QA_MODEL})`)),
  'max-repairs': strFlag(colorizeHelpDescription('Maximum repair attempts after the initial image; stagnation may restart once or stop early (default: 2)'))
} as const satisfies CliFlagsDefinition

const draftScenesStageFlags = {
  only: strFlag(colorizeHelpDescription('Run one stage: structure|prompt|scene|panel-prompts')),
  'llm-model': strFlag(colorizeHelpDescription(`Text model for scene drafting (default: ${DEFAULT_LLM_MODEL})`))
} as const satisfies CliFlagsDefinition

export const draftScenesFlags = {
  ...withHelpGroup(draftScenesStageFlags, 'comic-stages'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const generateImagesPanelFlags = {
  target: strFlag(colorizeHelpDescription('What to generate: images|sketches|both (default: images)')),
  panels: strFlag(colorizeHelpDescription('Panels to process: all, 1-8, 1,3,7, or 1-4,9; overlong ranges clamp (default: all)')),
  'panels-per-image': strFlag(colorizeHelpDescription(`Panels drawn per generated image; overrides both stages (final default: ${DEFAULT_FINAL_PANELS_PER_IMAGE}; sketch default: ${DEFAULT_SKETCH_PANELS_PER_IMAGE})`)),
  grid: strFlag(colorizeHelpDescription(`Compose individual final panels into local page grids as <columns>x<rows>; requires --panels-per-image 1 and --size ${COMIC_GRID_PANEL_SIZE}`))
} as const satisfies CliFlagsDefinition

const generateImagesVariationFlag = {
  variation: strFlag(colorizeHelpDescription(`Final-image prompt variations as name[,name...]: ${IMAGE_PROMPT_VARIATIONS.join('|')}`))
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

export const generateImagesFlags = {
  ...withHelpGroup(generateImagesPanelFlags, 'comic-panels'),
  ...withHelpGroup({ 'image-model': comicImageFlags['image-model'] }, 'comic-image'),
  ...withHelpGroup(generateImagesVariationFlag, 'comic-image'),
  ...withHelpGroup({ size: comicImageFlags.size, quality: comicImageFlags.quality }, 'comic-image'),
  ...withHelpGroup(comicQaFlags, 'comic-qa'),
  ...withHelpGroup(generateImagesForceFlag, 'comic-run'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const comicAudioSelectionFlags = pickFlags(ttsCommandFlags, [
  'provider',
  'all-providers',
  'all-local',
  'provider-concurrency',
  'local-concurrency',
  'tts-chunk-concurrency',
  'concurrency-mode',
])

const comicSoundscapeSelectionFlags = {
  'sfx-provider': strFlag(colorizeHelpDescription('Dedicated sound-effect target as provider=model; accepts elevenlabs=eleven_text_to_sound_v2 or replicate=sepal/audiogen@<pinned-version> and has no hosted default')),
  'sfx-license-use': strFlag(colorizeHelpDescription('Required intended-use declaration for license-restricted SFX targets: noncommercial|commercial|unknown; never inferred from model selection')),
  'sfx-concurrency': strFlag(colorizeHelpDescription('Bounded parallel sound-effect requests (default: 2)')),
  'soundscape-timing-policy': strFlag(colorizeHelpDescription('Inline cue timing: strict|proportional; proportional records its estimate and error bound (default: strict)')),
} as const satisfies CliFlagsDefinition

const comicAudioContractFlags = {
  profile: strFlag(colorizeHelpDescription('Approved casting profile key (default: default)')),
  mode: strFlag(colorizeHelpDescription('Render strategy: auto|native|segmented (default: auto)')),
  'delivery-policy': strFlag(colorizeHelpDescription('Authored delivery handling: strict|best-effort (default: strict)')),
  'pacing-profile': strFlag(colorizeHelpDescription('Deterministic local dialogue pacing: none|loose-comedy (default: none)')),
  'allow-ambiguous-redispatch': boolFlag(colorizeHelpDescription('Explicitly authorize repurchasing a provider-admitted slot that has no recoverable audio')),
  'max-generation-slots': strFlag(colorizeHelpDescription('Generate at most this many unresolved immutable slots, checkpoint, and exit without a final WAV')),
  role: strListFlag(colorizeHelpDescription('Map an uncatalogued or compound speaker label to a logical voice subject, LABEL=role:key or LABEL=voice:key; repeatable')),
  'sample-rate': strFlag(colorizeHelpDescription('Final WAV sample rate in Hz (default: 48000)')),
  channels: strFlag(colorizeHelpDescription('Final channel count: 1|2 (default: 2)')),
  codec: strFlag(colorizeHelpDescription('Final PCM codec: pcm_s16le|pcm_s24le (default: pcm_s24le)')),
  slideshow: boolFlag(colorizeHelpDescription('Automatically render the synchronized still-panel MP4 video upon audio completion')),
  'panel-video': boolFlag(colorizeHelpDescription('Alias for --slideshow')),
} as const satisfies CliFlagsDefinition

export const comicGenerateAudioFlags = {
  ...withHelpGroup(comicAudioSelectionFlags, 'provider-selection'),
  ...withHelpGroup(comicSoundscapeSelectionFlags, 'provider-selection'),
  ...withHelpGroup(comicAudioContractFlags, 'comic-audio'),
  ...withHelpGroup(comicPriceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition

const comicPresentationFlags = {
  'audio-target': strFlag(colorizeHelpDescription('Select one complete canonical audio run as provider=model; inferred only when selection is unambiguous')),
  'untimed-panel-ms': strFlag(colorizeHelpDescription('Hold duration for a panel without dialogue or a discrete effect (default: 2000)')),
  fps: strFlag(colorizeHelpDescription('Constant output frame rate from 1 through 120 (default: 30)')),
} as const satisfies CliFlagsDefinition

const comicPresentationPriceFlag = {
  price: boolFlag(colorizeHelpDescription('Report the $0 local render cost without provider calls or writes')),
} as const satisfies CliFlagsDefinition

export const comicGenerateSlideshowFlags = {
  ...withHelpGroup(comicPresentationFlags, 'comic-presentation'),
  ...withHelpGroup(comicPresentationPriceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition

const referenceSketchSheetFlags = {
  character: strFlag(colorizeHelpDescription('Catalog character key (mutually exclusive with --location)')),
  location: strFlag(colorizeHelpDescription('Canonical location key (mutually exclusive with --character)')),
  view: strFlag(colorizeHelpDescription('Location camera view: establishing|reverse|side (default: establishing)')),
  revise: {
    description: colorizeHelpDescription('Revision mode; requires --notes'),
    type: Boolean,
    short: 'r',
    default: false,
    negatable: false
  },
  notes: strFlag(colorizeHelpDescription('Revision instructions (requires --revise)')),
  'llm-model': strFlag(colorizeHelpDescription(`Text model used to draft the sheet prompt (default: ${DEFAULT_LLM_MODEL})`))
} as const satisfies CliFlagsDefinition

export const referenceSketchFlags = {
  ...withHelpGroup(referenceSketchSheetFlags, 'comic-reference'),
  ...withHelpGroup(comicImageFlags, 'comic-image'),
  ...withHelpGroup(comicQaFlags, 'comic-qa'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
