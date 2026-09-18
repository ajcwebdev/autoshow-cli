import type { CliFlagOccurrence, SelectorNormalizationResult } from '~/types'
import { resolveProviderSelector } from './flag-helpers'
import { applyFlagOccurrenceNormalization, replaceFlagOccurrence } from './occurrence-normalization'
import { BOOLEAN_PROVIDER_TARGETS, STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './provider-targets'


const configSelectorTargetsByFlag = {
  stt: WRITE_STT_PROVIDER_TARGETS,
  ocr: WRITE_OCR_PROVIDER_TARGETS,
  llm: WRITE_LLM_PROVIDER_TARGETS,
  tts: STANDALONE_TTS_PROVIDER_TARGETS,
  image: STANDALONE_IMAGE_PROVIDER_TARGETS,
  video: STANDALONE_VIDEO_PROVIDER_TARGETS,
  music: STANDALONE_MUSIC_PROVIDER_TARGETS
} as const satisfies Record<string, Record<string, string>>




const normalizeStepSelectorOccurrences = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  selectorTargets: Record<string, Record<string, string>>
): SelectorNormalizationResult =>
  applyFlagOccurrenceNormalization(flags, explicitFlags, flagOccurrences, (occurrence) => {
    const providerTargets = selectorTargets[occurrence.name]
    if (providerTargets) {
      if (occurrence.value === false) {
        return []
      }
      const { target, model } = resolveProviderSelector(
        occurrence.value,
        occurrence.name,
        providerTargets,
        BOOLEAN_PROVIDER_TARGETS
      )
      return [replaceFlagOccurrence(
        occurrence,
        target,
        model,
        BOOLEAN_PROVIDER_TARGETS.has(target) ? 'set' : 'append'
      )]
    }

    return undefined
  })

export const normalizeConfigStepSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): SelectorNormalizationResult =>
  normalizeStepSelectorOccurrences(
    flags,
    explicitFlags,
    flagOccurrences,
    configSelectorTargetsByFlag
  )
