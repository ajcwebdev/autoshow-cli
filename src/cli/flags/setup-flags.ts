import { SETUP_STEP_IDS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { boolFlag, formatValueList, strFlag, strListFlag } from './flag-utils'

export const setupFlags = {
  doctor: boolFlag('Check prerequisites, API keys, and configuration without installing anything'),
  models: strListFlag('Download one or more local models without running inference (repeatable). Accepts Whisper or whisperfile model names, plus prefixed selectors whisper:<model> and whisperfile:<model>.'),
  step: strFlag(`Run only a specific setup step: ${formatValueList(SETUP_STEP_IDS)}. Assumes prerequisites are already installed for isolated steps.`, 'all'),
  'force-redownload': boolFlag('Remove existing artifacts before downloading')
} as const satisfies CliFlagsDefinition
