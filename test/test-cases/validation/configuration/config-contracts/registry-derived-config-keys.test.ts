import { describe, expect, test } from 'bun:test'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { FLAG_TO_CONFIG_PATH } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import {
  getStep2ProviderConfigPathEntries,
  getStep2ProviderEntries
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { AutoshowConfigSchema } from '~/types/index'
import type { Step2Command } from '~/types'
import { writeTempConfig } from './shared'

// `config --stt together=<model>` used to write a file no later command could
// load: the write path derives its keys from the step-2 provider registry, while
// the read schema was a hand-maintained list that stopped tracking it. These
// assertions fail the moment the two diverge again.

const unwrap = (schema: unknown): { entries: Record<string, unknown> } => {
  const candidate = schema as { wrapped?: unknown, entries?: Record<string, unknown> }
  return (candidate.wrapped !== undefined ? candidate.wrapped : candidate) as { entries: Record<string, unknown> }
}

const schemaKeysAtPath = (path: readonly string[]): string[] => {
  let current = unwrap(AutoshowConfigSchema)
  for (const segment of path) {
    const next = current.entries[segment]
    if (next === undefined) {
      throw new Error(`Config schema has no section at ${path.join('.')} (missing "${segment}")`)
    }
    current = unwrap(next)
  }
  return Object.keys(current.entries)
}

const setNested = (target: Record<string, unknown>, path: readonly string[], value: unknown): void => {
  let current = target
  for (const segment of path.slice(0, -1)) {
    if (typeof current[segment] !== 'object' || current[segment] === null) current[segment] = {}
    current = current[segment] as Record<string, unknown>
  }
  current[path[path.length - 1] as string] = value
}

const step2ConfigKeysByStep = (step: Step2Command): string[] =>
  [...new Set(
    getStep2ProviderEntries(step)
      // URL providers all share one fixed `provider` key rather than one key each.
      .filter((entry) => entry.selection.type !== 'fixed')
      .map((entry) => entry.configPath[entry.configPath.length - 1] as string)
  )]

describe('registry-derived config key contracts', () => {
  test('every step-2 provider config key exists in the strict read schema', () => {
    for (const step of ['stt', 'ocr'] as const) {
      const schemaKeys = new Set(schemaKeysAtPath(['defaults', 'extract', step]))
      const missing = step2ConfigKeysByStep(step).filter((key) => !schemaKeys.has(key))
      expect({ step, missing }).toEqual({ step, missing: [] })
    }
  })

  test('every step-2 provider flag has a config destination', () => {
    const missing = getStep2ProviderConfigPathEntries()
      .filter(({ flagName }) => FLAG_TO_CONFIG_PATH[flagName] === undefined)
      .map(({ flagName }) => flagName)

    expect(missing).toEqual([])
  })

  test('a config written at every registry config path still loads', async () => {
    const value: Record<string, unknown> = {}
    for (const entry of getStep2ProviderConfigPathEntries()) {
      const key = entry.configPath[entry.configPath.length - 1] as string
      const schemaKeys = new Set(schemaKeysAtPath(entry.configPath.slice(0, -1)))
      if (!schemaKeys.has(key)) continue
      // Model providers persist arrays; boolean providers and the fixed URL
      // provider persist a scalar, so probe with a shape each accepts.
      const probe = key === 'provider' ? 'defuddle' : key === 'tesseract' ? true : ['probe-model']
      setNested(value, entry.configPath, probe)
    }

    const configPath = await writeTempConfig(value)
    await expect(loadConfig(configPath)).resolves.toMatchObject(value)
  })
})
