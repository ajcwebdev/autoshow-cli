import type { SelectorNormalizationResult } from '~/types'
import { appendFlagValue, occurrenceValues } from '~/cli/flags/service-selector-normalization/flag-helpers'

export const normalizeLegacyMultiSpeakerFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>
): SelectorNormalizationResult => {
  const normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)

  const s1Name = typeof normalizedFlags['gemini-speaker-1-name'] === 'string' ? normalizedFlags['gemini-speaker-1-name'].trim() : ''
  const s1Voice = typeof normalizedFlags['gemini-speaker-1-voice'] === 'string' ? normalizedFlags['gemini-speaker-1-voice'].trim() : ''
  const s2Name = typeof normalizedFlags['gemini-speaker-2-name'] === 'string' ? normalizedFlags['gemini-speaker-2-name'].trim() : ''
  const s2Voice = typeof normalizedFlags['gemini-speaker-2-voice'] === 'string' ? normalizedFlags['gemini-speaker-2-voice'].trim() : ''

  if (s1Name && s1Voice && s2Name && s2Voice) {
    appendFlagValue(normalizedFlags, 'tts-speaker', `${s1Name}=${s1Voice}`)
    appendFlagValue(normalizedFlags, 'tts-speaker', `${s2Name}=${s2Voice}`)
    if (
      typeof normalizedFlags['tts-dialogue-format'] !== 'string'
      || normalizedFlags['tts-dialogue-format'].trim().length === 0
    ) {
      normalizedFlags['tts-dialogue-format'] = 'labeled'
    }
    normalizedExplicitFlags.add('tts-speaker')
  }

  const refAudios = occurrenceValues(normalizedFlags['tts-speaker-ref-audio'])
  for (const value of refAudios) {
    if (typeof value === 'string') {
      appendFlagValue(normalizedFlags, 'tts-speaker', value)
      normalizedExplicitFlags.add('tts-speaker')
    }
  }

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags
  }
}
