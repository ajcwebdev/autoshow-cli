import type { ProviderIdentityBase, TranscribeEngine } from '~/types'

export type AudioVariant = {
  path: string
  kind: 'compression' | 'speed'
  label: string
  bitrateKbps?: number | undefined
  speedMultiplier?: number | undefined
}

export type SttServiceSpec = ProviderIdentityBase<TranscribeEngine> & {
  envVar: string | undefined
}

// Mirrors ResolveRuntimeToolOptions: the filesystem probe is injectable so both arms of local
// service availability can be pinned without depending on what is installed on the test machine.
export type BenchmarkServiceResolutionOptions = {
  exists?: ((path: string) => boolean) | undefined
}

export type VariantTranscription = ProviderIdentityBase & {
  variant: AudioVariant
  text: string
  processingTimeMs: number
  error?: string | undefined
}

export type BenchmarkAttemptStatus = 'started' | 'success' | 'error'

export type BenchmarkAttemptRecord = ProviderIdentityBase & {
  kind: 'benchmark-attempt'
  schemaVersion: 1
  status: BenchmarkAttemptStatus
  variant: {
    kind: 'compression' | 'speed'
    label: string
    bitrateKbps?: number | undefined
    speedMultiplier?: number | undefined
  }
  processingTimeMs?: number | undefined
  error?: string | undefined
}


export type BenchmarkScoreEntry = ProviderIdentityBase & {
  variant: {
    kind: 'compression' | 'speed'
    label: string
    bitrateKbps?: number | undefined
    speedMultiplier?: number | undefined
  }
  wer: number
  substitutions: number
  deletions: number
  insertions: number
  referenceWordCount: number
  processingTimeMs: number
  error?: string | undefined
}

export type BenchmarkReport = {
  timestamp: string
  sourceAudio: string
  referenceService: string
  referenceModel: string
  referenceWordCount: number
  variants: BenchmarkAttemptRecord['variant'][]
  services: ProviderIdentityBase[]
  attempts: {
    total: number
    succeeded: number
    failed: number
  }
  errors: {
    variant: BenchmarkAttemptRecord['variant']
    service: ProviderIdentityBase['service']
    model: ProviderIdentityBase['model']
    processingTimeMs: number
    error: string
  }[]
  compressionResults: BenchmarkScoreEntry[]
  speedResults: BenchmarkScoreEntry[]
  summary: {
    bestCompressionThreshold: {
      service: ProviderIdentityBase['service']
      model: ProviderIdentityBase['model']
      minBitrateKbps: number
      werAtThreshold: number
    } | null
    bestSpeedThreshold: {
      service: ProviderIdentityBase['service']
      model: ProviderIdentityBase['model']
      maxSpeed: number
      werAtThreshold: number
    } | null
    serviceRankings: Array<ProviderIdentityBase & {
      averageWer: number
    }>
  }
}

export type BenchmarkFlags = {
  tts?: boolean | undefined
  text?: boolean | undefined
  image?: boolean | undefined
  video?: boolean | undefined
  bitrates: string
  speeds: string
  'stt-services'?: string | undefined
  'reference-stt': string
  'skip-compression': boolean
  'skip-speed': boolean
  'tts-input-text'?: string | undefined
  'tts-mode'?: string | undefined
  'tts-roundtrip-dir'?: string | undefined
  'tts-metric-fixtures'?: string | undefined
  'tts-audio-judge-model'?: string | undefined
  'tts-keep-temp'?: boolean | undefined
  'image-judge-model'?: string | undefined
  'video-judge-model'?: string | undefined
}
