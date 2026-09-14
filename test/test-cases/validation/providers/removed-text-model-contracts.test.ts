import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { getModelRegistry, getLlmCost, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { prepareGenerationResume } from '~/cli/commands/setup-and-utilities/resume/generation-resume-preparation'
import { writeResumeConfig } from '~/cli/commands/setup-and-utilities/resume/resume-write/write-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveLlmReasoningOptions } from '~/cli/commands/text/write/write-services/llm-reasoning-options'
import { normalizeWriteStepSelectorFlags } from './provider-selection-contracts/generic-selector-test-adapters'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'
import type { PipelineManifest, ResumeTarget } from '~/types'

// These IDs are rejection fixtures only; native Kimi remains supported.
const removed = [
  ['anthropic', 'claude-opus-4-8'], ['anthropic', 'claude-sonnet-4-6'], ['anthropic', 'claude-haiku-4-5'],
  ['grok', 'grok-4.3'], ['openai', 'gpt-5.5'], ['openai', 'gpt-5.4-mini'], ['openai', 'gpt-5.4-nano'],
  ['together', 'kimi-k2.6'], ['minimax', 'MiniMax-M3'], ['glm', 'glm-5.1'], ['together', 'glm-5.1'],
  ['gemini', 'gemini-3.1-pro-preview'],
] as const

const parseWrite = (provider: string, model: string) => {
  const normalized = normalizeWriteStepSelectorFlags({ llm: [`${provider}=${model}`] }, new Set(['llm']))
  return buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags)
}

describe('removed text selections reject before dispatch', () => {
  for (const [provider, model] of removed) {
    test(`${provider}/${model}: CLI, setup, saved configuration, adapter policy and stored write resume reject`, async () => await withLocalTestDir('removed-text-selection', async root => {
      expect(() => parseWrite(provider, model)).toThrow()
      expect(getLlmCost(provider, model)).toBeUndefined()
      expect(() => resolveLlmReasoningOptions(provider, model, undefined)).toThrow('Unsupported write model')
      if (provider !== 'minimax') expect(() => buildConfigPatchFromFlags({ [provider]: model }, new Set([provider]))).toThrow('Unsupported configured model')
      const configPath = join(root, 'config.json')
      await Bun.write(configPath, JSON.stringify({ defaults: { llm: { [provider]: [model] } } }))
      await expect(loadConfig(configPath)).rejects.toThrow()
      if (getModelRegistry().extract[provider]) {
        expect(() => buildOptsFromFlags({ [`${provider}-ocr`]: model })).toThrow()
        expect(() => buildConfigPatchFromFlags({ [`${provider}-ocr`]: model }, new Set([`${provider}-ocr`]))).toThrow()
        await Bun.write(configPath, JSON.stringify({ defaults: { extract: { ocr: { [`${provider}Ocr`]: [model] } } } }))
        await expect(loadConfig(configPath)).rejects.toThrow('Unsupported configured ocr model')
      }
      const target: ResumeTarget = { kind: 'write', scope: 'single', dir: root, manifestPath: join(root, 'manifest.json') }
      const manifest = { command: 'write', scope: 'single', items: [{ metadata: {}, providers: [{ service: provider, model, status: 'failed' }] }] } as unknown as PipelineManifest
      await expect(prepareGenerationResume(target, writeResumeConfig, buildOptsFromFlags({}), new Set(), true, 0, manifest)).rejects.toThrow('Unsupported saved write model')
    }))
  }

  test('all-provider expansion and native Kimi retain only supported provider/model pairs', () => {
    const options = buildOptsFromFlags({ 'all-llm': true, 'all-ocr': true })
    for (const [provider, model] of removed) expect(Reflect.get(options, `${provider}Models`) ?? []).not.toContain(model)
    expect(options.kimiModels).toContain('kimi-k3')
    expect(options.kimiModels).not.toContain('kimi-k2.6')
    expect(options.kimiOcrModels).toContain('kimi-k2.6')
    expect(parseWrite('kimi', 'kimi-k3').kimiModels).toEqual(['kimi-k3'])
    expect(getModelRegistry().llm['minimax']).toBeUndefined()
    expect(getModelRegistry().music['minimax']).toBeDefined()
  })

  test('remaining defaults, saved overrides and reset resolve through cheapest eligible selection', async () => await withLocalTestDir('retained-defaults', async root => {
    for (const [provider, expected] of [['openai', 'gpt-5.6-luna'], ['anthropic', 'claude-sonnet-5'], ['gemini', 'gemini-3.7-flash'], ['grok', 'grok-4.6'], ['glm', 'glm-5.3-flash'], ['together', 'glm-5.3-flash'], ['kimi', 'kimi-k3']] as const) {
      expect(resolveCheapestModelForFlag(provider)).toBe(expected)
      expect(Reflect.get(buildOptsFromFlags({ [provider]: true }), `${provider}Models`)).toEqual([expected])
    }
    const path = join(root, 'config.json')
    const patch = buildConfigPatchFromFlags({ openai: 'gpt-5.6-sol' }, new Set(['openai']))
    await Bun.write(path, JSON.stringify(patch))
    const saved = await loadConfig(path)
    const merged = mergeConfigIntoRawFlags({}, saved, new Set())
    expect(buildOptsFromFlags(merged).openaiModels).toEqual(['gpt-5.6-sol'])
    expect(buildOptsFromFlags(mergeConfigIntoRawFlags({ openai: 'gpt-5.6-terra' }, saved, new Set(['openai']))).openaiModels).toEqual(['gpt-5.6-terra'])
    await Bun.write(path, '{}')
    expect(await loadConfig(path)).toEqual({})
    expect(buildOptsFromFlags({ openai: true }).openaiModels).toEqual(['gpt-5.6-luna'])
  }))
})

