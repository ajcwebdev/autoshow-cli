import { withHelpGroup } from './flag-utils'
import {
  transcriptionFlags,
  ocrInputFlags,
  ocrProviderModeFlag,
  ocrTuningFlags,
  primaryOcrFlag,
  allArticleFlags,
  sharedConcurrencyFlags,
  stepProviderSelectorFlags,
  writeAllLocalFlag,
  writeAllProvidersFlag,
  batchFlags,
  promptFlag,
  priceFlag,
  reasoningEffortFlag
} from './shared-flags'
import type { CliFlagsDefinition } from '~/types'

const writeTextInputFlags = {
  'text-input': {
    description: 'Treat local .md/.txt files and directories as raw source text instead of URL lists',
    type: Boolean,
    default: false,
    negatable: false
  },
  'prompt-file': {
    description: 'Prepend prompt instructions from a local text file before named prompt presets',
    type: String
  },
  'rendered-text': {
    description: 'Save rendered step-3 markdown output alongside JSON output',
    type: Boolean,
    default: false,
    negatable: false
  },
  'rendered-out-dir': {
    description: 'Also write rendered step-3 markdown files to this directory using source-based filenames',
    type: String
  },
  'track-list': {
    description: 'Optional tracks.md file used to prepend track-number headers on saved rendered text',
    type: String
  }
} as const satisfies CliFlagsDefinition

const writePipelineFlags = {
  ...sharedConcurrencyFlags,
  ...stepProviderSelectorFlags,
  ...writeAllProvidersFlag,
  ...writeAllLocalFlag
} as const satisfies CliFlagsDefinition

export const writeFlags = {
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(writePipelineFlags, 'pipeline'),
  ...withHelpGroup(reasoningEffortFlag, 'pipeline'),
  ...withHelpGroup(batchFlags, 'batch-download'),
  ...withHelpGroup(transcriptionFlags, 'transcription'),
  ...withHelpGroup(ocrInputFlags, 'ocr-document'),
  ...withHelpGroup(ocrTuningFlags, 'ocr-document'),
  ...withHelpGroup({ ...ocrProviderModeFlag, ...primaryOcrFlag }, 'ocr-document'),
  ...withHelpGroup(allArticleFlags, 'article-extraction'),
  ...withHelpGroup(promptFlag, 'writing'),
  ...withHelpGroup(writeTextInputFlags, 'writing')
} as const satisfies CliFlagsDefinition
