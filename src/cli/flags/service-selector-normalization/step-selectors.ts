import { CLIUsageError } from '~/utils/error-handler'
import type { CliFlagOccurrence, SelectorNormalizationResult } from '~/types'
import { resolveProviderSelector } from './flag-helpers'
import { applyFlagOccurrenceNormalization, replaceFlagOccurrence } from './occurrence-normalization'
import { BOOLEAN_PROVIDER_TARGETS, STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './provider-targets'

const writeSelectorTargetsByFlag = {
  stt: WRITE_STT_PROVIDER_TARGETS,
  ocr: WRITE_OCR_PROVIDER_TARGETS,
  llm: WRITE_LLM_PROVIDER_TARGETS
} as const satisfies Record<string, Record<string, string>>

const configSelectorTargetsByFlag = {
  stt: WRITE_STT_PROVIDER_TARGETS,
  ocr: WRITE_OCR_PROVIDER_TARGETS,
  llm: WRITE_LLM_PROVIDER_TARGETS,
  tts: STANDALONE_TTS_PROVIDER_TARGETS,
  image: STANDALONE_IMAGE_PROVIDER_TARGETS,
  video: STANDALONE_VIDEO_PROVIDER_TARGETS,
  music: STANDALONE_MUSIC_PROVIDER_TARGETS
} as const satisfies Record<string, Record<string, string>>

const writeAllProvidersTargets = {
  stt: 'all-stt',
  ocr: 'all-ocr',
  url: 'all-url',
  llm: 'all-llm'
} as const satisfies Record<string, string>

const writeAllLocalTargets = {
  stt: 'all-local-stt',
  ocr: 'all-local-ocr',
  url: 'all-local-url'
} as const satisfies Partial<Record<keyof typeof writeAllProvidersTargets, string>>

const writeAllSelectorSteps = 'stt, ocr, url, or llm'
const writeAllLocalSelectorSteps = 'stt, ocr, or url'

const normalizeStepSelectorOccurrences = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[],
  selectorTargets: Record<string, Record<string, string>>,
  allProvidersTargets?: Record<string, string>,
  allLocalTargets?: Partial<Record<string, string>>,
  allSelectorSteps?: string,
  allLocalSelectorSteps?: string
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

    if (occurrence.name !== 'all-providers' && occurrence.name !== 'all-local') {
      return undefined
    }

    if (!allProvidersTargets || !allLocalTargets || !allSelectorSteps || !allLocalSelectorSteps) {
      return undefined
    }

    const flagName = occurrence.name
    const targetsByStep = flagName === 'all-providers'
      ? allProvidersTargets
      : allLocalTargets
    const value = occurrence.value
    if (value === true || value === false) {
      throw CLIUsageError(`--${flagName} requires a step: ${allSelectorSteps}.`)
    }
    const step = value.trim().toLowerCase()
    if (!(step in allProvidersTargets)) {
      throw CLIUsageError(`Invalid --${flagName} step "${value}". Expected ${allSelectorSteps}.`)
    }
    const target = targetsByStep[step]
    if (!target) {
      throw CLIUsageError(`--${flagName} does not support step "${value}". Expected ${allLocalSelectorSteps}.`)
    }
    return [replaceFlagOccurrence(occurrence, target, true)]
  })

export const normalizeWriteStepSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): SelectorNormalizationResult =>
  normalizeStepSelectorOccurrences(
    flags,
    explicitFlags,
    flagOccurrences,
    writeSelectorTargetsByFlag,
    writeAllProvidersTargets,
    writeAllLocalTargets,
    writeAllSelectorSteps,
    writeAllLocalSelectorSteps
  )

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
