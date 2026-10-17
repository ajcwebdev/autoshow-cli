import { SETUP_STEP_IDS } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { boolFlag, formatValueList, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { configCommandFlags } from './config-flags'
import { DEFAULT_NETWORK_FIXTURE_DELAY_SECONDS, DEFAULT_NETWORK_FIXTURE_PORT, DEFAULT_NETWORK_PROBE_CLIENT, NETWORK_PROBE_CLIENTS } from './setup-network-contract'
import { SUPPORTED_WHISPERFILE_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'

const setupOptionFlags = {
  'network-check': strFlag('Local-only network diagnostic: serve|probe (no installation or providers)'),
  'delay-seconds': strFlag('Network fixture silent delay / probe deadline basis, 1–600 seconds', String(DEFAULT_NETWORK_FIXTURE_DELAY_SECONDS)),
  port: strFlag('Network fixture listen port, integer 1–65535 (serve mode)', String(DEFAULT_NETWORK_FIXTURE_PORT)),
  'probe-url': strFlag('Required with --network-check probe: HTTP origin on localhost, 127.0.0.1, [::1], or host.docker.internal, e.g. http://host.docker.internal:8787'),
  'probe-client': strFlag(`Client used with --network-check probe: ${formatValueList(NETWORK_PROBE_CLIENTS)}`, DEFAULT_NETWORK_PROBE_CLIENT),
  doctor: boolFlag('Check prerequisites, configuration, and which provider API keys are set (presence only) without installing anything'),
  strict: boolFlag('With --doctor, exit 2 when configured defaults require missing provider credentials'),
  models: strListFlag(`Download local models without inference; repeatable as <model> or whisperfile:<model>. Available models: ${formatValueList(SUPPORTED_WHISPERFILE_MODELS)}`),
  step: strFlag(`Run only a specific setup step: ${formatValueList(SETUP_STEP_IDS)}. Assumes prerequisites are already installed for isolated steps.`, 'all'),
  'force-redownload': boolFlag('Remove existing artifacts before downloading')
} as const satisfies CliFlagsDefinition

export const setupFlags = {
  ...withHelpGroup(Object.fromEntries(['models', 'step', 'force-redownload'].map(name => [name, setupOptionFlags[name as keyof typeof setupOptionFlags]])), 'setup-installation'),
  ...withHelpGroup(Object.fromEntries(['doctor', 'strict'].map(name => [name, setupOptionFlags[name as keyof typeof setupOptionFlags]])), 'setup-diagnostics'),
  ...withHelpGroup(Object.fromEntries(['network-check', 'delay-seconds', 'port', 'probe-url', 'probe-client'].map(name => [name, setupOptionFlags[name as keyof typeof setupOptionFlags]])), 'setup-network'),
  ...configCommandFlags
} satisfies CliFlagsDefinition
