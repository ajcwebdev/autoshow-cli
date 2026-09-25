import type { ProviderSettingsRecord, TtsOptions } from '~/types'
import { ttsMasteringFlags, ttsExportFlags } from '~/cli/flags/tts-delivery-flags'

const FLAGS = {
  sonioxTtsVoice: ['tts-voice'], sonioxTtsLanguage: ['tts-language'], sonioxTtsSpeed: ['tts-speed'],
  ttsSpeakers: ['tts-speaker'], ttsDialogueFormat: ['tts-dialogue-format'],
  ttsDialogue: [], ttsCanonicalTurns: [], ttsTurnControls: [],
  ttsChunking: ['tts-chunk-boundary', 'tts-chunk-size'],
  ttsDelivery: Object.keys(ttsMasteringFlags), ttsExport: Object.keys(ttsExportFlags),
  ttsPronunciationLexicon: ['tts-pronunciations'], ttsPronunciationsPath: ['tts-pronunciations'],
} as const

export const recordSonioxResumeOptions = (options: TtsOptions) => Object.fromEntries(Object.keys(FLAGS).flatMap(key => {
  const value = Reflect.get(options, key)
  return value === undefined ? [] : [[key, value]]
}))

export const restoreSonioxResumeOptions = (options: TtsOptions, settings?: ProviderSettingsRecord, explicitFlags: ReadonlySet<string> = new Set()): void => {
  const saved = settings?.local?.['sonioxResume']
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
  for (const [key, flags] of Object.entries(FLAGS)) {
    if (flags.some(flag => explicitFlags.has(flag))) continue
    const value = Reflect.get(saved, key)
    if (value !== undefined) Reflect.set(options, key, value)
  }
  // Explicit changes are checked against the retained plan before any dispatch.
}
