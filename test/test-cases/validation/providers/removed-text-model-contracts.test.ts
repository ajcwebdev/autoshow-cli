import { describe, expect, spyOn, test } from 'bun:test'
import { join } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { getModelRegistry, getLlmCost, getExtractPricing } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { prepareGenerationResume } from '~/cli/commands/setup-and-utilities/resume/generation-resume-preparation'
import { writeResumeConfig } from '~/cli/commands/setup-and-utilities/resume/resume-write/write-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveLlmReasoningOptions } from '~/cli/commands/text/write/write-services/llm-reasoning-options'
import { normalizeGenericProviderSelectorFlags } from './provider-selection-contracts/generic-selector-test-adapters'
import { WRITE_LLM_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'
import type { LLMTarget, PipelineManifest, ResumeTarget } from '~/types'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'

// These IDs are rejection fixtures only; removed providers never become active selections.
const removed = [
  ['anthropic', 'claude-opus-4-8'], ['anthropic', 'claude-sonnet-4-6'], ['anthropic', 'claude-haiku-4-5'],
  ['grok', 'grok-4.3'], ['openai', 'gpt-5.5'], ['openai', 'gpt-5.4-mini'], ['openai', 'gpt-5.4-nano'],
  ['together', 'removed-kimi-model'], ['minimax', 'MiniMax-M3'], ['glm', 'glm-5.1'], ['together', 'glm-5.1'],
  ['gemini', 'gemini-3.1-pro-preview'], ['kimi', 'removed-kimi-model'],
] as const

const parseWrite = (provider: string, model: string) => {
  const normalized = normalizeGenericProviderSelectorFlags(
    { provider: [`${provider}=${model}`] },
    new Set(['provider']),
    'provider',
    WRITE_LLM_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-llm' }
  )
  return buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags)
}

