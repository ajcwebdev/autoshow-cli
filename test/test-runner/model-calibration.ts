import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MODEL_CONFIG_FRAGMENT_PREFIXES, MODEL_CONFIG_PATHS } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type {
  CalibrationConfigPaths,
  CalibrationGroupRates,
  CalibrationKind,
  CalibrationRecommendation,
  CalibrationReport,
  CalibrationScan,
  CalibrationStepObservation,
  CalibrationStepShape,
  JsonObject
} from '~/types'
import { getFiniteNumber, readString } from './utils'
import { isRecord } from '~/utils/value-helpers'

const COST_DRIFT_THRESHOLD = 0.1
const TIME_DRIFT_THRESHOLD = 0.1
const SMOOTHING_FACTOR = 0.35
const MAX_CHANGE_FACTOR = 0.5

const buildStepKey = (step: Pick<CalibrationStepShape, 'kind' | 'service' | 'model'>): string => {
  return `${step.kind}::${step.service}::${step.model}`
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null
  }
  const left = sorted[middle - 1]
  const right = sorted[middle]
  if (left === undefined || right === undefined) return null
  return (left + right) / 2
}

const clampChange = (current: number, next: number): number => {
  const min = current * (1 - MAX_CHANGE_FACTOR)
  const max = current * (1 + MAX_CHANGE_FACTOR)
  return Math.min(max, Math.max(min, next))
}

const smoothValue = (current: number | null, observed: number): number => {
  if (current === null || !Number.isFinite(current) || current <= 0) {
    return observed
  }
  return clampChange(current, current + ((observed - current) * SMOOTHING_FACTOR))
}

const roundCostMultiplier = (value: number): number => Math.round(value * 10_000) / 10_000
const roundTimeValue = (value: number): number => Math.max(1, Math.round(value))

const normalizeStepShape = (
  kind: string,
  service: string,
  model: string
): CalibrationStepShape | null => {
  const normalizedKind = kind === 'extract' || kind === 'stt' || kind === 'llm' || kind === 'tts' || kind === 'image' || kind === 'video' || kind === 'music'
    ? kind
    : null
  if (!normalizedKind || service.length === 0 || model.length === 0) {
    return null
  }

  return {
    kind: normalizedKind,
    service,
    model,
  }
}

const normalizeUnitValue = (
  kind: CalibrationKind,
  metric: string | null,
  value: number | null
): number | null => {
  if (value === null || value <= 0) return null

  switch (kind) {
    case 'stt':
    case 'video':
    case 'music':
      if (metric === 'durationMs') return value / 1000
      if (metric === 'durationSeconds') return value
      return null
    case 'extract':
      return metric === 'pages' ? value : null
    case 'llm':
      return metric === 'tokens' ? value : null
    case 'tts':
      return metric === 'characters' ? value : null
    case 'image':
      return metric === 'images' ? value : null
  }
}

const computeObservedTimeRate = (kind: CalibrationKind, actualProcessingTimeMs: number, unitValue: number): number | null => {
  if (!Number.isFinite(actualProcessingTimeMs) || actualProcessingTimeMs <= 0 || !Number.isFinite(unitValue) || unitValue <= 0) {
    return null
  }

  switch (kind) {
    case 'llm':
    case 'tts':
      return (actualProcessingTimeMs / unitValue) * 1000
    case 'stt':
    case 'extract':
    case 'image':
    case 'video':
    case 'music':
      return actualProcessingTimeMs / unitValue
  }
}

const getTimeFieldName = (kind: CalibrationKind): string => {
  switch (kind) {
    case 'llm':
      return 'msPer1KTokens'
    case 'tts':
      return 'msPer1KChars'
    case 'image':
      return 'msPerImage'
    case 'stt':
    case 'video':
    case 'music':
      return 'msPerSecond'
    case 'extract':
      return 'msPerPage'
  }
}

const getActualCostSteps = (metadata: Record<string, unknown>): Map<string, { cost: number, unitValue: number | null }> => {
  const cost = metadata['cost']
  if (!isRecord(cost)) return new Map()
  const actual = cost['actual']
  if (!isRecord(actual)) return new Map()
  const steps = Array.isArray(actual['steps']) ? actual['steps'] : []
  const out = new Map<string, { cost: number, unitValue: number | null }>()

  for (const rawStep of steps) {
    if (!isRecord(rawStep)) continue
    const kind = readString(rawStep, 'step') ?? ''
    const service = readString(rawStep, 'provider') ?? ''
    const model = readString(rawStep, 'model') ?? ''
    const normalized = normalizeStepShape(kind, service, model)
    const costValue = getFiniteNumber(rawStep['cost'])
    if (!normalized || costValue === null) continue

    const metric = readString(rawStep, 'inputMetric')
    const inputValue = normalizeUnitValue(normalized.kind, metric, getFiniteNumber(rawStep['inputValue']))
    out.set(buildStepKey(normalized), { cost: costValue, unitValue: inputValue })
  }

  return out
}

