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
  llm: { ...strListFlag('Compatibility alias for --provider; accepts the same repeatable provider[=model] values; cannot combine with --provider'), help: { hidden: true } },
  ...booleanAllProvidersFlag,
  ...pickFlags(sharedConcurrencyFlags, ['concurrency-mode', 'provider-concurrency'])
} as const satisfies CliFlagsDefinition

const writeTextInputFlags = {
  'prompt-file': strFlag('Prepend instructions from a local text file before named presets; project text/ inputs use the adjacent project prompt.md when present'),
  'rendered-text': {
    description: 'Also save text.md containing rendered text alongside the standard text.json and show-note.md outputs',
    type: Boolean,
    default: false,
    negatable: false
  },
  'rendered-out-dir': strFlag('Also write rendered Markdown using source-based filenames; project text/ inputs use the adjacent lyrics/ directory when prompt.md is present'),
  'track-list': strFlag('Optional tracks.md used for track-number headers; project text/ inputs use the adjacent project tracks.md when present')
} as const satisfies CliFlagsDefinition

export const writeFlags = {
  ...withHelpGroup({ ...priceFlag, ...modelCostFilterFlag }, 'pricing'),
  ...withHelpGroup(writeProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(reasoningEffortFlag, 'provider-selection'),
  ...withHelpGroup(pickFlags(batchFlags, ['batch-limit', 'batch-order', 'batch-concurrency']), 'batch-processing'),
  ...withHelpGroup(promptFlag, 'writing'),
  ...withHelpGroup(writeTextInputFlags, 'writing')
} as const satisfies CliFlagsDefinition
