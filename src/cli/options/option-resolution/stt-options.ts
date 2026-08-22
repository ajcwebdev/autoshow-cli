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

export const STT_MODEL_KEYS = [
  'whisperModels', 'whisperfileModels',
  'deepinfraSttModels', 'groqSttModels',
  'grokSttModels', 'deepgramSttModels',
  'sonioxSttModels', 'speechmaticsSttModels',
  'revSttModels', 'mistralSttModels',
  'assemblyaiSttModels', 'gladiaSttModels',
  'happyscribeSttModels', 'supadataSttModels',
  'scrapecreatorsSttModels', 'geminiSttModels',
  'togetherSttModels',
] as const satisfies readonly SttRuntimeOptionKey[]

export const buildSttOptions = (ctx: ResolvedFlagContext): SttRuntimeOptions => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx

  return {
    ...pick(modelOptions, STT_MODEL_KEYS),
    happyscribeOrganizationId: readOptionalStringFlag(mergedFlags, 'stt-happyscribe-organization-id'),
    supadataLang: readOptionalStringFlag(mergedFlags, 'stt-supadata-lang'),
    scrapecreatorsLang: readOptionalStringFlag(mergedFlags, 'stt-scrapecreators-lang') ?? 'en',
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    sttProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'stt-provider-concurrency', allShortcutFlags['all-stt'], explicitFlags, configuredFlags),
    sttLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'stt-local-concurrency', explicitFlags, configuredFlags),
    sttSegmentConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-segment-concurrency'), DEFAULT_CLI_CONCURRENCY)),
    sttPreflightConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-preflight-concurrency'), DEFAULT_CLI_CONCURRENCY)),
    split: readBooleanFlag(mergedFlags, 'split'),
  }
}