const getEstimatedCostSteps = (metadata: Record<string, unknown>): Map<string, { cost: number, rawCost: number }> => {
  const cost = metadata['cost']
  if (!isRecord(cost)) return new Map()
  const estimated = cost['estimated']
  if (!isRecord(estimated)) return new Map()
  const steps = Array.isArray(estimated['steps']) ? estimated['steps'] : []
  const out = new Map<string, { cost: number, rawCost: number }>()

  for (const rawStep of steps) {
    if (!isRecord(rawStep)) continue
    const kind = readString(rawStep, 'step') ?? ''
    const service = readString(rawStep, 'provider') ?? ''
    const model = readString(rawStep, 'model') ?? ''
    const normalized = normalizeStepShape(kind, service, model)
    const costValue = getFiniteNumber(rawStep['cost'])
    if (!normalized || costValue === null) continue

    const multiplier = getFiniteNumber(rawStep['costMultiplier']) ?? 1
    const rawCost = multiplier > 0 ? costValue / multiplier : costValue
    out.set(buildStepKey(normalized), { cost: costValue, rawCost })
  }

  return out
}

const getTimingActualSteps = (metadata: Record<string, unknown>): Map<string, { processingTimeMs: number, msPerUnit: number | null, unitValue: number | null }> => {
  const timing = metadata['timing']
  if (!isRecord(timing)) return new Map()
  const actual = timing['actual']
  if (!isRecord(actual)) return new Map()
  const steps = Array.isArray(actual['steps']) ? actual['steps'] : []
  const out = new Map<string, { processingTimeMs: number, msPerUnit: number | null, unitValue: number | null }>()

  for (const rawStep of steps) {
    if (!isRecord(rawStep)) continue
    const timingScope = readString(rawStep, 'timingScope')
    if (timingScope !== null && timingScope !== 'wall') continue
    const kind = readString(rawStep, 'step') ?? ''
    const service = readString(rawStep, 'provider') ?? ''
    const model = readString(rawStep, 'model') ?? ''
    const normalized = normalizeStepShape(kind, service, model)
    const processingTimeMs = getFiniteNumber(rawStep['processingTimeMs'])
    if (!normalized || processingTimeMs === null) continue

    const metric = readString(rawStep, 'inputMetric')
    const inputValue = normalizeUnitValue(normalized.kind, metric, getFiniteNumber(rawStep['inputValue']))
    out.set(buildStepKey(normalized), {
      processingTimeMs,
      msPerUnit: getFiniteNumber(rawStep['msPerUnit']),
      unitValue: inputValue
    })
  }

  return out
}
const collectObservationsFromMetadata = (metadata: Record<string, unknown>): CalibrationStepObservation[] => {
  const estimatedCostSteps = getEstimatedCostSteps(metadata)
  const actualCostSteps = getActualCostSteps(metadata)
  const timingSteps = getTimingActualSteps(metadata)
  const keys = new Set<string>([
    ...estimatedCostSteps.keys(),
    ...actualCostSteps.keys(),
    ...timingSteps.keys(),
  ])

  const out: CalibrationStepObservation[] = []

  for (const key of keys) {
    const [kind, service, model] = key.split('::')
    if (!kind || !service || !model) continue

    const estimatedCost = estimatedCostSteps.get(key)
    const actualCost = actualCostSteps.get(key)
    const timing = timingSteps.get(key)
    const normalized = normalizeStepShape(kind, service, model)
    if (!normalized) continue

    out.push({
      kind: normalized.kind,
      service: normalized.service,
      model: normalized.model,
      estimatedCostCents: estimatedCost?.cost ?? null,
      rawEstimatedCostCents: estimatedCost?.rawCost ?? null,
      actualCostCents: actualCost?.cost ?? null,
      actualProcessingTimeMs: timing?.processingTimeMs ?? null,
      actualMsPerUnit: timing?.msPerUnit ?? null,
      unitValue: timing?.unitValue ?? actualCost?.unitValue ?? null,
    })
  }

  return out
}

const getModelEntry = (
  parsed: JsonObject,
  service: string,
  model: string
): JsonObject | null => {
  const serviceEntry = parsed[service]
  if (!isRecord(serviceEntry)) return null
  const models = serviceEntry['models']
  if (!isRecord(models)) return null
  const modelEntry = models[model]
  return isRecord(modelEntry) ? modelEntry : null
}

