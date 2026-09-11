import {
  batchFlags,
  booleanAllProvidersFlag,
  modelCostFilterFlag,
  priceFlag,
  promptFlag,
  reasoningEffortFlag,
  sharedConcurrencyFlags
} from './shared-flags'
import { formatProviderList, pickFlags, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { WRITE_LLM_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import type { CliFlagsDefinition } from '~/types'

const writeProviderSelectionFlags = {
  provider: strListFlag(`LLM provider[=model]: ${formatProviderList(WRITE_LLM_PROVIDER_TARGETS)} (default: cheapest hosted); repeatable; cannot combine with --llm`),
  llm: strListFlag('Compatibility alias for --provider; accepts the same repeatable provider[=model] values; cannot combine with --provider'),
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

const writeTextInputFlags = {
  'prompt-file': strFlag('Prepend prompt instructions from a local text file before named prompt presets'),
  'rendered-text': {
    description: 'Save rendered step-3 markdown output alongside JSON output',
    type: Boolean,
    default: false,
    negatable: false
  },
  'rendered-out-dir': strFlag('Also write rendered step-3 markdown files to this directory using source-based filenames'),
  'track-list': strFlag('Optional tracks.md file used to prepend track-number headers on saved rendered text')
} as const satisfies CliFlagsDefinition

export const writeFlags = {
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing'),
  ...withHelpGroup(writeProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(reasoningEffortFlag, 'provider-selection'),
  ...withHelpGroup(pickFlags(batchFlags, ['batch-limit', 'batch-order', 'batch-concurrency']), 'batch-processing'),
  ...withHelpGroup(promptFlag, 'writing'),
  ...withHelpGroup(writeTextInputFlags, 'writing')
} as const satisfies CliFlagsDefinition
