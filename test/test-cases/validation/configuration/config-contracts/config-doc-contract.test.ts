import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import * as v from 'valibot'
import { FLAG_TO_CONFIG_PATH } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getStep2ProviderEntries } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { AutoshowConfigSchema } from '~/types'
import type { ModelBinding, ModelRegistry } from '~/types'

const configDocPath = resolve(import.meta.dir, '../../../../../docs/commands/setup-and-utilities/config-command/config.md')

const bindingsForTargets = (
  registryStep: keyof ModelRegistry,
  targets: Record<string, string>
): ModelBinding[] => Object.entries(targets).map(([service, flagName]) => ({
  configPath: FLAG_TO_CONFIG_PATH[flagName] ?? [],
  registryStep,
  service
}))

const MODEL_BINDINGS: ModelBinding[] = [
  ...getStep2ProviderEntries('stt')
    .filter(entry => entry.selection.type === 'models')
    .map(entry => ({ configPath: entry.configPath, registryStep: 'stt' as const, service: entry.targetService })),
  ...getStep2ProviderEntries('ocr')
    .filter(entry => entry.selection.type === 'models')
    .map(entry => ({ configPath: entry.configPath, registryStep: 'extract' as const, service: entry.targetService })),
  ...bindingsForTargets('llm', WRITE_LLM_PROVIDER_TARGETS),
  ...bindingsForTargets('tts', STANDALONE_TTS_PROVIDER_TARGETS),
  ...bindingsForTargets('image', STANDALONE_IMAGE_PROVIDER_TARGETS),
  ...bindingsForTargets('video', STANDALONE_VIDEO_PROVIDER_TARGETS),
  ...bindingsForTargets('music', STANDALONE_MUSIC_PROVIDER_TARGETS)
]

const readNested = (value: unknown, path: readonly string[]): unknown => {
  let current = value
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

test('config documentation sample matches the strict schema and active model registries', async () => {
  const markdown = await Bun.file(configDocPath).text()
  const samples = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)]
  expect(samples).toHaveLength(1)

  const sampleText = samples[0]?.[1]
  if (sampleText === undefined) throw new Error('config.md has no fenced JSON sample')
  const sample = v.parse(AutoshowConfigSchema, JSON.parse(sampleText))
  const registry = getModelRegistry()
  const invalidModels: string[] = []

  for (const binding of MODEL_BINDINGS) {
    if (binding.configPath.length === 0) {
      throw new Error(`No config path is registered for ${binding.registryStep}.${binding.service}`)
    }
    const models = readNested(sample, binding.configPath)
    if (models === undefined) continue
    if (!Array.isArray(models)) throw new Error(`${binding.configPath.join('.')} is not a model array`)

    for (const model of models) {
      if (typeof model !== 'string' || registry[binding.registryStep][binding.service]?.models[model] === undefined) {
        invalidModels.push(`${binding.configPath.join('.')}: ${binding.service}/${String(model)}`)
      }
    }
  }

  expect(invalidModels).toEqual([])
})
