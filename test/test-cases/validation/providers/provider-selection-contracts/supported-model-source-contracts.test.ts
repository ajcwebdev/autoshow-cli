import { describe, expect, test } from 'bun:test'
import {
  MODEL_SELECTOR_FREE_SERVICES,
  SUPPORTED_MODEL_SOURCES,
  getSupportedModelSource
} from '~/cli/commands/setup-and-utilities/models/supported-model-sources'
import {
  RETIRED_MODEL_RATES,
  RETIRED_MODEL_REPLACEMENTS,
  getModelRegistry,
  modelRateKey
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ModelCategory } from '~/types'

const registry = getModelRegistry()
const steps = Object.keys(registry) as ModelCategory[]

const sorted = (values: readonly string[]): string[] => [...values].sort()

const registryModels = (step: ModelCategory, service: string): string[] =>
  Object.keys(registry[step][service]?.models ?? {})

describe('supported model identifier sources', () => {
  test('every SUPPORTED_* array names a registry service', () => {
    for (const source of SUPPORTED_MODEL_SOURCES) {
      expect(registry[source.step][source.service], `${source.arrayName} -> ${source.step}/${source.service}`).toBeDefined()
    }
  })

  test('array and JSON agree in both directions for every mapped service', () => {
    for (const source of SUPPORTED_MODEL_SOURCES) {
      const fromJson = registryModels(source.step, source.service)
      const fromArray: readonly string[] = source.models
      const label = `${source.arrayName} vs ${source.step}/${source.service}`

      const missingFromArray = fromJson.filter(model => !fromArray.includes(model))
      const missingFromJson = fromArray.filter(model => !fromJson.includes(model))

      expect(missingFromArray, `${label}: declared in JSON but not in ${source.arrayName}`).toEqual([])
      expect(missingFromJson, `${label}: declared in ${source.arrayName} but not in JSON`).toEqual([])
      expect(sorted(fromArray), label).toEqual(sorted(fromJson))
    }
  })

  test('no SUPPORTED_* array repeats a model identifier', () => {
    for (const source of SUPPORTED_MODEL_SOURCES) {
      const models: readonly string[] = source.models
      expect([...new Set(models)], source.arrayName).toEqual([...models])
    }
  })

  test('the map and the selector-free list together cover every registry service', () => {
    for (const step of steps) {
      for (const service of Object.keys(registry[step])) {
        const mapped = getSupportedModelSource(step, service) !== undefined
        const selectorFree = MODEL_SELECTOR_FREE_SERVICES[step].includes(service)
        expect(
          mapped || selectorFree,
          `${step}/${service} has no SUPPORTED_* array and is not listed in MODEL_SELECTOR_FREE_SERVICES`
        ).toBe(true)
        expect(mapped && selectorFree, `${step}/${service} is both mapped and listed as selector-free`).toBe(false)
      }
    }
  })

  test('the selector-free list names only services that exist in a registry', () => {
    for (const step of steps) {
      for (const service of MODEL_SELECTOR_FREE_SERVICES[step]) {
        expect(registry[step][service], `${step}/${service} is selector-free but absent from the registry`).toBeDefined()
      }
    }
  })

  test('the map has one entry per step and service', () => {
    const keys = SUPPORTED_MODEL_SOURCES.map(source => `${source.step}/${source.service}`)
    expect([...new Set(keys)]).toEqual(keys)
  })

  test('no active model is also carried as a retired rate or replacement', () => {
    for (const source of SUPPORTED_MODEL_SOURCES) {
      for (const model of source.models as readonly string[]) {
        const key = modelRateKey(source.service, model)
        expect(
          RETIRED_MODEL_RATES[source.step][key],
          `${source.step}/${key} is active in ${source.arrayName} and also carries a retired rate`
        ).toBeUndefined()
        expect(
          RETIRED_MODEL_REPLACEMENTS[source.step][key],
          `${source.step}/${key} is active in ${source.arrayName} and also has a retirement replacement`
        ).toBeUndefined()
      }
    }
  })

  test('no retired rate shadows a live registry model', () => {
    for (const step of steps) {
      for (const key of Object.keys(RETIRED_MODEL_RATES[step])) {
        const separator = key.indexOf(':')
        const service = key.slice(0, separator)
        const model = key.slice(separator + 1)
        expect(
          registry[step][service]?.models[model],
          `${step}/${key} is retired but still present in the live registry`
        ).toBeUndefined()
      }
    }
  })
})