const readCurrentTimeValue = (modelEntry: JsonObject, fieldName: string): number | null => {
  const estimation = modelEntry['estimation']
  if (!isRecord(estimation)) return null
  return getFiniteNumber(estimation[fieldName])
}

const readCurrentCostMultiplier = (modelEntry: JsonObject): number | null => {
  const estimation = modelEntry['estimation']
  if (!isRecord(estimation)) return null
  return getFiniteNumber(estimation['costMultiplier'])
}

const getConfigFragmentFilenamePrefix = (kind: CalibrationKind): string | null => {
  switch (kind) {
    case 'stt':
      return MODEL_CONFIG_FRAGMENT_PREFIXES.stt
    case 'tts':
      return MODEL_CONFIG_FRAGMENT_PREFIXES.tts
    case 'extract':
      return MODEL_CONFIG_FRAGMENT_PREFIXES.extract
    case 'llm':
    case 'image':
    case 'video':
    case 'music':
      return null
  }
}

const resolveCalibrationConfigFilePath = async (
  kind: CalibrationKind,
  configPath: string,
  service: string
): Promise<string | null> => {
  let isFile = false
  let isDirectory = false
  try {
    const pathStat = await stat(configPath)
    isFile = pathStat.isFile()
    isDirectory = pathStat.isDirectory()
  } catch {
    return null
  }

  if (isFile) {
    return configPath
  }

  if (!isDirectory) {
    return null
  }

  const fragmentFilenamePrefix = getConfigFragmentFilenamePrefix(kind)
  if (fragmentFilenamePrefix === null) {
    return null
  }

  return resolve(configPath, `${fragmentFilenamePrefix}-${service}.json`)
}

const unwrapCalibrationMetadata = (parsed: Record<string, unknown>): Record<string, unknown> => {
  const items = parsed['items']
  const item = Array.isArray(items) && items.length === 1 && isRecord(items[0])
    ? items[0]
    : undefined
  if (!item || !isRecord(item['metadata'])) {
    return parsed
  }

  const providerMetadata = Array.isArray(item['providers'])
    ? item['providers']
      .filter((provider): provider is Record<string, unknown> =>
        isRecord(provider) && provider['status'] === 'succeeded' && isRecord(provider['metadata']))
      .map((provider) => provider['metadata'] as Record<string, unknown>)
      .filter((metadata) => Object.keys(metadata).length > 0)
    : []

  return {
    ...item['metadata'],
    ...(providerMetadata.length === 1
      ? { step2: providerMetadata[0] }
      : providerMetadata.length > 1
        ? { step2: providerMetadata }
        : {})
  }
}

const collectJsonFiles = async (dir: string): Promise<string[]> => {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => resolve(dir, entry.name))
}

const collectCalibrationManifestPaths = async (runDir: string): Promise<string[]> => {
  const [pipelineManifests, metadataManifests] = await Promise.all([
    collectJsonFiles(resolve(runDir, 'run')),
    collectJsonFiles(resolve(runDir, 'metadata')),
  ])

  return [...pipelineManifests, ...metadataManifests]
}

const collectCalibrationObservations = async (rootDir: string): Promise<CalibrationScan> => {
  let runEntries
  try {
    runEntries = await readdir(rootDir, { withFileTypes: true })
  } catch {
    return { observations: [], runsScanned: 0, metadataFilesScanned: 0 }
  }

  const runDirectories = runEntries.filter((entry) => entry.isDirectory())
  const manifestPaths = (
    await Promise.all(runDirectories.map((entry) => collectCalibrationManifestPaths(resolve(rootDir, entry.name))))
  ).flat()
  const parsedManifests = await Promise.all(manifestPaths.map(async (metadataPath) => {
    try {
      const parsed = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }))

  const observations: CalibrationStepObservation[] = []
  let metadataFilesScanned = 0

  for (const parsed of parsedManifests) {
    if (!parsed) continue
    metadataFilesScanned += 1
    observations.push(...collectObservationsFromMetadata(unwrapCalibrationMetadata(parsed)))
  }

  return { observations, runsScanned: runDirectories.length, metadataFilesScanned }
}

const groupObservationsByStep = (
  observations: CalibrationStepObservation[]
): Map<string, CalibrationStepObservation[]> => {
  const grouped = new Map<string, CalibrationStepObservation[]>()

  for (const observation of observations) {
    const key = buildStepKey(observation)
    const list = grouped.get(key) ?? []
    list.push(observation)
    grouped.set(key, list)
  }

  return grouped
}

const loadCalibrationModelEntry = async (
  kind: CalibrationKind,
  service: string,
  model: string,
  configPaths: CalibrationConfigPaths,
  parsedConfigCache: Map<string, JsonObject>
): Promise<JsonObject | null> => {
  const configPath = configPaths[kind]
  if (!configPath) return null
  const configFilePath = await resolveCalibrationConfigFilePath(kind, configPath, service)
  if (!configFilePath) return null

  let parsedConfig = parsedConfigCache.get(configFilePath)
  if (!parsedConfig) {
    try {
      const raw = JSON.parse(await readFile(configFilePath, 'utf8')) as unknown
      if (!isRecord(raw)) return null
      parsedConfig = raw
      parsedConfigCache.set(configFilePath, parsedConfig)
    } catch {
      return null
    }
  }

  return getModelEntry(parsedConfig, service, model)
}

const computeGroupRates = (group: CalibrationStepObservation[]): CalibrationGroupRates => {
  const costRatios = group
    .filter(obs => (obs.rawEstimatedCostCents ?? 0) > 0 && (obs.actualCostCents ?? 0) >= 0)
    .map(obs => (obs.actualCostCents as number) / (obs.rawEstimatedCostCents as number))
    .filter(value => Number.isFinite(value) && value > 0)

  const timeRates = group
    .map(obs => {
      if (obs.actualMsPerUnit !== null) return obs.actualMsPerUnit
      if (obs.actualProcessingTimeMs === null || obs.unitValue === null) return null
      return computeObservedTimeRate(obs.kind, obs.actualProcessingTimeMs, obs.unitValue)
    })
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0)

  return { costRatios, timeRates }
}

