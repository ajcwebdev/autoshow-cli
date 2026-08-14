import type { SoundEffectCapabilityFixture, SoundEffectGenerationResponse, SoundEffectRenderTask, SoundEffectRequestEvidence, SoundEffectTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson, canonicalTargetKey, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { runReplicatePrediction, normalizeReplicateOutputUris } from '~/utils/replicate-client/replicate-prediction'
import { SoundEffectProviderError } from './elevenlabs-sfx-adapter'

const DOCS = [
  'https://replicate.com/sepal/audiogen/versions/154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8/api',
  'https://replicate.com/docs/topics/models/community-models',
  'https://github.com/facebookresearch/audiocraft/blob/main/model_cards/AUDIOGEN_MODEL_CARD.md',
  'https://github.com/facebookresearch/audiocraft/blob/main/LICENSE_weights',
]

export const REPLICATE_AUDIOGEN_PINNED_VERSION = '154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8'
export const REPLICATE_AUDIOGEN_MODEL_ID = 'sepal/audiogen'

const fixtureBase = {
  schemaVersion: 1 as const,
  provider: 'replicate' as const,
  model: REPLICATE_AUDIOGEN_MODEL_ID,
  pinnedVersion: REPLICATE_AUDIOGEN_PINNED_VERSION,
  transport: 'hosted-api' as const,
  endpoint: '/v1/predictions' as const,
  serializerVersion: 'replicate.audiogen.phase-4-v1',
  licenseProvenance: 'CC BY-NC 4.0',
  permittedUse: 'noncommercial' as const,
  checkedAt: '2026-08-14',
  sourceRefs: DOCS,
  constraints: {
    promptMaxScalars: 500,
    durationSeconds: { min: 1, max: 10, default: 5 },
    outputFormats: ['wav', 'mp3'],
  },
  pricing: {
    currency: 'USD' as const,
    specifiedDurationPerMinute: 0.10,
    automaticDurationPerRequest: null,
  },
}

export const REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE: SoundEffectCapabilityFixture = {
  ...fixtureBase,
  capabilityFixtureHash: hashCanonicalTtsValue(fixtureBase),
}

export type ReplicateAudioGenFetchImpl = (input: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>

export const resolveReplicateAudioGenTarget = (
  rawModel: string,
  options: { outputFormat?: string | undefined } = {}
): SoundEffectTarget => {
  const modelPart = rawModel.trim()
  const [modelName, explicitVersion] = modelPart.split('@')
  if (modelName !== REPLICATE_AUDIOGEN_MODEL_ID && modelName !== 'audiogen') {
    throw CLIUsageError(`Unsupported Replicate sound-effect model ${modelName}; expected ${REPLICATE_AUDIOGEN_MODEL_ID}.`)
  }
  if (explicitVersion && explicitVersion !== REPLICATE_AUDIOGEN_PINNED_VERSION) {
    throw CLIUsageError(`Unreviewed Replicate AudioGen version ${explicitVersion}; expected pinned version ${REPLICATE_AUDIOGEN_PINNED_VERSION}.`)
  }
  const outputFormat = options.outputFormat ?? 'wav'
  if (!REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.constraints.outputFormats.includes(outputFormat)) {
    throw CLIUsageError(`Unsupported Replicate AudioGen output format ${outputFormat}.`)
  }
  return {
    provider: 'replicate',
    model: REPLICATE_AUDIOGEN_MODEL_ID,
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('sound-effect-generation', 'replicate', REPLICATE_AUDIOGEN_MODEL_ID, 'hosted-api'),
    capabilityFixture: REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE,
    outputFormat,
    promptInfluence: 1.0,
  }
}

export const validateReplicateAudioGenTask = (task: SoundEffectRenderTask, target: SoundEffectTarget): void => {
  const constraints = target.capabilityFixture.constraints
  const promptLength = [...task.prompt].length
  if (promptLength < 1 || promptLength > constraints.promptMaxScalars) {
    throw CLIUsageError(`Replicate AudioGen sound-effect prompt must contain 1-${constraints.promptMaxScalars} Unicode scalar values.`)
  }
  if (
    task.durationSeconds !== undefined &&
    (task.durationSeconds < constraints.durationSeconds.min || task.durationSeconds > constraints.durationSeconds.max)
  ) {
    throw CLIUsageError(
      `Replicate AudioGen sound-effect duration must be ${constraints.durationSeconds.min}-${constraints.durationSeconds.max} seconds.`
    )
  }
}

export const serializeReplicateAudioGenRequest = (
  task: SoundEffectRenderTask,
  target: SoundEffectTarget
): {
  path: '/v1/predictions'
  body: { version: string, input: { prompt: string, duration: number } }
} => {
  validateReplicateAudioGenTask(task, target)
  const duration = Math.round(task.durationSeconds ?? target.capabilityFixture.constraints.durationSeconds.default ?? 5)
  return {
    path: '/v1/predictions',
    body: {
      version: `${REPLICATE_AUDIOGEN_MODEL_ID}:${REPLICATE_AUDIOGEN_PINNED_VERSION}`,
      input: {
        prompt: task.prompt,
        duration,
      },
    },
  }
}

export const createReplicateAudioGenAdapter = (input: {
  apiToken: string
  baseUrl?: string | undefined
  fetchImpl?: ReplicateAudioGenFetchImpl | undefined
  now?: (() => string) | undefined
}) => {
  const apiToken = input.apiToken.trim()
  if (!apiToken) {
    throw CLIUsageError('Replicate AudioGen sound-effect execution requires REPLICATE_API_TOKEN.')
  }
  const baseUrl = input.baseUrl ?? REPLICATE_DEFAULT_BASE_URL
  const now = input.now ?? (() => new Date().toISOString())

  return {
    generate: async (
      task: SoundEffectRenderTask,
      target: SoundEffectTarget,
      requestOrdinal: number,
      cancellation: AbortSignal
    ): Promise<SoundEffectGenerationResponse> => {
      cancellation.throwIfAborted()
      const serialized = serializeReplicateAudioGenRequest(task, target)

      let prediction: Awaited<ReturnType<typeof runReplicatePrediction>>
      try {
        prediction = await runReplicatePrediction({
          baseUrl,
          apiToken,
          model: REPLICATE_AUDIOGEN_MODEL_ID,
          version: REPLICATE_AUDIOGEN_PINNED_VERSION,
          input: serialized.body.input,
          operationName: 'replicate-audiogen-sfx',
        })
      } catch (err: unknown) {
        throw new SoundEffectProviderError(
          `Replicate AudioGen prediction failed: ${err instanceof Error ? err.message : String(err)}`,
          false,
          'rejected'
        )
      }

      const outputUris = normalizeReplicateOutputUris(prediction.output)
      if (outputUris.length === 0 || !outputUris[0]) {
        throw CLIUsageError('Replicate AudioGen prediction completed but returned no output URI.')
      }

      const fetchFn = input.fetchImpl ?? fetch
      const audioResponse = await fetchFn(outputUris[0], { signal: cancellation })
      if (!audioResponse.ok) {
        throw new SoundEffectProviderError(
          `Failed to download Replicate AudioGen output (${audioResponse.status}).`,
          true,
          'ambiguous',
          audioResponse.status
        )
      }

      const bytes = new Uint8Array(await audioResponse.arrayBuffer())
      const contentType = audioResponse.headers.get('content-type')?.split(';')[0]?.trim() || 'audio/wav'
      const providerRequestId = prediction.id

      const evidenceBase = {
        schemaVersion: 1 as const,
        requestIdentity: task.requestIdentity,
        requestOrdinal,
        endpoint: serialized.path,
        serializerVersion: target.capabilityFixture.serializerVersion,
        requestBodyHash: hashCanonicalTtsValue(serialized.body),
        queryHash: hashCanonicalTtsValue({}),
        ...(providerRequestId ? { providerRequestId } : {}),
        observedContentType: contentType,
        capturedAt: now(),
      }
      const requestEvidence: SoundEffectRequestEvidence = {
        ...evidenceBase,
        requestEvidenceId: hashCanonicalTtsValue(evidenceBase),
      }

      return {
        bytes,
        contentType,
        ...(providerRequestId ? { providerRequestId } : {}),
        requestEvidence,
      }
    },
    canonicalRequestJson: (task: SoundEffectRenderTask, target: SoundEffectTarget): string =>
      canonicalTtsJson(serializeReplicateAudioGenRequest(task, target)),
  }
}
