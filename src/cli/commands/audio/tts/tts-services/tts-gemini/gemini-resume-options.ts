import type { ProviderSettingsRecord, TtsOptions } from '~/types'
import { ttsMasteringFlags, ttsExportFlags } from '~/cli/flags/tts-delivery-flags'
import { UsageError } from '~/utils/error-handler'

const KEYS = ['geminiTtsVoice', 'geminiTtsInstructions', 'geminiTtsResponseFormat', 'geminiTtsMode', 'ttsSpeakers', 'ttsDialogue', 'ttsDialogueFormat', 'ttsCanonicalTurns', 'ttsTurnControls', 'ttsChunking', 'ttsDelivery', 'ttsExport', 'ttsPronunciationLexicon', 'ttsPronunciationsPath'] as const
export const recordGeminiResumeOptions = (options: TtsOptions) => Object.fromEntries(KEYS.flatMap(key => {
  const value = Reflect.get(options, key)
  return value === undefined ? [] : [[key, value]]
}))
export const restoreGeminiResumeOptions = (options: TtsOptions, settings?: ProviderSettingsRecord, explicitFlags: ReadonlySet<string> = new Set()): void => {
  const saved = settings?.local?.['geminiResume']
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return
  const explicitShared: Partial<Record<typeof KEYS[number], readonly string[]>> = {
    ttsSpeakers: ['tts-speaker'], ttsDialogueFormat: ['tts-dialogue-format'],
    ttsChunking: ['tts-chunk-boundary', 'tts-chunk-size'],
    ttsDelivery: Object.keys(ttsMasteringFlags), ttsExport: Object.keys(ttsExportFlags),
    ttsPronunciationsPath: ['tts-pronunciations'], ttsPronunciationLexicon: ['tts-pronunciations'],
  }
  for (const key of KEYS) {
    if (explicitShared[key]?.some(flag => explicitFlags.has(flag))) continue
    const retained = Reflect.get(saved, key), requested = Reflect.get(options, key)
    if (key.startsWith('geminiTts') && requested !== undefined && retained !== undefined && requested !== retained) throw UsageError('Gemini resume cannot override retained synthesis settings; start an explicit new run.')
    if (retained !== undefined) Reflect.set(options, key, retained)
  }
}
