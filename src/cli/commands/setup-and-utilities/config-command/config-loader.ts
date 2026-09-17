import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { AutoshowConfigSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type { AutoshowConfig } from '~/types'
import { resolveStandaloneMistralTtsCliReferenceInput } from '~/cli/options/option-resolution/tts-options'

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined

const RENAMED_TTS_CONFIG_KEYS: readonly (readonly [string, string])[] = [
  ['elevenlabsTtsStability', 'stability'],
  ['elevenlabsTtsSimilarityBoost', 'similarity'],
  ['elevenlabsTtsStyle', 'style'],
  ['elevenlabsTtsUseSpeakerBoost', 'speakerBoost'],
  ['elevenlabsTtsSeed', 'seed'],
  ['elevenlabsTtsPronunciationDictionaryLocators', 'pronunciationDictionary']
]

const RENAMED_STT_CONFIG_KEYS: readonly (readonly [string, string])[] = [
  ['happyscribeOrganizationId', 'organizationId'],
  ['supadataLang', 'language'],
  ['scrapecreatorsLang', 'language'],
  ['deepinfraResponseFormat', 'responseFormat'],
  ['grokVerbatim', 'verbatim'],
  ['supadataChunkSize', 'chunkSize']
]

const validateSttConfigAuthority = (parsed: unknown): void => {
  const stt = asRecord(asRecord(asRecord(asRecord(parsed)?.['defaults'])?.['extract'])?.['stt'])
  if (!stt) return
  const renamed = RENAMED_STT_CONFIG_KEYS.filter(([key]) => key in stt)
  if (renamed.length > 0) {
    throw ValidationError(
      `STT configuration ${renamed.map(([key, replacement]) => `${key} (use ${replacement})`).join(', ')} moved to the provider-general option keys. Update config/autoshow.json, giving each value as "<provider>=<value>" when more than one provider is selected.`,
      { stage: 'config:load' }
    )
  }
}

const validateTtsConfigAuthority = (parsed: unknown): void => {
  const root = asRecord(parsed)
  const defaults = asRecord(root?.['defaults'])
  const tts = asRecord(defaults?.['tts'])
  if (!tts) return

  const retiredKeys = ['geminiTts', 'deepgramTts', 'replicateTts', 'falTts'].filter(key => key in tts)
  if (retiredKeys.length > 0) {
    throw ValidationError(`TTS provider configuration ${retiredKeys.join(', ')} is no longer supported. Remove the obsolete key and select an active TTS provider.`, { stage: 'config:load' })
  }

  // Provider-prefixed option keys moved to the generic `provider=value` spellings. v.strictObject
  // would already reject them, but with a message that does not say where the value went.
  const renamed = RENAMED_TTS_CONFIG_KEYS.filter(([key]) => key in tts)
  if (renamed.length > 0) {
    throw ValidationError(
      `TTS configuration ${renamed.map(([key, replacement]) => `${key} (use ${replacement})`).join(', ')} moved to the provider-general option keys. Update config/autoshow.json, giving each value as "elevenlabs=<value>" when more than one provider is selected.`,
      { stage: 'config:load' }
    )
  }

  resolveStandaloneMistralTtsCliReferenceInput({
    'tts-ref-audio': tts['mistralTtsRefAudio'] ?? tts['refAudio']
  }, {
    configuredFlags: new Set(['tts-ref-audio']),
    cliReferenceInput: 'standalone-mistral'
  })
}

const findProjectRoot = async (startDir: string): Promise<string> => {
  let dir = startDir
  while (true) {
    if (await Bun.file(`${dir}/package.json`).exists()) {
      return dir
    }
    const parts = dir.split('/')
    if (parts.length <= 1) {
      return startDir
    }
    parts.pop()
    const parent = parts.join('/')
    if (!parent || parent === dir) {
      return startDir
    }
    dir = parent
  }
}

export const resolveConfigPath = async (configPathOverride?: string): Promise<string> => {
  if (configPathOverride) return configPathOverride
  const root = await findProjectRoot(process.cwd())
  return `${root}/config/autoshow.json`
}

export const loadConfig = async (configPath: string): Promise<AutoshowConfig> => {
  const file = Bun.file(configPath)
  if (!await file.exists()) {
    return {}
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    throw InfraError(`Failed to read autoshow config at ${configPath}`, { stage: 'config:load' })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw ValidationError(`Invalid JSON in autoshow config at ${configPath}`, { stage: 'config:load' })
  }

  const defaults = asRecord(asRecord(parsed)?.['defaults'])
  const registry = getModelRegistry()
  for (const [section, category] of [['llm', 'llm'], ['ocr', 'extract']] as const) {
    for (const [key, models] of Object.entries(asRecord(section === 'ocr' ? asRecord(defaults?.['extract'])?.['ocr'] : defaults?.[section]) ?? {})) {
      if (!Array.isArray(models)) continue
      const provider = section === 'ocr' ? key.replace(/Ocr$/, '') : key
      for (const model of models) {
        if (typeof model !== 'string' || !registry[category][provider]?.models[model]) throw ValidationError(`Unsupported configured ${section} model ${provider}/${String(model)}. Select an active model explicitly.`, { stage: 'config:load' })
      }
    }
  }
  validateTtsConfigAuthority(parsed)
  validateSttConfigAuthority(parsed)
  return validateData(AutoshowConfigSchema, parsed, 'autoshow config')
}

export const resolveMaxCents = (pricing: AutoshowConfig['pricing']): number | undefined =>
  pricing?.maxCents
