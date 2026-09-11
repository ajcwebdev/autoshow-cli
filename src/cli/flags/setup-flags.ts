import { SETUP_STEP_IDS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { boolFlag, formatValueList, strFlag, strListFlag } from './flag-utils'

export const setupFlags = {
  'network-check': strFlag('Local-only network diagnostic: serve|probe (no installation or providers)'),
  'delay-seconds': strFlag('Network fixture silent delay / probe deadline basis, 1–600 seconds (default 150)'),
  port: strFlag('Network fixture listen port (default 8787)'),
  'probe-url': strFlag('Local fixture origin, e.g. http://host.docker.internal:8787'),
  'probe-client': strFlag('Network probe client: rest|fetch|fetch-no-keepalive (default rest)'),
  doctor: boolFlag('Check prerequisites, configuration, and which provider API keys are set (presence only) without installing anything'),
  strict: boolFlag('With --doctor, exit 2 when configured defaults require missing provider credentials'),
  models: strListFlag('Download one or more local models without running inference (repeatable). Accepts bare whisperfile model names or whisperfile:<model>.'),
  step: strFlag(`Run only a specific setup step: ${formatValueList(SETUP_STEP_IDS)}. Assumes prerequisites are already installed for isolated steps.`, 'all'),
  'force-redownload': boolFlag('Remove existing artifacts before downloading')
} as const satisfies CliFlagsDefinition