const writeRemoved = [
  ['gemini', 'gemini-3.5-flash-lite', 'gemini-3.8-flash, gemini-3.7-flash'],
  ['gemini', 'gemini-3.6-flash', 'gemini-3.8-flash, gemini-3.7-flash'],
  ['gemini', 'gemini-3.5-flash', 'gemini-3.8-flash, gemini-3.7-flash'],
  ['grok', 'grok-4.5', 'grok-4.6'],
  ['anthropic', 'claude-fable-5', 'claude-fable-5-1, claude-sonnet-5, claude-opus-5'],
  ['kimi', 'kimi-k2.6', 'kimi-k3'],
] as const

const ocrFlag = (provider: string) => `${provider}-ocr`
const ocrConfigKey = (provider: string) => `${provider}Ocr`

describe('write-only catalog removals stay valid for OCR and Gemini 3.6 Flash STT', () => {
  for (const [provider, model, allowed] of writeRemoved) {
    test(`${provider}/${model}: write parse, config and resume reject; OCR parse and config still accept`, async () => await withLocalTestDir('write-only-removed-selection', async root => {
      const writeMessage = `Invalid model "${model}" for --llm ${provider}[=model]. Allowed values: ${allowed}`
      expect(() => parseWrite(provider, model)).toThrow(writeMessage)
      expect(() => resolveLlmReasoningOptions(provider, model, undefined)).toThrow('Unsupported write model')
      expect(() => buildConfigPatchFromFlags({ [provider]: model }, new Set([provider]))).toThrow('Unsupported configured model')
      const configPath = join(root, 'config.json')
      await Bun.write(configPath, JSON.stringify({ defaults: { llm: { [provider]: [model] } } }))
      await expect(loadConfig(configPath)).rejects.toThrow()
      expect(getModelRegistry().llm[provider]?.models[model]).toBeUndefined()
      expect(getExtractPricing(provider, model).inputCostPer1MCents).toEqual(expect.any(Number))

      expect(Reflect.get(buildOptsFromFlags({ [ocrFlag(provider)]: model }), `${provider}OcrModels`)).toEqual([model])
      expect(() => buildConfigPatchFromFlags({ [ocrFlag(provider)]: model }, new Set([ocrFlag(provider)]))).not.toThrow()
      await Bun.write(configPath, JSON.stringify({ defaults: { extract: { ocr: { [ocrConfigKey(provider)]: [model] } } } }))
      await expect(loadConfig(configPath)).resolves.toMatchObject({
        defaults: { extract: { ocr: { [ocrConfigKey(provider)]: [model] } } }
      })

      const target: ResumeTarget = { kind: 'write', scope: 'single', dir: root, manifestPath: join(root, 'manifest.json') }
      const manifest = { command: 'write', scope: 'single', items: [{ metadata: {}, providers: [{ service: provider, model, status: 'failed' }] }] } as unknown as PipelineManifest
      await expect(prepareGenerationResume(target, writeResumeConfig, buildOptsFromFlags({}), new Set(), true, 0, manifest)).rejects.toThrow('Unsupported saved write model')
    }))
  }

  test('Gemini 3.6 Flash remains selectable for STT while write rejects it', () => {
    expect(() => parseWrite('gemini', 'gemini-3.6-flash')).toThrow(
      'Invalid model "gemini-3.6-flash" for --llm gemini[=model]. Allowed values: gemini-3.8-flash, gemini-3.7-flash'
    )
    expect(buildOptsFromFlags({ 'gemini-stt': 'gemini-3.6-flash' }).geminiSttModels).toEqual(['gemini-3.6-flash'])
  })

  test('--all-ocr still expands write-removed IDs while --all-llm does not', () => {
    const llmOpts = buildOptsFromFlags({ 'all-llm': true })
    const ocrOpts = buildOptsFromFlags({ 'all-ocr': true })
    for (const [provider, model] of writeRemoved) {
      expect(Reflect.get(llmOpts, `${provider}Models`) ?? []).not.toContain(model)
      expect(Reflect.get(ocrOpts, `${provider}OcrModels`) ?? []).toContain(model)
    }
    expect(llmOpts.geminiModels).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash'])
    expect(llmOpts.grokModels).toEqual(['grok-4.6'])
    expect(llmOpts.kimiModels).toEqual(['kimi-k3'])
    expect(llmOpts.anthropicModels).toEqual(['claude-fable-5-1', 'claude-sonnet-5', 'claude-opus-5'])
  })
})
