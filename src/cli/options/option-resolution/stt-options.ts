import type { ResolvedFlagContext, SttRuntimeOptions, SttRuntimeOptionKey } from '~/types'
import {
  parseOptionalPositiveIntFlag,
  readBooleanFlag,
  readOptionalStringFlag
} from './flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { pick } from '~/utils/cli-utils'
import { UsageError } from '~/utils/error-handler'
import { readSelectedSttProviders, resolveGenericSttOptionAssignments } from '~/cli/flags/service-selector-normalization/generic-stt-option-selectors'
import { sttControlsForFlag, type GenericSttOptionFlag } from '~/cli/flags/service-selector-normalization/generic-stt-controls'
import { normalizeControlValue } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { ALL_STEP_CONCURRENCY_SCOPES, resolveStepConcurrency, type StepConcurrencyScope } from '~/cli/flags/service-selector-normalization/step-concurrency-scopes'

// Bounds and allowed values come from the STT engine capability table; the flag layer only supplies
// CLI wording for the failure.
const sttControlUsageError = (provider: string, key: string, detail: string): Error =>
  UsageError(`--${key} for ${provider}: ${detail}.`)

const coerceSttOptionValue = (
  flagName: GenericSttOptionFlag,
  provider: string,
  value: string | boolean
): string | number | boolean => {
  const control = sttControlsForFlag(flagName)[provider]
  if (!control) throw UsageError(`--${flagName} does not apply to ${provider} STT.`)
  const spec = control.spec
  const raw = spec.kind === 'number'
    ? Number(value)
    : spec.kind === 'boolean'
      ? value === true || (typeof value === 'string' && !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase()))
      : String(value)
  return normalizeControlValue(
    provider as never,
    flagName,
    raw as never,
    spec,
    sttControlUsageError as never
  ) as string | number | boolean
}

export const STT_MODEL_KEYS = [
  'whisperfileModels',
  'deepinfraSttModels',
  'grokSttModels', 'deepgramSttModels',
  'sonioxSttModels', 'speechmaticsSttModels',
  'mistralSttModels',
  'assemblyaiSttModels', 'gladiaSttModels',
  'happyscribeSttModels', 'supadataSttModels',
  'scrapecreatorsSttModels', 'geminiSttModels',
  'togetherSttModels', 'openaiSttModels',
] as const satisfies readonly SttRuntimeOptionKey[]

export const buildSttOptions = (ctx: ResolvedFlagContext): SttRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions, flagOccurrences } = ctx
  const sttAudioProfile = readOptionalStringFlag(mergedFlags, 'stt-audio-profile')
  if (sttAudioProfile !== undefined && sttAudioProfile !== 'default' && sttAudioProfile !== 'lossless') throw UsageError('--stt-audio-profile must be default or lossless.')

  const stepConcurrency = (scope: StepConcurrencyScope): number | undefined =>
    resolveStepConcurrency(scope, ALL_STEP_CONCURRENCY_SCOPES, flagOccurrences ?? [], mergedFlags, configuredFlags).value

  const selectedSttProviders = readSelectedSttProviders(mergedFlags)
  const genericOption = (flagName: GenericSttOptionFlag, provider: string): string | number | boolean | undefined => {
    const assignments = resolveGenericSttOptionAssignments(mergedFlags, flagOccurrences ?? [], flagName, selectedSttProviders)
      .filter((assignment) => assignment.provider === provider)
    const assignment = assignments.at(-1)
    if (!assignment) return undefined
    return coerceSttOptionValue(flagName, provider, assignment.value)
  }

  return {
    sttAudioProfile,
    ...pick(modelOptions, STT_MODEL_KEYS),
    // CLI spellings are provider-general; the runtime fields stay provider-specific because
    // provider-specific adapters consume them and they round-trip through resume state.
    happyscribeOrganizationId: genericOption('stt-organization-id', 'happyscribe') as string | undefined,
    supadataLang: genericOption('stt-language', 'supadata') as string | undefined,
    scrapecreatorsLang: (genericOption('stt-language', 'scrapecreators') as string | undefined) ?? 'en',
    grokSttVerbatim: (genericOption('stt-verbatim', 'grok') as boolean | undefined) === true,
    supadataChunkSize: genericOption('stt-chunk-size', 'supadata') as number | undefined,
    deepinfraSttResponseFormat: genericOption('stt-response-format', 'deepinfra') as string | undefined,
    captionExportFlags: mergedFlags['captions'] === true ? Object.fromEntries(Object.entries(mergedFlags).filter(([key]) => key.startsWith('caption-') || key === 'embed-captions')) : undefined,
    nativeSubtitles: readBooleanFlag(mergedFlags, 'native-subtitles'),
    diarization: typeof mergedFlags['diarization'] === 'boolean' ? mergedFlags['diarization'] : undefined,
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    sttProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'stt-provider-concurrency', allShortcutFlags['all-stt'], explicitFlags, configuredFlags),
    sttLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'stt-local-concurrency', explicitFlags, configuredFlags),
    sttSegmentConcurrency: Math.max(1, stepConcurrency('stt-segment') ?? DEFAULT_CLI_CONCURRENCY),
    sttPreflightConcurrency: Math.max(1, stepConcurrency('stt-preflight') ?? DEFAULT_CLI_CONCURRENCY),
    split: readBooleanFlag(mergedFlags, 'split'),
  }
}
