import type { ProviderSettingsRecord, TtsOptions } from '~/types'
import { ttsMasteringFlags, ttsExportFlags } from '~/cli/flags/tts-delivery-flags'

const FLAGS = {
  ttsSpeakers: ['tts-speaker'], ttsDialogueFormat: ['tts-dialogue-format'],
  ttsDialogue: [], ttsCanonicalTurns: [], ttsTurnControls: [],
  ttsChunking: ['tts-chunk-boundary', 'tts-chunk-size'],
  ttsDelivery: Object.keys(ttsMasteringFlags), ttsExport: Object.keys(ttsExportFlags),
  ttsPronunciationLexicon: ['tts-pronunciations'], ttsPronunciationsPath: ['tts-pronunciations'],
  ttsTextPreflight: ['tts-text-preflight'],
} as const

export const recordSharedTtsResumeOptions = (options: TtsOptions): Record<string, unknown> => ({
  ...Object.fromEntries(Object.keys(FLAGS).flatMap(key => {
    const value = Reflect.get(options, key)
    return value === undefined ? [] : [[key, value]]
  })),
  ttsChunking: options.ttsChunking ?? { boundary: 'smart' },
})

export const restoreSharedTtsResumeOptions = (options: TtsOptions, settings?: ProviderSettingsRecord, explicitFlags: ReadonlySet<string> = new Set()): void => {
  const local = settings?.local
  if (!local) return
  const modern = local['ttsResume']
  const saved = modern ?? local['geminiResume'] ?? local['sonioxResume']
  const values: Record<string, unknown> = saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...saved } : {}
  if (!modern) {
    const chunk = values['ttsChunking'] ?? local['chunking']
    if (chunk && typeof chunk === 'object') {
      const maxChars = Reflect.get(chunk, 'maxChars') ?? Reflect.get(chunk, 'requestedMaxChars')
      values['ttsChunking'] = { boundary: 'smart', replay: Reflect.get(chunk, 'boundary') === 'smart' ? 'smart-v1' : 'legacy-v0', ...(maxChars !== undefined ? { maxChars } : {}) }
    }
    if (!values['ttsDelivery'] && local['delivery']) values['ttsDelivery'] = local['delivery']
  }
  for (const [key, flags] of Object.entries(FLAGS)) {
    if (flags.some(flag => explicitFlags.has(flag))) continue
    const value = values[key]
    if (value !== undefined) Reflect.set(options, key, value)
  }
}
