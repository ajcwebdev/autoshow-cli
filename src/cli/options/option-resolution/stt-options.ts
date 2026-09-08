import type { ResolvedFlagContext, SttRuntimeOptions, SttRuntimeOptionKey } from '~/types'
import {
  parseIntWithDefault,
  parseOptionalPositiveIntFlag,
  readBooleanFlag,
  readOptionalStringFlag
} from './flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { pick } from '~/utils/cli-utils'
import { UsageError } from '~/utils/error-handler'

export const STT_MODEL_KEYS = [
  'whisperModels', 'whisperfileModels',
  'deepinfraSttModels', 'groqSttModels',
  'grokSttModels', 'deepgramSttModels',
  'sonioxSttModels', 'speechmaticsSttModels',
  'mistralSttModels',
  'assemblyaiSttModels', 'gladiaSttModels',
  'happyscribeSttModels', 'supadataSttModels',
  'scrapecreatorsSttModels', 'geminiSttModels',
  'togetherSttModels',
] as const satisfies readonly SttRuntimeOptionKey[]

export const buildSttOptions = (ctx: ResolvedFlagContext): SttRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx
  const sttAudioProfile = readOptionalStringFlag(mergedFlags, 'stt-audio-profile')
  if (sttAudioProfile !== undefined && sttAudioProfile !== 'default' && sttAudioProfile !== 'lossless') throw UsageError('--stt-audio-profile must be default or lossless.')

  return {
    sttAudioProfile,
    ...pick(modelOptions, STT_MODEL_KEYS),
    happyscribeOrganizationId: readOptionalStringFlag(mergedFlags, 'stt-happyscribe-organization-id'),
    supadataLang: readOptionalStringFlag(mergedFlags, 'stt-supadata-lang'),
    scrapecreatorsLang: readOptionalStringFlag(mergedFlags, 'stt-scrapecreators-lang') ?? 'en',
    grokSttVerbatim: readBooleanFlag(mergedFlags, 'stt-grok-verbatim'),
    supadataChunkSize: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'stt-supadata-chunk-size'), 'stt-supadata-chunk-size'),
    deepinfraSttResponseFormat: readOptionalStringFlag(mergedFlags, 'deepinfra-stt-response-format'),
    captionExportFlags: mergedFlags['captions'] === true ? Object.fromEntries(Object.entries(mergedFlags).filter(([key]) => key.startsWith('caption-') || key === 'embed-captions')) : undefined,
    nativeSubtitles: readBooleanFlag(mergedFlags, 'native-subtitles'),
    diarization: typeof mergedFlags['diarization'] === 'boolean' ? mergedFlags['diarization'] : undefined,
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    sttProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'stt-provider-concurrency', allShortcutFlags['all-stt'], explicitFlags, configuredFlags),
    sttLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'stt-local-concurrency', explicitFlags, configuredFlags),
    sttSegmentConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-segment-concurrency'), DEFAULT_CLI_CONCURRENCY)),
    sttPreflightConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-preflight-concurrency'), DEFAULT_CLI_CONCURRENCY)),
    split: readBooleanFlag(mergedFlags, 'split'),
  }
}
