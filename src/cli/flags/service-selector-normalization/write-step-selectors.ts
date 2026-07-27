import { CLIUsageError } from '~/utils/error-handler'
import type { SelectorNormalizationResult } from '~/types'
import { appendProviderSelector, normalizeProviderSelectorArgs, occurrenceValues, setBooleanFlag } from './flag-helpers'
import { BOOLEAN_PROVIDER_TARGETS, STANDALONE_IMAGE_PROVIDER_TARGETS, STANDALONE_MUSIC_PROVIDER_TARGETS, STANDALONE_TTS_PROVIDER_TARGETS, STANDALONE_VIDEO_PROVIDER_TARGETS, WRITE_LLM_PROVIDER_TARGETS, WRITE_OCR_PROVIDER_TARGETS, WRITE_STT_PROVIDER_TARGETS } from './provider-targets'

export const writeSelectorTargetsByFlag = {
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
  llm: 'all-llm',
  tts: 'all-tts',
  image: 'all-image',
  video: 'all-video',
  music: 'all-music'
} as const satisfies Record<string, string>

const writeAllLocalTargets = {
  stt: 'all-local-stt',
  ocr: 'all-local-ocr',
  url: 'all-local-url',
  llm: 'all-local-llm',
  tts: 'all-local-tts'
} as const satisfies Partial<Record<keyof typeof writeAllProvidersTargets, string>>

const writeAllSelectorSteps = 'stt, ocr, url, llm, tts, image, video, or music'
const writeAllLocalSelectorSteps = 'stt, ocr, url, llm, or tts'

export const normalizeWriteStepSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  rawArgs?: string[] | undefined
): SelectorNormalizationResult => {
  let normalizedFlags: Record<string, unknown> = { ...flags }
  const normalizedExplicitFlags = new Set(explicitFlags)
  let normalizedArgs = rawArgs ? [...rawArgs] : undefined

  for (const [selectorFlag, targetByProvider] of Object.entries(writeSelectorTargetsByFlag)) {
    const values = occurrenceValues(normalizedFlags[selectorFlag])
    if (values.length === 0) {
      continue
    }
    delete normalizedFlags[selectorFlag]
    normalizedExplicitFlags.delete(selectorFlag)
    for (const value of values) {
      normalizedExplicitFlags.add(
        appendProviderSelector(normalizedFlags, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS, value)
      )
    }
    if (normalizedArgs) {
      normalizedArgs = normalizeProviderSelectorArgs(normalizedArgs, selectorFlag, targetByProvider, BOOLEAN_PROVIDER_TARGETS)
    }
  }

  const normalizeAllStepSelector = (
    flagName: 'all-providers' | 'all-local',
    targetsByStep: Partial<Record<keyof typeof writeAllProvidersTargets, string>>
  ): void => {
    for (const value of occurrenceValues(normalizedFlags[flagName])) {
      if (value === true) {
        throw CLIUsageError(`--${flagName} requires a step: ${writeAllSelectorSteps}.`)
      }
      const step = value.trim().toLowerCase()
      if (!(step in writeAllProvidersTargets)) {
        throw CLIUsageError(`Invalid --${flagName} step "${value}". Expected ${writeAllSelectorSteps}.`)
      }
      const target = targetsByStep[step as keyof typeof writeAllProvidersTargets]
      if (!target) {
        throw CLIUsageError(`--${flagName} does not support step "${value}". Expected ${writeAllLocalSelectorSteps}.`)
      }
      setBooleanFlag(normalizedFlags, target)
      normalizedExplicitFlags.add(target)
    }
    delete normalizedFlags[flagName]
    normalizedExplicitFlags.delete(flagName)
  }

  normalizeAllStepSelector('all-providers', writeAllProvidersTargets)
  normalizeAllStepSelector('all-local', writeAllLocalTargets)

  return {
    flags: normalizedFlags,
    explicitFlags: normalizedExplicitFlags,
    rawArgs: normalizedArgs
  }
}
