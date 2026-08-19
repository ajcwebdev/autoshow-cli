import type {
  CurrentTtsCompletedRecovery,
  CurrentTtsPartialRecovery,
  CurrentTtsResumePricePlan,
  CurrentTtsSafeRedispatch,
  MockFetchCall,
  PipelineProviderState,
  PureCurrentTtsRenderPlanOptions,
  TtsProvider,
  TtsTarget,
  TtsTargetInvocationControls
} from '~/types'

// Reverse-derived from MATRIX_ENV_KEYS in tts-explicit-voice-dispatch.test.ts; that
// const is constrained with `satisfies readonly TtsVoiceMatrixEnvKey[]` so widening it
// without widening this union fails tsc.
export type TtsVoiceMatrixEnvKey =
  | 'ELEVENLABS_API_KEY'
  | 'SPEECHIFY_API_KEY'
  | 'HUME_API_KEY'
  | 'CARTESIA_API_KEY'
  | 'MISTRAL_API_KEY'
  | 'OPENAI_API_KEY'
  | 'GROQ_API_KEY'
  | 'XAI_API_KEY'
  | 'MINIMAX_API_KEY'
  | 'DEEPGRAM_API_KEY'
  | 'GEMINI_API_KEY'

export type VoiceMatrixCase = {
  provider: TtsProvider
  envKey: TtsVoiceMatrixEnvKey
  flags: Record<string, unknown>
  capturedVoice: string
  invocationVoices: readonly [string, string, string]
  invocationControls: readonly [TtsTargetInvocationControls, TtsTargetInvocationControls, TtsTargetInvocationControls]
  respond: (call: MockFetchCall) => Response
  isSynthesisRequest?: ((call: MockFetchCall) => boolean) | undefined
  readSerializedVoice: (call: MockFetchCall) => string | undefined
  readSerializedControl: (call: MockFetchCall) => unknown
}

export type HostedFixture = {
  target: TtsTarget
  calls: { run: number, setup: number, fetch: number }
}

export type CompletedSignature = (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  state: PipelineProviderState
  onProviderState?: ((state: PipelineProviderState) => Promise<void>) | undefined
  reconciliationMode?: 'enforce' | 'report' | undefined
}) => Promise<CurrentTtsCompletedRecovery | CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined>

export type CompatibleSignature = (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  outputDir: string
  artifactRoot?: string | undefined
  state: PipelineProviderState
  materialize?: boolean | undefined
  reconciliationMode?: 'enforce' | 'report' | undefined
}) => Promise<CurrentTtsPartialRecovery | CurrentTtsSafeRedispatch | undefined>

export type PriceSignature = (options: PureCurrentTtsRenderPlanOptions & {
  rootDir: string
  state?: PipelineProviderState | undefined
}) => Promise<CurrentTtsResumePricePlan>