describe('removed text selections reject before dispatch', () => {
  for (const [provider, model] of removed) {
    test(`${provider}/${model}: CLI, setup, saved configuration, adapter policy and stored write resume reject`, async () => await withLocalTestDir('removed-text-selection', async root => {
      expect(() => parseWrite(provider, model)).toThrow()
      if (!['glm', 'kimi', 'together'].includes(provider)) expect(getLlmCost(provider, model)).toBeUndefined()
      expect(() => resolveLlmReasoningOptions(provider, model, undefined)).toThrow('Unsupported write model')
      if (!['minimax', 'glm', 'kimi', 'together'].includes(provider)) expect(() => buildConfigPatchFromFlags({ [provider]: model }, new Set([provider]))).toThrow('Unsupported configured model')
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

  test('all-provider expansion retains only supported provider/model pairs', () => {
    const options = buildOptsFromFlags({ 'all-llm': true, 'all-ocr': true })
    for (const [provider, model] of removed) expect(Reflect.get(options, `${provider}Models`) ?? []).not.toContain(model)
    expect(getModelRegistry().llm['minimax']).toBeUndefined()
    expect(getModelRegistry().music['minimax']).toBeDefined()
  })

  test('remaining defaults, saved overrides and reset resolve through cheapest eligible selection', async () => await withLocalTestDir('retained-defaults', async root => {
    for (const [provider, expected] of [['openai', 'gpt-6-luna'], ['anthropic', 'claude-haiku-5-5'], ['gemini', 'gemini-3.8-flash'], ['grok', 'grok-4.7']] as const) {
      expect(resolveCheapestModelForFlag(provider)).toBe(expected)
      expect(Reflect.get(buildOptsFromFlags({ [provider]: true }), `${provider}Models`)).toEqual([expected])
    }
    const path = join(root, 'config.json')
    const patch = buildConfigPatchFromFlags({ openai: 'gpt-6.1-sol' }, new Set(['openai']))
    await Bun.write(path, JSON.stringify(patch))
    const saved = await loadConfig(path)
    const merged = mergeConfigIntoRawFlags({}, saved, new Set())
    expect(buildOptsFromFlags(merged).openaiModels).toEqual(['gpt-6.1-sol'])
    expect(buildOptsFromFlags(mergeConfigIntoRawFlags({ openai: 'gpt-6-luna' }, saved, new Set(['openai']))).openaiModels).toEqual(['gpt-6-luna'])
    await Bun.write(path, '{}')
    expect(await loadConfig(path)).toEqual({})
    expect(buildOptsFromFlags({ openai: true }).openaiModels).toEqual(['gpt-6-luna'])
  }))
})

const fullyRemoved = [
  ['gemini', 'gemini-3.6-flash', 'gemini-4-argon, gemini-3.8-flash', 'gemini-3.8-flash'],
  ['gemini', 'gemini-3.5-flash', 'gemini-4-argon, gemini-3.8-flash', 'gemini-3.8-flash'],
  ['grok', 'grok-4.5', 'grok-4.7', 'grok-4.7'],
  ['openai', 'gpt-6-astra', 'gpt-6.1-sol, gpt-6-luna', 'gpt-6.1-sol, gpt-6-luna'],
  ['openai', 'gpt-5.6-terra', 'gpt-6.1-sol, gpt-6-luna', 'gpt-6.1-sol, gpt-6-luna'],
  ['anthropic', 'claude-fable-5-1', 'claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5', 'claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5, claude-fable-5'],
] as const

const writeRemoved = [
  ['anthropic', 'claude-fable-5', 'claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5'],
] as const

const ocrFlag = (provider: string) => `${provider}-ocr`
const ocrConfigKey = (provider: string) => `${provider}Ocr`

describe('write-only catalog removals stay valid for OCR; fully removed IDs reject everywhere', () => {
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

  for (const [provider, model, writeAllowed, ocrAllowed] of fullyRemoved) {
    test(`${provider}/${model}: write and OCR selections, OCR config and resume all reject locally`, async () => await withLocalTestDir('fully-removed-selection', async root => {
      expect(() => parseWrite(provider, model)).toThrow(`Invalid model "${model}" for --llm ${provider}[=model]. Allowed values: ${writeAllowed}`)
      expect(() => buildOptsFromFlags({ [ocrFlag(provider)]: model })).toThrow(`Invalid model "${model}" for --provider/--ocr ${provider}[=model]. Allowed values: ${ocrAllowed}`)
      expect(() => buildConfigPatchFromFlags({ [ocrFlag(provider)]: model }, new Set([ocrFlag(provider)]))).toThrow()
      const configPath = join(root, 'config.json')
      await Bun.write(configPath, JSON.stringify({ defaults: { extract: { ocr: { [ocrConfigKey(provider)]: [model] } } } }))
      await expect(loadConfig(configPath)).rejects.toThrow()
      expect(getModelRegistry().llm[provider]?.models[model]).toBeUndefined()
      expect(getModelRegistry().extract[provider]?.models[model]).toBeUndefined()
    }))
  }

  test('Gemini 3.6 Flash is rejected for write, OCR and STT', () => {
    expect(() => buildOptsFromFlags({ 'gemini-ocr': 'gemini-3.6-flash' })).toThrow('Allowed values: gemini-3.8-flash')
    expect(() => parseWrite('gemini', 'gemini-3.6-flash')).toThrow(
      'Invalid model "gemini-3.6-flash" for --llm gemini[=model]. Allowed values: gemini-4-argon, gemini-3.8-flash'
    )
    expect(() => buildOptsFromFlags({ 'gemini-stt': 'gemini-3.6-flash' })).toThrow(
      'Model "gemini-3.6-flash" is retired for --provider/--stt gemini[=model]. Use "gemini-3.5-transcribe" instead.'
    )
  })

  test('--all-ocr still expands write-removed IDs while --all-llm does not', () => {
    const llmOpts = buildOptsFromFlags({ 'all-llm': true })
    const ocrOpts = buildOptsFromFlags({ 'all-ocr': true })
    for (const [provider, model] of writeRemoved) {
      expect(Reflect.get(llmOpts, `${provider}Models`) ?? []).not.toContain(model)
      expect(Reflect.get(ocrOpts, `${provider}OcrModels`) ?? []).toContain(model)
    }
    expect(llmOpts.geminiModels).toEqual(['gemini-4-argon', 'gemini-3.8-flash'])
    expect(llmOpts.grokModels).toEqual(['grok-4.7'])
    expect(llmOpts.anthropicModels).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'])
  })
})


test('removed writing providers reject stale options, empty saved keys and forged targets before dispatch', async () => await withLocalTestDir('removed-writing-runtime', async root => {
  const blockedFetch = Object.assign(() => { throw Error('Removed provider must never reach network') }, { preconnect: () => {} })
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(blockedFetch)
  let dispatches = 0
  try {
    for (const [provider, model] of [['glm', 'glm-5.1'], ['kimi', 'removed-kimi-model'], ['together', 'removed-kimi-model'], ['together', 'glm-5.1']] as const) {
      for (const value of [true, model, []]) {
        expect(() => buildOptsFromFlags({ [provider]: value })).toThrow(/no longer supported/i)
        expect(() => buildConfigPatchFromFlags({ [provider]: value }, new Set([provider]))).toThrow(/no longer supported/i)
      }
      for (const value of [[], [model]]) {
        expect(() => collectLlmTargets({ [provider + 'Models']: value } as never)).toThrow(/no longer supported/i)
        const configPath = join(root, 'config.json')
        await Bun.write(configPath, JSON.stringify({ defaults: { llm: { [provider]: value } } }))
        await expect(loadConfig(configPath)).rejects.toThrow(/no longer supported/i)
      }
      expect(() => collectLlmTargets({ llmService: provider } as never)).toThrow(/no longer supported/i)
      const target = { service: provider, model, label: provider, run: async () => { dispatches++; throw Error('Unexpected adapter dispatch') } } as unknown as LLMTarget
      await expect(runLlmTargetsForStructuredPrompt({ prompt: 'Synthetic input', outputDir: root, targets: [target] } as never)).rejects.toThrow('Unsupported write model')
    }
    expect(dispatches).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
  } finally { fetchSpy.mockRestore() }
}))
