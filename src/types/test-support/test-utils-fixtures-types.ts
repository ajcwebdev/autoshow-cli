import type { ExtractRoute, MultiSpeakerStrategy, ProcessCommand, RunCommandOptions, TtsTarget } from '~/types'

export type MockWavOptions = {
  sampleRate?: number | undefined
  channels?: number | undefined
  bitsPerSample?: 16 | undefined
  samples?: number | undefined
}

export type SyntheticWavOptions = {
  durationSeconds: number
  amplitude: number
  frequencyHz: number
  sampleRate?: number | undefined
}

export type ResolvedWavHeaderOptions = {
  sampleRate: number
  channels: number
  bitsPerSample: 16
}

export type OutputMetadataSummary = {
  estimatedCostCents: number | null
  actualCostCents: number | null
  estimatedProcessingTimeMs: number | null
  actualProcessingTimeMs: number | null
}

type MusicExpectedLyricsSource = 'provided' | 'generated' | 'none'

export type MusicServiceModelCase = {
  model: string
  prompt: string
  extraArgs?: string[]
  expectedLyricsSource?: MusicExpectedLyricsSource
  commandTimeoutMs?: number
  testTimeoutMs?: number
}

export type TtsExtraArgs = readonly string[] | ((model: string) => readonly string[] | Promise<readonly string[]>)

type VideoTestService = 'gemini' | 'minimax' | 'glm' | 'grok' | 'runway' | 'ltx' | 'replicate' | 'lumalabs' | 'fal'

type GenerationCommand = 'image' | 'video' | 'music'

export type GenerationServiceModelCase = { model: string, extraArgs?: string[] | undefined }

export type GenerationServiceOptions<TModel extends GenerationServiceModelCase> = {
  models: TModel[]
  provider: string
  service: string
  envVarKey: string
}

type GenerationArtifact = { fileName: string, fileSize: number }

export type GenerationServiceProfile<
  TModel extends GenerationServiceModelCase,
  TOptions extends GenerationServiceOptions<TModel>
> = {
  command: GenerationCommand
  outputTitle: string
  livePrompt: (modelCase: TModel) => string
  liveTestName: (modelCase: TModel, options: TOptions) => string
  artifactFileName: (modelCase: TModel, options: TOptions) => string
  envErrorMessage: (options: TOptions) => string
  metadataKey: string
  expectedMetadata: (modelCase: TModel, artifact: GenerationArtifact, options: TOptions) => Record<string, unknown>
  commandOptions?: ((modelCase: TModel) => RunCommandOptions | undefined) | undefined
  testTimeoutMs?: ((modelCase: TModel, options: TOptions) => number | undefined) | undefined
}

export type ImageServiceModelCase = {
  model: string
  prompt: string
  extraArgs?: string[]
  expectedExtension?: string
}

export type ImageServiceTestOptions = {
  models: ImageServiceModelCase[]
  provider: string
  imageService: string
  envVarKey: string
  imageExtension?: string
}

export type ImageGenerationOptions = ImageServiceTestOptions & GenerationServiceOptions<ImageServiceModelCase>

export type VideoServiceModelCase = { model: string, extraArgs?: string[], expectedDuration?: number, prompt?: string }

export type VideoServiceTestOptions = {
  models: VideoServiceModelCase[]
  provider: string
  videoService: VideoTestService
  envVarKey: string
  envVarDescription: string
  timeoutMs?: number
}

export type VideoGenerationOptions = VideoServiceTestOptions & GenerationServiceOptions<VideoServiceModelCase>

export type MusicServiceTestOptions = {
  models: MusicServiceModelCase[]
  provider: string
  musicService: string
  envVarKey: string
}

export type MusicGenerationOptions = MusicServiceTestOptions & GenerationServiceOptions<MusicServiceModelCase>

type MultiProviderManifestFixtureProvider = {
  dir: string
  provider: string
  model: string
  status?: 'succeeded' | 'missing' | 'failed' | 'skipped'
  processingTime?: number
  cost?: number
  result: Record<string, unknown>
}

export type MultiProviderManifestFixtureOptions = {
  command: ProcessCommand
  extractRoute?: ExtractRoute | undefined
  metadata?: Record<string, unknown>
  providerMetadata?: Record<string, unknown>
  providers: readonly MultiProviderManifestFixtureProvider[]
}

type PolicySkipIdentity = Pick<TtsTarget, 'service' | 'model' | 'transport' | 'targetKey'>

export type PolicySkippedTtsProviderStateOptions = {
  target: PolicySkipIdentity
  artifactDir: string
  skipId: string
  actorId?: string | undefined
  reason?: string | undefined
  at?: string | undefined
  local?: boolean | undefined
}

type TtsFixtureTargetMode =
  | { kind: 'success' }
  | { kind: 'reject' }
  | { kind: 'failBeforeDispatch' }
  | { kind: 'failAfterAdmission', sourceIndex?: number | undefined }
  | { kind: 'ambiguousRetry', attempts: number[], succeedOnAttempt: number, maxAttempts: number }

export type TtsFixtureTargetOptions = {
  mode: TtsFixtureTargetMode
  model: string
  service?: TtsTarget['service'] | undefined
  transport?: string | undefined
  voice?: string | undefined
  multiSpeakerStrategy?: MultiSpeakerStrategy | undefined
  requestShape?: 'flat' | 'nested' | undefined
  providerRequestId?: ((sourceIndex: number, attempt: number) => string) | undefined
  onRun?: ((sourceIndex: number) => void) | undefined
  audioBytes?: ((sourceIndex: number) => Uint8Array) | undefined
}
