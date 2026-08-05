import type { SttServiceSpec, TranscribeEngine } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { commandExists } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
const SERVICE_DEFINITIONS: {
  service: TranscribeEngine
  models: readonly string[]
  envVar: string | undefined
  checkAvailable?: () => boolean
}[] = [
  { service: 'whisper', models: ['tiny', 'base', 'small', 'medium', 'large-v3-turbo'], envVar: undefined },
  { service: 'deepgram', models: ['nova-3'], envVar: 'DEEPGRAM_API_KEY' },
  { service: 'groq', models: ['whisper-large-v3-turbo', 'whisper-large-v3'], envVar: 'GROQ_API_KEY' },
  { service: 'grok', models: ['speech-to-text'], envVar: 'XAI_API_KEY' },
  { service: 'deepinfra', models: ['openai/whisper-large-v3-turbo', 'openai/whisper-large-v3'], envVar: 'DEEPINFRA_API_KEY' },
  { service: 'gemini-stt', models: ['gemini-3.6-flash'], envVar: 'GEMINI_API_KEY' },
  { service: 'together', models: ['openai/whisper-large-v3', 'nvidia/parakeet-tdt-0.6b-v3'], envVar: 'TOGETHER_API_KEY' },
  { service: 'mistral', models: ['voxtral-mini-2602'], envVar: 'MISTRAL_API_KEY' },
  { service: 'assemblyai', models: ['universal-3-5-pro', 'universal-2'], envVar: 'ASSEMBLYAI_API_KEY' },
  { service: 'soniox', models: ['stt-async-v5'], envVar: 'SONIOX_API_KEY' },
  { service: 'speechmatics', models: ['enhanced', 'melia-1'], envVar: 'SPEECHMATICS_API_KEY' },
  { service: 'rev', models: ['machine', 'low_cost'], envVar: 'REVAI_ACCESS_TOKEN' },
  { service: 'gladia', models: ['solaria-1', 'solaria-3'], envVar: 'GLADIA_API_KEY' },
  { service: 'happyscribe', models: ['auto'], envVar: 'HAPPYSCRIBE_API_KEY' },
]

const isServiceAvailable = (def: typeof SERVICE_DEFINITIONS[number]): boolean => {
  if (def.checkAvailable) return def.checkAvailable()
  if (def.envVar) return readEnv(def.envVar) !== undefined
  if (def.service === 'whisper') return commandExists('whisper-cpp')
  return true
}

export const resolveAvailableServices = (
  serviceFilter?: string | undefined
): SttServiceSpec[] => {
  const filterSet = serviceFilter
    ? new Set(serviceFilter.split(',').map(s => s.trim().toLowerCase()))
    : undefined

  const specs: SttServiceSpec[] = []

  for (const def of SERVICE_DEFINITIONS) {
    if (filterSet && !filterSet.has(def.service)) continue
    if (!isServiceAvailable(def)) {
      l.write('info', `  Skipping ${def.service} (not available)`)
      continue
    }

    for (const model of def.models) {
      specs.push({ service: def.service, model, envVar: def.envVar })
    }
  }

  return specs
}

export const parseReferenceStt = (flag: string): { service: TranscribeEngine, model: string } => {
  const [service, model] = flag.split(':')
  if (!service || !model) {
    throw CLIUsageError(`Invalid --reference-stt format: "${flag}". Expected "service:model" (e.g., "deepgram:nova-3")`)
  }

  const serviceDefinition = SERVICE_DEFINITIONS.find((definition) => definition.service === service.toLowerCase())
  if (!serviceDefinition) {
    throw CLIUsageError(`Unsupported --reference-stt service: ${service}. Supported services: ${SERVICE_DEFINITIONS.map((definition) => definition.service).join(', ')}`)
  }

  return { service: serviceDefinition.service, model }
}
