import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('DeepInfra OCR retirement contracts', () => {
  test('DeepInfra has no OCR catalog, adapter, or bare-provider default', () => {
    expect(getModelRegistry().extract['deepinfra']).toBeUndefined()
    expect(resolveCheapestModelForFlag('deepinfra-ocr')).toBeUndefined()
    expect(existsSync(resolve('src/cli/commands/text/ocr/ocr-services/deepinfra-ocr'))).toBe(false)
    expect(existsSync(resolve('src/cli/commands/setup-and-utilities/models/ocr-config/ocr-deepinfra.json'))).toBe(false)
  })

  test('a DeepInfra OCR selection rejects locally before dispatch', () => {
    expect(() => buildOptsFromFlags({ 'deepinfra-ocr': 'retired-deepinfra-ocr-model' })).toThrow('Provider selections deepinfra-ocr are no longer supported.')
    expect(() => buildOptsFromFlags({ 'deepinfra-ocr': true })).toThrow('Provider selections deepinfra-ocr are no longer supported.')
  })

  test('DeepInfra speech-to-text stays registered and selectable', () => {
    expect(Object.keys(getModelRegistry().stt['deepinfra']?.models ?? {})).toContain('openai/whisper-large-v3-turbo')
    expect(buildOptsFromFlags({ 'deepinfra-stt': 'openai/whisper-large-v3-turbo' }).deepinfraSttModels).toEqual(['openai/whisper-large-v3-turbo'])
  })
})
