import type {
  BunImageEncoder,
  MetricName,
  ProviderIdentity,
  ProviderIdentityBase,
  ProviderResumeEntry,
  TargetPoolKind
} from '~/types'

export type ComicBunImageCodec = {
  webp: () => BunImageEncoder
  jpeg: () => BunImageEncoder
}

export type OcrBunImageCodec = {
  webp: () => BunImageEncoder
}
export type SttNormalizationMetricRankingEntry = {
  rank: number
  providerKey: string
  metric: MetricName
  value: number | null
  label: string
  score: number | null
  speakerAwareWER: number | null
  textOnlyWER: number | null
  diarizationSupport: string | null
}

export type SchedulerTestTarget = ProviderIdentityBase & {
  pool: TargetPoolKind
  delayMs: number
  priority?: number | undefined
  fail?: boolean | undefined
}

export type ResumeFakeMetadata = ProviderIdentityBase & { processingTime: number }

export type ResumeFakeProviderResumeEntry = ProviderResumeEntry<ProviderIdentity, Record<string, never>>

export type HelperBudgetKeySpecBase = {
  callName: string
  prefix: string
  modelMode: 'strings' | 'objects'
}

export type HelperBudgetKeySpec =
  | (HelperBudgetKeySpecBase & { serviceProperty: string; serviceFromCliFlag?: false })
  | (HelperBudgetKeySpecBase & { serviceFromCliFlag: true; serviceProperty?: never })

export type SetupTarEntry =
  | { type: 'directory', path: string, mode?: number }
  | { type: 'file', path: string, content: string, mode?: number }
  | { type: 'symlink', path: string, linkName: string, mode?: number }
