import type { ProviderSettingsRecord, TtsOptions } from '~/types'
import { restoreSharedTtsResumeOptions } from '../../tts-utils/tts-resume-options'
import { UsageError } from '~/utils/error-handler'

const KEYS = ['geminiTtsVoice', 'geminiTtsInstructions', 'geminiTtsResponseFormat', 'geminiTtsMode'] as const
export const recordGeminiResumeOptions = (options: TtsOptions) => Object.fromEntries(KEYS.flatMap(key => {
  const value = Reflect.get(options, key)
  return value === undefined ? [] : [[key, value]]
}))
export const restoreGeminiResumeOptions = (options: TtsOptions, settings?: ProviderSettingsRecord, explicitFlags: ReadonlySet<string> = new Set()): void => {
  restoreSharedTtsResumeOptions(options, settings, explicitFlags)
  const saved = settings?.local?.['geminiResume']
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
  for (const key of KEYS) {
    const retained = Reflect.get(saved, key), requested = Reflect.get(options, key)
    if (key.startsWith('geminiTts') && requested !== undefined && retained !== undefined && requested !== retained) throw UsageError('Gemini resume cannot override retained synthesis settings; start an explicit new run.')
    if (retained !== undefined) Reflect.set(options, key, retained)
  }
}
