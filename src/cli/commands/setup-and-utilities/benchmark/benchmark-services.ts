import { existsSync } from 'node:fs'
import type { BenchmarkServiceResolutionOptions, SttServiceSpec, TranscribeEngine } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { whisperBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'
const SERVICE_DEFINITIONS: {
  service: TranscribeEngine
  models: readonly string[]
  envVar: string | undefined
}[] = [
  // One model per service by default. Every extra whisper size is another model download (78 MB
  // for tiny up to 1.6 GB for large-v3-turbo) plus another full pass over every variant, so the
  // other sizes are opt-in through `--stt-services whisper:<model>` rather than benchmarked here.
  { service: 'whisper', models: ['base'], envVar: undefined },
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

const isServiceAvailable = (
  def: typeof SERVICE_DEFINITIONS[number],
  exists: (path: string) => boolean
): boolean => {
  if (def.envVar) return readEnv(def.envVar) !== undefined
  // Whisper is the managed `runtime/bin/whisper-cli` build, invoked by absolute path and never
  // placed on PATH, so availability is a file check on that binary rather than a command lookup.
  if (def.service === 'whisper') return exists(whisperBinaryPath)
  return true
}

const describeUnavailableService = (def: typeof SERVICE_DEFINITIONS[number]): string =>
  def.service === 'whisper'
    ? '  Skipping whisper (runtime/bin/whisper-cli not installed; run `bun autoshow setup --step whisper-binary`)'
    : `  Skipping ${def.service} (not available)`

// `--stt-services` accepts a bare service name or a `service:model` pair, matching
// `--reference-stt`. A service named without a model benchmarks its default models; naming it with
// models replaces that default, and repeating the service adds models to the same run.
const parseServiceSelections = (serviceFilter: string): Map<string, string[]> => {
  const selections = new Map<string, string[]>()

  for (const entry of serviceFilter.split(',')) {
    const [rawService, ...rawModel] = entry.trim().split(':')
    const service = rawService?.trim().toLowerCase()
    if (!service) continue

    const model = rawModel.join(':').trim()
    const models = selections.get(service) ?? []
    if (model) models.push(model)
    selections.set(service, models)
  }

  return selections
}

export const resolveAvailableServices = (
  serviceFilter?: string | undefined,
  options: BenchmarkServiceResolutionOptions = {}
): SttServiceSpec[] => {
  const exists = options.exists ?? existsSync
  const selections = serviceFilter ? parseServiceSelections(serviceFilter) : undefined

  const specs: SttServiceSpec[] = []

  for (const def of SERVICE_DEFINITIONS) {
    const selectedModels = selections?.get(def.service)
    if (selections && !selectedModels) continue
    if (!isServiceAvailable(def, exists)) {
      l.write('info', describeUnavailableService(def))
      continue
    }

    for (const model of selectedModels?.length ? selectedModels : def.models) {
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
