import { SETUP_STEP_IDS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { formatValueList } from './flag-utils'

export const setupFlags = {
  doctor: {
    description: 'Check prerequisites, API keys, and configuration without installing anything',
    type: Boolean,
    default: false,
    negatable: false
  },
  models: {
    description: 'Download one or more local models without running inference (repeatable). Accepts Whisper or llama.cpp model names, plus prefixed selectors whisperfile:<model> and llamafile:<model> (and optional whisper:/llama: prefixes).',
    type: [String] as [StringConstructor]
  },
  step: {
    description: `Run only a specific setup step: ${formatValueList(SETUP_STEP_IDS)} (default: all). Assumes prerequisites are already installed for isolated steps.`,
    type: String,
    default: 'all'
  },
  'force-redownload': {
    description: 'Remove existing artifacts before downloading',
    type: Boolean,
    default: false,
    negatable: false
  },
  repeat: {
    description: 'Repeat the setup step N times for benchmarking (default: 1)',
    type: String,
    default: '1'
  }
} as const satisfies CliFlagsDefinition
