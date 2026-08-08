import { withHelpGroup } from './flag-utils'
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

// Help metadata for the comic subcommands. The hand-rolled parsers in
// comic-utils/cli-args.ts remain the source of truth for parsing; a contract test
// keeps every flag documented here accepted by those parsers.

const comicPriceFlag = {
  price: {
    description: colorizeHelpDescription('Dry run: estimate API cost without making any calls'),
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const comicConcurrencyFlag = {
  concurrency: {
    description: colorizeHelpDescription(`Number of image/prompt tasks to run in parallel (default: ${DEFAULT_CLI_CONCURRENCY})`),
    type: String
  }
} as const satisfies CliFlagsDefinition

const comicImageFlags = {
  'image-model': {
    description: colorizeHelpDescription(`Image model ID from the central image registry (default: ${DEFAULT_IMAGE_MODEL})`),
    type: String
  },
  size: {
    description: colorizeHelpDescription(`Image size: ${IMAGE_SIZE_HELP}`),
    type: String
  },
  quality: {
    description: colorizeHelpDescription(`Image quality: ${IMAGE_GENERATION_QUALITIES.join('|')}`),
    type: String
  }
} as const satisfies CliFlagsDefinition

const comicQaFlags = {
  qa: {
    description: colorizeHelpDescription('Enable or disable final-image QA (default: enabled)'),
    type: Boolean,
    negatable: true
  },
  'qa-model': {
    description: colorizeHelpDescription(`Vision judge model: an OpenAI vision-capable LLM (default: ${DEFAULT_QA_MODEL})`),
    type: String
  },
  'max-repairs': {
    description: colorizeHelpDescription('Maximum repair attempts after the initial image; stagnation may restart once or stop early (default: 2)'),
    type: String
  }
} as const satisfies CliFlagsDefinition

const draftScenesStageFlags = {
  only: {
    description: colorizeHelpDescription('Run one stage: structure|prompt|scene|panel-prompts'),
    type: String
  },
  'llm-model': {
    description: colorizeHelpDescription(`Text model for scene drafting (default: ${DEFAULT_LLM_MODEL})`),
    type: String
  }
} as const satisfies CliFlagsDefinition

export const draftScenesFlags = {
  ...withHelpGroup(draftScenesStageFlags, 'comic-stages'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const generateImagesPanelFlags = {
  target: {
    description: colorizeHelpDescription('What to generate: images|sketches|both (default: images)'),
    type: String
  },
  panels: {
    description: colorizeHelpDescription('Panels to process: all, 1-8, 1,3,7, or 1-4,9; overlong ranges clamp (default: all)'),
    type: String
  },
  'panels-per-image': {
    description: colorizeHelpDescription(`Panels drawn per generated image; overrides both stages (final default: ${DEFAULT_FINAL_PANELS_PER_IMAGE}; sketch default: ${DEFAULT_SKETCH_PANELS_PER_IMAGE})`),
    type: String
  },
  grid: {
    description: colorizeHelpDescription(`Compose individual final panels into local page grids as <columns>x<rows>; requires --panels-per-image 1 and --size ${COMIC_GRID_PANEL_SIZE}`),
    type: String
  }
} as const satisfies CliFlagsDefinition

const generateImagesVariationFlag = {
  variation: {
    description: colorizeHelpDescription(`Final-image prompt variations as name[,name...]: ${IMAGE_PROMPT_VARIATIONS.join('|')}`),
    type: String
  }
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
  'llm-model': {
    description: colorizeHelpDescription(`Text model used when scene drafts or panel prompts must be rebuilt (default: ${DEFAULT_LLM_MODEL})`),
    type: String
  }
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
  character: {
    description: colorizeHelpDescription('Catalog character key (mutually exclusive with --location)'),
    type: String
  },
  location: {
    description: colorizeHelpDescription('Canonical location key (mutually exclusive with --character)'),
    type: String
  },
  view: {
    description: colorizeHelpDescription('Location camera view: establishing|reverse|side (default: establishing)'),
    type: String
  },
  revise: {
    description: colorizeHelpDescription('Revision mode; requires --notes'),
    type: Boolean,
    short: 'r',
    default: false,
    negatable: false
  },
  notes: {
    description: colorizeHelpDescription('Revision instructions (requires --revise)'),
    type: String
  },
  'llm-model': {
    description: colorizeHelpDescription(`Text model used to draft the sheet prompt (default: ${DEFAULT_LLM_MODEL})`),
    type: String
  }
} as const satisfies CliFlagsDefinition

export const referenceSketchFlags = {
  ...withHelpGroup(referenceSketchSheetFlags, 'comic-reference'),
  ...withHelpGroup(comicImageFlags, 'comic-image'),
  ...withHelpGroup(comicQaFlags, 'comic-qa'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
