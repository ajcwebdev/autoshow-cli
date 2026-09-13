import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { getModelRegistry, getLlmCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
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
    expect(options.kimiModels).toContain('kimi-k2.6')
    expect(options.kimiOcrModels).toContain('kimi-k2.6')
    expect(parseWrite('kimi', 'kimi-k2.6').kimiModels).toEqual(['kimi-k2.6'])
    expect(getModelRegistry().llm['minimax']).toBeUndefined()
    expect(getModelRegistry().music['minimax']).toBeDefined()
  })

  test('remaining defaults, saved overrides and reset resolve through cheapest eligible selection', async () => await withLocalTestDir('retained-defaults', async root => {
    for (const [provider, expected] of [['openai', 'gpt-5.6-luna'], ['anthropic', 'claude-sonnet-5'], ['grok', 'grok-4.5'], ['glm', 'glm-5.3-flash'], ['together', 'glm-5.3-flash'], ['kimi', 'kimi-k2.6']] as const) {
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
