import {
  booleanAllLocalFlag,
  batchFlags,
  booleanAllProvidersFlag,
  articleTuningFlags,
  ocrInputFlags,
  ocrProviderModeFlag,
  ocrTuningFlags,
  primaryOcrFlag,
  priceFlag,
  reasoningEffortFlag,
  sharedConcurrencyFlags,
  transcriptionFlags
} from './shared-flags'
import { formatProviderList, strListFlag, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from './service-selector-normalization/extract-selectors'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

const extractProviderSelectionFlags = {
  provider: strListFlag(`STT/OCR: ${formatProviderList(EXTRACT_PUBLIC_SELECTOR_FLAGS)} (defaults: whisper=tiny or tesseract)\nURL: ${URL_ARTICLE_BACKENDS.join('|')} (default: defuddle)\nrepeatable as provider[=model]`),
  ...booleanAllProvidersFlag,
  ...booleanAllLocalFlag,
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

const extractDocumentFlags = {
  ...ocrInputFlags,
  ...ocrTuningFlags,
  ...ocrProviderModeFlag,
  ...primaryOcrFlag
} as const satisfies CliFlagsDefinition

export const extractStep2CommandFlags = {
  ...withHelpGroup(extractProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(transcriptionFlags, 'transcription'),
  ...withHelpGroup(extractDocumentFlags, 'ocr-document'),
  ...withHelpGroup(reasoningEffortFlag, 'ocr-document'),
  ...withHelpGroup(articleTuningFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
