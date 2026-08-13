import { AutoshowConfigSchema } from '~/types/index'
import { validateData } from '~/utils/validate/validation'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type { AutoshowConfig } from '~/types/index'
import { validateTtsSynthesisCreationOptions } from '~/cli/commands/process-steps/step-4-tts/synthesis-creation-guard'
import { resolveStandaloneMistralTtsCliReferenceInput } from '~/cli/options/option-resolution/tts-options'

const CONFIG_CREATION_FLAG_BY_KEY = {
  mistralTtsVoiceName: 'mistral-tts-voice-name',
  elevenlabsTtsRefAudio: 'elevenlabs-tts-ref-audio',
  elevenlabsTtsVoiceName: 'elevenlabs-tts-voice-name',
  elevenlabsTtsCloneRemoveBackgroundNoise: 'elevenlabs-tts-clone-remove-background-noise',
  speechifyTtsRefAudio: 'speechify-tts-ref-audio',
  speechifyTtsVoiceName: 'speechify-tts-voice-name',
  speechifyTtsConsentName: 'speechify-tts-consent-name',
  speechifyTtsConsentEmail: 'speechify-tts-consent-email',
  speechifyTtsVoiceLocale: 'speechify-tts-voice-locale',
  speechifyTtsVoiceGender: 'speechify-tts-voice-gender'
} as const

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined

const validateTtsConfigAuthority = (parsed: unknown): void => {
  const root = asRecord(parsed)
  const defaults = asRecord(root?.['defaults'])
  const post = asRecord(defaults?.['post'])
  const tts = asRecord(post?.['tts'])
  if (!tts) return

  const configuredFlags = new Set<string>()
  for (const [key, flag] of Object.entries(CONFIG_CREATION_FLAG_BY_KEY)) {
    if (key in tts) configuredFlags.add(flag)
  }
  validateTtsSynthesisCreationOptions(tts, { configuredFlags })
  resolveStandaloneMistralTtsCliReferenceInput({
    'mistral-tts-ref-audio': tts['mistralTtsRefAudio']
  }, {
    configuredFlags: new Set(['mistral-tts-ref-audio']),
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

  validateTtsConfigAuthority(parsed)
  return validateData(AutoshowConfigSchema, parsed, 'autoshow config')
}

export const resolveMaxCents = (pricing: AutoshowConfig['pricing']): number | undefined =>
  pricing?.maxCents