/** An unset or non-positive current value has no usable baseline, so the observed value always wins. */
const driftGate = (current: number | null, next: number, threshold: number): boolean => {
  if (current === null) return true
  const drift = current > 0 ? Math.abs((next - current) / current) : 1
  return drift >= threshold
}

const recommendForGroup = (
  kind: CalibrationKind,
  service: string,
  model: string,
  rates: CalibrationGroupRates,
  modelEntry: JsonObject
): CalibrationRecommendation | null => {
  const { costRatios, timeRates } = rates
  const medianCost = median(costRatios)
  const medianTime = median(timeRates)
  const oldCost = readCurrentCostMultiplier(modelEntry)
  const timeField = getTimeFieldName(kind)
  const oldTime = readCurrentTimeValue(modelEntry, timeField)

  let recommendedCost: number | null = null
  let recommendedTime: number | null = null

  if (medianCost !== null) {
    const next = roundCostMultiplier(smoothValue(oldCost, medianCost))
    if (driftGate(oldCost, next, COST_DRIFT_THRESHOLD)) {
      recommendedCost = next
    }
  }

  if (medianTime !== null) {
    const next = roundTimeValue(smoothValue(oldTime, medianTime))
    if (driftGate(oldTime, next, TIME_DRIFT_THRESHOLD)) {
      recommendedTime = next
    }
  }

  if (recommendedCost === null && recommendedTime === null) {
    return null
  }

  const notes = recommendedTime !== null && timeRates.length > 0
    ? ['Timing calibration uses wall-clock latency observations.']
    : []

  return {
    kind,
    service,
    model,
    costSamples: costRatios.length,
    timeSamples: timeRates.length,
    oldCostMultiplier: oldCost,
    recommendedCostMultiplier: recommendedCost,
    medianCostMultiplier: medianCost,
    timeField,
    oldTimeValue: oldTime,
    recommendedTimeValue: recommendedTime,
    medianTimeValue: medianTime,
    ...(notes.length > 0 ? { notes } : {}),
  }
}

export const buildModelCalibrationReport = async (
  rootDir: string,
  configPaths: CalibrationConfigPaths = MODEL_CONFIG_PATHS
): Promise<CalibrationReport> => {
  const { observations, runsScanned, metadataFilesScanned } = await collectCalibrationObservations(rootDir)
  const grouped = groupObservationsByStep(observations)
  const parsedConfigCache = new Map<string, JsonObject>()
  const recommendations: CalibrationRecommendation[] = []

  for (const [key, group] of grouped) {
    const [kind, service, model] = key.split('::')
    if (!kind || !service || !model) continue

    const calibrationKind = kind as CalibrationKind
    const modelEntry = await loadCalibrationModelEntry(calibrationKind, service, model, configPaths, parsedConfigCache)
    if (!modelEntry) continue

    const recommendation = recommendForGroup(
      calibrationKind,
      service,
      model,
      computeGroupRates(group),
      modelEntry
    )
    if (recommendation) {
      recommendations.push(recommendation)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    rootDir: resolve(rootDir),
    runsScanned,
    metadataFilesScanned,
    recommendedModels: recommendations.length,
    recommendations,
  }
}
