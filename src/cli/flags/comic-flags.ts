import { boolFlag, strFlag, withHelpGroup } from './flag-utils'
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

// These tables are both the native parser definitions and the comic help metadata.

const comicPriceFlag = {
  price: boolFlag(colorizeHelpDescription('Dry run: estimate API cost without making any calls'))
} as const satisfies CliFlagsDefinition

const comicConcurrencyFlag = {
  concurrency: strFlag(colorizeHelpDescription(`Number of image/prompt tasks to run in parallel (default: ${DEFAULT_CLI_CONCURRENCY})`))
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
    description: colorizeHelpDescription('Rebuild and overwrite existing outputs, including scene drafts and panel prompts'),
    type: Boolean,
    short: 'f',
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const generateImagesLlmFlag = {
  'llm-model': strFlag(colorizeHelpDescription(`Text model used when scene drafts or panel prompts must be rebuilt (default: ${DEFAULT_LLM_MODEL})`))
} as const satisfies CliFlagsDefinition

export const generateImagesFlags = {
  ...withHelpGroup(generateImagesPanelFlags, 'comic-panels'),
  ...withHelpGroup({ 'image-model': comicImageFlags['image-model'] }, 'comic-image'),
  ...withHelpGroup(generateImagesVariationFlag, 'comic-image'),
  ...withHelpGroup({ size: comicImageFlags.size, quality: comicImageFlags.quality }, 'comic-image'),
  ...withHelpGroup(comicQaFlags, 'comic-qa'),
  ...withHelpGroup(generateImagesLlmFlag, 'comic-stages'),
  ...withHelpGroup(generateImagesForceFlag, 'comic-run'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
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
