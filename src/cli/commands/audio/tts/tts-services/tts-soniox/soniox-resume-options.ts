import type { ProviderSettingsRecord, TtsOptions } from '~/types'
import { restoreSharedTtsResumeOptions } from '../../tts-utils/tts-resume-options'

const FLAGS = {
  sonioxTtsVoice: ['tts-voice'], sonioxTtsLanguage: ['tts-language'], sonioxTtsSpeed: ['tts-speed'],
} as const

export const recordSonioxResumeOptions = (options: TtsOptions) => Object.fromEntries(Object.keys(FLAGS).flatMap(key => {
  const value = Reflect.get(options, key)
  return value === undefined ? [] : [[key, value]]
}))

export const restoreSonioxResumeOptions = (options: TtsOptions, settings?: ProviderSettingsRecord, explicitFlags: ReadonlySet<string> = new Set()): void => {
  restoreSharedTtsResumeOptions(options, settings, explicitFlags)
  const saved = settings?.local?.['sonioxResume']
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
  for (const [key, flags] of Object.entries(FLAGS)) {
    if (flags.some(flag => explicitFlags.has(flag))) continue
    const value = Reflect.get(saved, key)
    if (value !== undefined) Reflect.set(options, key, value)
  }
  // Explicit changes are checked against the retained plan before any dispatch.
}
