import { existsSync } from 'node:fs'
import type { BenchmarkServiceResolutionOptions, SttServiceSpec, TranscribeEngine } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { getStep2ProviderEntries } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry/entries'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { findHostedProviderEnvKeyForConfigPath } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { whisperBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import * as l from '~/utils/app-logger/app-logger'

type BenchmarkServiceDefinition = {
  service: TranscribeEngine
  models: readonly string[]
  envVar: string | undefined
}

// Every TranscribeEngine must make an explicit benchmark-support decision. The registry does not
// contain reverb, so deriving this policy from registry keys alone would leave that engine outside
// the drift guard. Undefined means included; a string records why the engine is deliberately out.
const BENCHMARK_STT_EXCLUSION_REASON = {
  reverb: 'Reverb uses its own local model pipeline rather than the benchmark service matrix.',
  deepgram: undefined,
  deepinfra: undefined,
  soniox: undefined,
  speechmatics: undefined,
  rev: undefined,
  groq: undefined,
  grok: undefined,
  mistral: undefined,
  assemblyai: undefined,
  gladia: undefined,
  happyscribe: undefined,
  supadata: 'Supadata retrieves hosted URL transcripts rather than transcribing benchmark audio variants.',
  scrapecreators: 'ScrapeCreators retrieves YouTube transcripts rather than transcribing benchmark audio variants.',
  'gemini-stt': undefined,
  together: undefined,
  whisper: undefined,
  whisperfile: 'Whisperfile bundles are opt-in local executables and are not managed by this benchmark.',
  'youtube-captions': 'YouTube captions are a URL transcript source rather than an audio transcription engine.'
} as const satisfies Record<TranscribeEngine, string | undefined>

export const BENCHMARK_EXCLUDED_STT_SERVICES: ReadonlySet<TranscribeEngine> = new Set(
  (Object.entries(BENCHMARK_STT_EXCLUSION_REASON) as Array<[TranscribeEngine, string | undefined]>)
    .filter((entry): entry is [TranscribeEngine, string] => entry[1] !== undefined)
    .map(([service]) => service)
)

const configPathByService = new Map<TranscribeEngine, string>(
  getStep2ProviderEntries('stt').map((entry) => [
    entry.targetService as TranscribeEngine,
    entry.configPath.join('.')
  ])
)

const buildServiceDefinitions = (): BenchmarkServiceDefinition[] => {
  const definitions: BenchmarkServiceDefinition[] = []
  const registry = getModelRegistry().stt

  for (const [rawService, config] of Object.entries(registry)) {
    if (!Object.hasOwn(BENCHMARK_STT_EXCLUSION_REASON, rawService)) {
      throw InternalError(`STT registry service "${rawService}" has no benchmark inclusion or exclusion policy.`, { stage: 'benchmark:services' })
    }

    const service = rawService as TranscribeEngine
    if (BENCHMARK_EXCLUDED_STT_SERVICES.has(service)) continue

    const configPath = configPathByService.get(service)
    const envVar = configPath ? findHostedProviderEnvKeyForConfigPath(configPath) : undefined
    if (config.type === 'api' && envVar === undefined) {
      throw InternalError(`STT benchmark service "${service}" has no derived credential mapping.`, { stage: 'benchmark:services' })
    }

    definitions.push({
      service,
      // One model per local whisper benchmark by default. Every extra size is another download
      // plus another full pass, so larger models stay opt-in through `whisper:<model>`.
      models: service === 'whisper' ? ['base'] : Object.keys(config.models),
      envVar
    })
  }

  const registryServices = new Set(Object.keys(registry))
  const missingIncludedServices = (Object.entries(BENCHMARK_STT_EXCLUSION_REASON) as Array<[TranscribeEngine, string | undefined]>)
    .filter(([service, reason]) => reason === undefined && !registryServices.has(service))
    .map(([service]) => service)
  if (missingIncludedServices.length > 0) {
    throw InternalError(`Included STT benchmark services are missing from the model registry: ${missingIncludedServices.join(', ')}`, { stage: 'benchmark:services' })
  }

  return definitions
}

export const BENCHMARK_STT_SERVICE_DEFINITIONS: readonly BenchmarkServiceDefinition[] = buildServiceDefinitions()

const serviceDefinitionByName = new Map(
  BENCHMARK_STT_SERVICE_DEFINITIONS.map((definition) => [definition.service, definition])
)

const unsupportedServiceError = (
  flagName: '--stt-services' | '--reference-stt',
  service: string
): ReturnType<typeof CLIUsageError> => CLIUsageError(
  `Unsupported ${flagName} service: ${service}. Supported services: ${BENCHMARK_STT_SERVICE_DEFINITIONS.map((definition) => definition.service).join(', ')}`
)

const isServiceAvailable = (
  def: BenchmarkServiceDefinition,
  exists: (path: string) => boolean,
  readEnvironment: (key: string) => string | undefined
): boolean => {
  if (def.envVar) return readEnvironment(def.envVar) !== undefined
  // Whisper is the managed `runtime/bin/whisper-cli` build, invoked by absolute path and never
  // placed on PATH, so availability is a file check on that binary rather than a command lookup.
  if (def.service === 'whisper') return exists(whisperBinaryPath)
  return true
}

const describeUnavailableService = (def: BenchmarkServiceDefinition): string =>
  def.service === 'whisper'
    ? '  Skipping whisper (runtime/bin/whisper-cli not installed; run `bun autoshow setup --step whisper-binary`)'
    : `  Skipping ${def.service} (not available)`

// `--stt-services` accepts a bare service name or a `service:model` pair, matching
// `--reference-stt`. A service named without a model benchmarks its default models; naming it with
// models replaces that default, and repeating the service adds models to the same run.
const parseServiceSelections = (serviceFilter: string): Map<TranscribeEngine, string[]> => {
  const selections = new Map<TranscribeEngine, string[]>()

  for (const entry of serviceFilter.split(',')) {
    const [rawService, ...rawModel] = entry.trim().split(':')
    const normalizedService = rawService?.trim().toLowerCase()
    if (!normalizedService) continue

    const definition = serviceDefinitionByName.get(normalizedService as TranscribeEngine)
    if (!definition) throw unsupportedServiceError('--stt-services', normalizedService)
    const service = definition.service

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
  const readEnvironment = options.readEnv ?? readEnv
  const selections = serviceFilter ? parseServiceSelections(serviceFilter) : undefined

  const specs: SttServiceSpec[] = []

  for (const def of BENCHMARK_STT_SERVICE_DEFINITIONS) {
    const selectedModels = selections?.get(def.service)
    if (selections && !selectedModels) continue
    if (!isServiceAvailable(def, exists, readEnvironment)) {
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

  const serviceDefinition = serviceDefinitionByName.get(service.toLowerCase() as TranscribeEngine)
  if (!serviceDefinition) {
    throw unsupportedServiceError('--reference-stt', service)
  }

  return { service: serviceDefinition.service, model }
}
