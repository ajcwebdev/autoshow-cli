import { stat } from 'node:fs/promises'
import { derivePipelineItemRecord, PIPELINE_MANIFEST_FILE, readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { CLIUsageError, InfraError, isCLIUsageError, ValidationError } from '~/utils/error-handler'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import type { JsonObject } from '~/types'

export const isRecord = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getObject = (object: JsonObject, key: string): JsonObject | undefined => {
  const value = object[key]
  return isRecord(value) ? value : undefined
}

export const getString = (object: JsonObject, key: string): string | undefined => {
  const value = object[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export const getNumber = (object: JsonObject, key: string): number | undefined => {
  const value = object[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export const getArray = (object: JsonObject, key: string): unknown[] => {
  const value = object[key]
  return Array.isArray(value) ? value : []
}

export const round2 = (value: number): number => Math.round(value * 100) / 100

export const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export const optionalAverage = (values: readonly number[]): number | undefined =>
  values.length === 0 ? undefined : round2(average(values))

export const providerKey = (service: string, model: string): string => `${service}/${model}`

export const providerGroup = (service: string): 'local' | 'service' =>
  service === 'local' ? 'local' : 'service'

export const ensureDirectory = async (path: string, label: string): Promise<void> => {
  try {
    const pathStat = await stat(path)
    if (!pathStat.isDirectory()) {
      throw CLIUsageError(`${label} must be a run directory: ${path}`)
    }
  } catch (error) {
    if (isCLIUsageError(error)) {
      throw error
    }
    throw CLIUsageError(`${label} not found: ${path}`)
  }
}

export const ensureFile = async (path: string, message: string): Promise<void> => {
  try {
    const pathStat = await stat(path)
    if (!pathStat.isFile()) {
      throw CLIUsageError(message)
    }
  } catch (error) {
    if (isCLIUsageError(error)) {
      throw error
    }
    throw CLIUsageError(message)
  }
}

export const loadMediaManifest = async <TEntry>(
  runDir: string,
  command: 'image' | 'video',
  label: string,
  parseEntry: (rawEntry: JsonObject, manifestMetadata: JsonObject, index: number) => TEntry
): Promise<{ input: string, entries: TEntry[], raw: JsonObject }> => {
  await ensureDirectory(runDir, `${label} run directory`)
  const manifest = await readManifest(runDir)
  const item = manifest?.items[0]
  if (!manifest || manifest.command !== command || manifest.scope !== 'single' || !item) {
    throw CLIUsageError(`${label} run directory must contain a single ${command} ${PIPELINE_MANIFEST_FILE}.`)
  }
  const metadata = derivePipelineItemRecord(runDir, item)

  const input = getString(metadata, 'input')
  if (!input) {
    throw CLIUsageError(`${label} benchmark source prompt is missing. ${PIPELINE_MANIFEST_FILE} must contain an item input.`)
  }

  const rawEntries = getArray(metadata, command)
  if (rawEntries.length === 0) {
    throw CLIUsageError(`${label} benchmark ${PIPELINE_MANIFEST_FILE} must contain item metadata.${command}[].`)
  }

  const entries = rawEntries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw CLIUsageError(`${label} benchmark metadata.${command}[${index}] must be an object.`)
    }
    return parseEntry(entry, metadata, index)
  })

  return { input, entries, raw: metadata }
}

export const costFromManifestMetadata = (metadata: JsonObject, service: string, model: string): number | undefined => {
  const cost = getObject(metadata, 'cost')
  const sources = [
    cost ? getObject(cost, 'actual') : undefined,
    cost ? getObject(cost, 'estimated') : undefined
  ]

  for (const source of sources) {
    if (!source) {
      continue
    }

    for (const step of getArray(source, 'steps').filter(isRecord)) {
      if (getString(step, 'provider') === service && getString(step, 'model') === model) {
        const value = getNumber(step, 'cost')
        if (value !== undefined) {
          return value
        }
      }
    }
  }

  return undefined
}

const stripJsonCodeFence = (rawText: string): string => {
  const trimmed = rawText.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export const parseJsonObjectFromText = (rawText: string, errorMessage: string): JsonObject => {
  const direct = stripJsonCodeFence(rawText)

  try {
    const parsed = JSON.parse(direct) as unknown
    if (isRecord(parsed)) {
      return parsed
    }
  } catch {
  }

  const start = direct.indexOf('{')
  const end = direct.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(direct.slice(start, end + 1)) as unknown
    if (isRecord(parsed)) {
      return parsed
    }
  }

  throw ValidationError(errorMessage, { stage: 'benchmark:parse-json' })
}

export const runOpenAIJudge = async (
  model: string,
  content: unknown[],
  schemaName: string,
  schema: unknown,
  emptyMessage: string,
  stage: string
): Promise<{ rawText: string, usage?: JsonObject }> => {
  const config = getOpenAIClientConfig()
  const response = await createOpenAIResponse(config, {
    model,
    input: [{ role: 'user', content }],
    text: {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: schemaName,
        schema,
        strict: true
      }
    }
  })
  const rawText = extractOpenAIResponseText(response) ?? ''
  if (!rawText.trim()) {
    throw InfraError(emptyMessage, { stage })
  }

  return {
    rawText,
    ...(isRecord(response.usage) ? { usage: response.usage } : {})
  }
}

export const stringArray = (object: JsonObject, key: string): string[] =>
  getArray(object, key)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())

export const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values)]

export const escapeCell = (value: string): string => value.replaceAll('|', '\\|').replaceAll('\n', ' ')

export const formatScore = (value: number): string => value.toFixed(2)

export const formatSeconds = (value: number | undefined): string =>
  value === undefined ? 'n/a' : `${(value / 1000).toFixed(2)}s`

export const formatCost = (value: number | undefined): string =>
  value === undefined ? 'n/a' : `$${(value / 100).toFixed(4)}`
