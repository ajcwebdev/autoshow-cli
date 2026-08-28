import type {
  AsyncSttLifecycleOptions,
  BunImageEncoder,
  HostedOcrSchedulerSetTimer,
  MetricName,
  ModelRegistry,
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

type HelperBudgetKeySpecBase = {
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

export type SnapshotFixtureOptions = {
  assetPath?: string | ((canonicalPath: string) => string)
  registeredSha256?: string
  schemaVersion?: number
}

export type ModelBinding = {
  configPath: readonly string[]
  registryStep: keyof ModelRegistry
  service: string
}

export type ProviderSections = Record<string, string[]>

export type Deferred<T = void> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

export type SchedulerClock = {
  now: () => number
  setTimer: HostedOcrSchedulerSetTimer
  advance: (durationMs: number) => Promise<void>
  timerCount: () => number
}

export type MatrixStatus = {
  state: 'queued' | 'completed'
}

type MatrixTranscript = {
  text: string
}

export type MatrixOptions = AsyncSttLifecycleOptions<MatrixStatus, MatrixTranscript, string>

export type ClientCase = {
  name: string
  request: () => Promise<unknown>
  errorName: string
  bodyPolicy: 'raw-text' | 'parsed'
}

export type E2eTestSource = {
  file: string
  source: string
}

export type SelectorExpectation = {
  sections: readonly string[]
  expected: string[]
  outputFileName?: string | undefined
}

export type ProviderSelectorCase = {
  name: string
  provider: string
  all?: { expected: string[], outputFileName?: string | undefined } | undefined
  selections: readonly SelectorExpectation[]
  invalid?: { sections: readonly string[], message: string } | undefined
  additionalAssertions?: (() => Promise<void> | void) | undefined
}

export type SourceVocabularyViolation = {
  file: string
  line: number
  text: string
}
