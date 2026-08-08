import {
  allArticleFlags,
  booleanAllLocalFlag,
  batchFlags,
  booleanAllProvidersFlag,
  ocrInputFlags,
  ocrTuningFlags,
  priceFlag,
  sharedConcurrencyFlags,
  transcriptionFlags
} from './shared-flags'
import { epubInspectFlags } from './ocr-flags'
import { formatProviderList, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from './service-selector-normalization/extract-selectors'
import { WRITE_OCR_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
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
  'primary-ocr': strFlag(`In multi-provider OCR, write top-level extraction artifacts from one requested provider: ${formatProviderList(WRITE_OCR_PROVIDER_TARGETS)} (as service or service/model)`)
} as const satisfies CliFlagsDefinition

export const extractStep2CommandFlags = {
  ...withHelpGroup(extractProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(transcriptionFlags, 'transcription'),
  ...withHelpGroup(extractDocumentFlags, 'ocr-document'),
  ...withHelpGroup(allArticleFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
  ...withHelpGroup(epubInspectFlags, 'epub-inspect'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies CliFlagsDefinition
