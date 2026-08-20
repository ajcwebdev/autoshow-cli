import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { ValidationError } from '~/utils/error-handler'
import type { ModelConfigLoadOptions } from '~/types'
import { isRecord } from '~/utils/value-helpers'

const readModelConfigFile = (configPath: string): Record<string, unknown> => {
  const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as unknown
  if (!isRecord(parsed)) {
    throw ValidationError(`Model config at ${configPath} must contain a JSON object`, { stage: 'models:config-load' })
  }
  return parsed
}

export const loadModelConfigJson = (
  configPath: string,
  options: ModelConfigLoadOptions = {}
): Record<string, unknown> => {
  const stats = statSync(configPath)

  if (stats.isFile()) {
    return readModelConfigFile(configPath)
  }

  if (!stats.isDirectory()) {
    throw ValidationError(`Model config path ${configPath} must be a JSON file or a directory`, { stage: 'models:config-load' })
  }

  const fragments = readdirSync(configPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name))

  if (fragments.length === 0) {
    throw ValidationError(`Model config directory ${configPath} must contain JSON fragments`, { stage: 'models:config-load' })
  }

  const registry: Record<string, unknown> = {}

  for (const entry of fragments) {
    const fragmentPath = resolve(configPath, entry.name)
    const fragment = readModelConfigFile(fragmentPath)
    const providerKeys = Object.keys(fragment)
    if (providerKeys.length !== 1) {
      throw ValidationError(`Model config fragment ${fragmentPath} must contain exactly one provider key`, { stage: 'models:config-load' })
    }

    const providerKey = providerKeys[0]
    if (!providerKey) {
      throw ValidationError(`Model config fragment ${fragmentPath} must contain a provider key`, { stage: 'models:config-load' })
    }

    const expectedFilename = options.fragmentFilenamePrefix === undefined
      ? undefined
      : `${options.fragmentFilenamePrefix}-${providerKey}.json`
    if (expectedFilename !== undefined && entry.name !== expectedFilename) {
      throw ValidationError(`Model config fragment ${fragmentPath} must be named ${expectedFilename}`, { stage: 'models:config-load' })
    }

    if (Object.prototype.hasOwnProperty.call(registry, providerKey)) {
      throw ValidationError(`Duplicate provider key ${providerKey} in model config directory ${configPath}`, { stage: 'models:config-load' })
    }

    registry[providerKey] = fragment[providerKey]
  }

  return registry
}
