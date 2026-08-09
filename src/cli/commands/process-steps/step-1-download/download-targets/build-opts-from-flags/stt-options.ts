import type { BuildDomainOptionsContext, RuntimeOptions, SttRuntimeOptionKey } from '~/types'
import {
  parseFloatWithDefault,
  parseIntWithDefault,
  parseOptionalPositiveIntFlag,
  readBooleanFlag,
  readOptionalStringFlag
} from '../options/flag-readers'
import { resolveLocalConcurrency, resolveProviderConcurrency } from './concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { pick } from '~/utils/cli-utils'

const STT_MODEL_KEYS = [
  'whisperModels', 'whisperModel', 'whisperfileModels', 'whisperfileModel',
  'deepinfraSttModels', 'deepinfraSttModel', 'groqSttModels', 'groqSttModel',
  'grokSttModels', 'grokSttModel', 'deepgramSttModels', 'deepgramSttModel',
  'sonioxSttModels', 'sonioxSttModel', 'speechmaticsSttModels', 'speechmaticsSttModel',
  'revSttModels', 'revSttModel', 'mistralSttModels', 'mistralSttModel',
  'assemblyaiSttModels', 'assemblyaiSttModel', 'gladiaSttModels', 'gladiaSttModel',
  'happyscribeSttModels', 'happyscribeSttModel', 'supadataSttModels', 'supadataSttModel',
  'scrapecreatorsSttModels', 'scrapecreatorsSttModel', 'geminiSttModels', 'geminiSttModel',
  'togetherSttModels', 'togetherSttModel',
] as const satisfies readonly SttRuntimeOptionKey[]

export const buildSttOptions = (ctx: BuildDomainOptionsContext): Pick<RuntimeOptions, SttRuntimeOptionKey> => {
  const { mergedFlags, explicitFlags, configuredFlags, allShortcutFlags, modelOptions } = ctx

  return {
    ...pick(modelOptions, STT_MODEL_KEYS),
    happyscribeOrganizationId: readOptionalStringFlag(mergedFlags, 'stt-happyscribe-organization-id'),
    supadataLang: readOptionalStringFlag(mergedFlags, 'stt-supadata-lang'),
    scrapecreatorsLang: readOptionalStringFlag(mergedFlags, 'stt-scrapecreators-lang') ?? 'en',
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    sttProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'stt-provider-concurrency', allShortcutFlags['all-stt'], 8, explicitFlags, configuredFlags),
    sttLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'stt-local-concurrency', explicitFlags, configuredFlags),
    sttSegmentConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-segment-concurrency'), DEFAULT_CLI_CONCURRENCY)),
    sttPreflightConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-preflight-concurrency'), DEFAULT_CLI_CONCURRENCY)),
    reverbVerbatimicity: parseFloatWithDefault(readOptionalStringFlag(mergedFlags, 'stt-reverb-verbatimicity'), 0.5),
    split: readBooleanFlag(mergedFlags, 'split'),
  }
}
