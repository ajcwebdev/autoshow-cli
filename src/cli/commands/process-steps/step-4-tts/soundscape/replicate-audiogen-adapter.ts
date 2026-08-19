import type {
  ReplicatePrediction,
  SoundEffectCapabilityFixture,
  SoundEffectDispatchAvailability,
  SoundEffectGenerationResponse,
  SoundEffectLicenseUse,
  SoundEffectLicenseUseClassification,
  SoundEffectRenderTask,
  SoundEffectRequestEvidence,
  SoundEffectTarget,
  ReplicateAudioGenFetchImpl,
  ReplicateAudioGenPredictionRunner,
  ReplicateAudioGenSerializedRequest,
} from '~/types'
import { CLIUsageError, extractErrorMetadata } from '~/utils/error-handler'
import { canonicalTtsJson, canonicalTargetKey, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { REPLICATE_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { cancelReplicatePrediction, runReplicatePrediction, normalizeReplicateOutputUris } from '~/utils/replicate-client/replicate-prediction'
import { classifyFetchRetry, isRetryableStatus, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { SoundEffectProviderError } from './sound-effect-errors'

const DOCS = [
  'https://replicate.com/sepal/audiogen/versions/154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8/api',
  'https://replicate.com/docs/topics/models/community-models',
  'https://replicate.com/docs/topics/models/versions',
  'https://github.com/facebookresearch/audiocraft/blob/main/docs/AUDIOGEN.md',
  'https://github.com/facebookresearch/audiocraft/blob/main/model_cards/AUDIOGEN_MODEL_CARD.md',
  'https://github.com/facebookresearch/audiocraft/blob/main/LICENSE_weights',
  'https://replicate.com/pricing',
]

export const REPLICATE_AUDIOGEN_PINNED_VERSION = '154b3e5141493cb1b8cec976d9aa90f2b691137e39ad906d2421b74c2a8c52b8'
export const REPLICATE_AUDIOGEN_MODEL_ID = 'sepal/audiogen'
export const REPLICATE_AUDIOGEN_OWNER = 'sepal'
export const REPLICATE_AUDIOGEN_SERIALIZER_VERSION = 'replicate.audiogen.v1'
export const REPLICATE_AUDIOGEN_SELECTOR = `replicate=${REPLICATE_AUDIOGEN_MODEL_ID}@${REPLICATE_AUDIOGEN_PINNED_VERSION}`

const SAMPLING_DEFAULTS = {
  topK: 250,
  topP: 0,
  temperature: 1,
  classifierFreeGuidance: 3,
} as const

const fixtureBase = {
  schemaVersion: 1 as const,
  provider: 'replicate' as const,
  owner: REPLICATE_AUDIOGEN_OWNER,
  model: REPLICATE_AUDIOGEN_MODEL_ID,
  pinnedVersion: REPLICATE_AUDIOGEN_PINNED_VERSION,
  transport: 'hosted-api' as const,
  endpoint: '/v1/predictions' as const,
  serializerVersion: REPLICATE_AUDIOGEN_SERIALIZER_VERSION,
  inputSchema: {
    prompt: 'string',
    duration: 'number-1-10-default-3',
    top_k: 'integer-default-250',
    top_p: 'number-default-0',
    temperature: 'number-default-1',
    classifier_free_guidance: 'integer-default-3',
    output_format: 'wav|mp3-default-wav',
  },
  outputSchema: {
    format: 'uri',
    type: 'string',
  },
  hardwareObservation: {
    accelerator: 'nvidia-l40s',
    typicalPredictSeconds: 14,
    observedAt: '2026-08-14',
  },
  upstreamSource: 'https://github.com/facebookresearch/audiocraft',
  communityLifecycle: 'community-unofficial' as const,
  licenseProvenance: 'CC BY-NC 4.0',
  permittedUse: 'noncommercial' as const,
  dispatchAvailability: 'available' as const,
  checkedAt: '2026-08-14',
  sourceRefs: DOCS,
  constraints: {
    promptMaxScalars: 500,
    durationSeconds: { min: 1, max: 10, default: 3 },
    sampling: SAMPLING_DEFAULTS,
    outputFormats: ['wav', 'mp3'],
  },
  pricing: {
    currency: 'USD' as const,
    specifiedDurationPerMinute: 0.26,
    automaticDurationPerRequest: null,
    typicalPerPrediction: 0.013,
    inputDependent: true,
  },
}

export const REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE: SoundEffectCapabilityFixture = {
  ...fixtureBase,
  capabilityFixtureHash: hashCanonicalTtsValue(fixtureBase),
}

const historicalFixtures = new Map<string, SoundEffectCapabilityFixture>([
  [REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.capabilityFixtureHash, REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE],
])

const fixtureWithoutHash = (fixture: SoundEffectCapabilityFixture): Omit<SoundEffectCapabilityFixture, 'capabilityFixtureHash'> => {
  const { capabilityFixtureHash: _hash, ...rest } = fixture
  return rest
}

export const hashSoundEffectCapabilityFixture = (fixture: Omit<SoundEffectCapabilityFixture, 'capabilityFixtureHash'>): string =>
  hashCanonicalTtsValue(fixture)

export const withAudioGenDispatchAvailability = (
  fixture: SoundEffectCapabilityFixture,
  dispatchAvailability: SoundEffectDispatchAvailability
): SoundEffectCapabilityFixture => {
  const next = { ...fixtureWithoutHash(fixture), dispatchAvailability }
  return { ...next, capabilityFixtureHash: hashSoundEffectCapabilityFixture(next) }
}

export const registerHistoricalAudioGenFixture = (fixture: SoundEffectCapabilityFixture): SoundEffectCapabilityFixture => {
  historicalFixtures.set(fixture.capabilityFixtureHash, fixture)
  return fixture
}

export const readAudioGenCapabilityFixture = (capabilityFixtureHash: string): SoundEffectCapabilityFixture | undefined =>
  historicalFixtures.get(capabilityFixtureHash)

export const isAudioGenDispatchAvailable = (fixture: SoundEffectCapabilityFixture): boolean =>
  (fixture.dispatchAvailability ?? 'available') === 'available'

export const createSoundEffectLicenseUse = (input: {
  classification: SoundEffectLicenseUseClassification
  fixture: SoundEffectCapabilityFixture
}): SoundEffectLicenseUse => {
  const base = {
    schemaVersion: 1 as const,
    classification: input.classification,
    fixtureHash: input.fixture.capabilityFixtureHash,
    ...(input.fixture.permittedUse ? { permittedUse: input.fixture.permittedUse } : {}),
    ...(input.fixture.licenseProvenance ? { licenseProvenance: input.fixture.licenseProvenance } : {}),
    sourceRefs: input.fixture.sourceRefs,
  }
  return { ...base, evidenceHash: hashCanonicalTtsValue(base) }
}

export const AUDIOGEN_NONCOMMERCIAL_LICENSE_USE = createSoundEffectLicenseUse({
  classification: 'noncommercial',
  fixture: REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE,
})

export const assertAudioGenLicenseEligible = (licenseUse: SoundEffectLicenseUse | undefined, fixture: SoundEffectCapabilityFixture): SoundEffectLicenseUse => {
  if (!licenseUse) {
    throw CLIUsageError(`Replicate AudioGen requires explicit --sfx-license-use noncommercial; noncommercial eligibility is never inferred from ${REPLICATE_AUDIOGEN_SELECTOR}.`)
  }
  const expected = createSoundEffectLicenseUse({ classification: licenseUse.classification, fixture })
  if (licenseUse.evidenceHash !== expected.evidenceHash || licenseUse.fixtureHash !== fixture.capabilityFixtureHash) {
    throw CLIUsageError('Sound-effect license-use evidence does not match the selected AudioGen capability fixture.')
  }
  if (licenseUse.classification !== 'noncommercial' || fixture.permittedUse !== 'noncommercial') {
    throw CLIUsageError(`Replicate AudioGen is restricted to license-compatible noncommercial use; ${licenseUse.classification} intended use is ineligible under ${fixture.licenseProvenance ?? 'the current fixture license'}.`)
  }
  return licenseUse
}

export const assertAudioGenDispatchEligible = (fixture: SoundEffectCapabilityFixture): void => {
  if (isAudioGenDispatchAvailable(fixture)) return
  throw CLIUsageError(`Replicate AudioGen fixture ${fixture.capabilityFixtureHash} is ${fixture.dispatchAvailability ?? 'unavailable'} and cannot dispatch new predictions; historical plans remain readable.`)
}

export const resolveReplicateAudioGenTarget = (
  rawModel: string,
  options: { outputFormat?: string | undefined } = {}
): SoundEffectTarget => {
  const modelPart = rawModel.trim()
  const [modelName, explicitVersion] = modelPart.split('@')
  if (modelName !== REPLICATE_AUDIOGEN_MODEL_ID) {
    throw CLIUsageError(`Unsupported Replicate sound-effect model ${modelName}; expected ${REPLICATE_AUDIOGEN_MODEL_ID}. Aliases are rejected.`)
  }
  if (explicitVersion && explicitVersion !== REPLICATE_AUDIOGEN_PINNED_VERSION) {
    throw CLIUsageError(`Unreviewed Replicate AudioGen version ${explicitVersion}; expected pinned version ${REPLICATE_AUDIOGEN_PINNED_VERSION}.`)
  }
  const outputFormat = options.outputFormat ?? 'wav'
  if (!REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE.constraints.outputFormats.includes(outputFormat)) {
    throw CLIUsageError(`Unsupported Replicate AudioGen output format ${outputFormat}.`)
  }
  assertAudioGenDispatchEligible(REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE)
  return {
    provider: 'replicate',
    model: REPLICATE_AUDIOGEN_MODEL_ID,
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('sound-effect-generation', 'replicate', REPLICATE_AUDIOGEN_MODEL_ID, 'hosted-api'),
    capabilityFixture: REPLICATE_AUDIOGEN_SFX_CAPABILITY_FIXTURE,
    outputFormat,
    promptInfluence: 1,
  }
}

export const validateReplicateAudioGenTask = (task: SoundEffectRenderTask, target: SoundEffectTarget): void => {
  if (task.kind === 'vocal-reaction') {
    throw CLIUsageError('Replicate AudioGen is a dedicated action-SFX and ambience target and cannot render vocal reactions, dialogue, or voice identity.')
  }
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
): ReplicateAudioGenSerializedRequest => {
  validateReplicateAudioGenTask(task, target)
  const duration = Math.round(task.durationSeconds ?? target.capabilityFixture.constraints.durationSeconds.default ?? 3)
  const sampling = target.capabilityFixture.constraints.sampling ?? SAMPLING_DEFAULTS
  return {
    path: '/v1/predictions',
    body: {
      version: `${REPLICATE_AUDIOGEN_MODEL_ID}:${REPLICATE_AUDIOGEN_PINNED_VERSION}`,
      input: {
        prompt: task.prompt,
        duration,
        top_k: sampling.topK,
        top_p: sampling.topP,
        temperature: sampling.temperature,
        classifier_free_guidance: sampling.classifierFreeGuidance,
        output_format: task.outputFormat,
      },
    },
  }
}

const classifyAudioGenFailure = (err: unknown): SoundEffectProviderError => {
  const metadata = extractErrorMetadata(err)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  const headers = metadata['headers'] instanceof Headers ? metadata['headers'] : undefined
  const rejected = status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 409
  return new SoundEffectProviderError(
    `Replicate AudioGen prediction failed: ${err instanceof Error ? err.message : String(err)}`,
    rejected && (status === 425 || status === 429),
    rejected ? 'rejected' : 'ambiguous',
    status,
    headers
  )
}

export const createReplicateAudioGenAdapter = (input: {
  apiToken: string
  baseUrl?: string | undefined
  fetchImpl?: ReplicateAudioGenFetchImpl | undefined
  runPrediction?: ReplicateAudioGenPredictionRunner | undefined
  now?: (() => string) | undefined
}) => {
  const apiToken = input.apiToken.trim()
  if (!apiToken) {
    throw CLIUsageError('Replicate AudioGen sound-effect execution requires REPLICATE_API_TOKEN.')
  }
  const baseUrl = input.baseUrl ?? REPLICATE_DEFAULT_BASE_URL
  const now = input.now ?? (() => new Date().toISOString())
  const runPrediction = input.runPrediction ?? (async (options) => await runReplicatePrediction(options))

  return {
    generate: async (
      task: SoundEffectRenderTask,
      target: SoundEffectTarget,
      requestOrdinal: number,
      cancellation: AbortSignal
    ): Promise<SoundEffectGenerationResponse> => {
      cancellation.throwIfAborted()
      assertAudioGenDispatchEligible(target.capabilityFixture)
      const serialized = serializeReplicateAudioGenRequest(task, target)
      let cancelUrl: string | undefined
      let createdId: string | undefined

      const cancelIfPossible = async (): Promise<void> => {
        if (!cancelUrl) return
        try {
          await cancelReplicatePrediction({
            apiToken,
            cancelUrl,
            operationName: 'replicate-audiogen-sfx',
          })
        } catch {
        }
      }

      let prediction: ReplicatePrediction
      try {
        prediction = await runPrediction({
          baseUrl,
          apiToken,
          model: REPLICATE_AUDIOGEN_MODEL_ID,
          version: REPLICATE_AUDIOGEN_PINNED_VERSION,
          input: serialized.body.input,
          operationName: 'replicate-audiogen-sfx',
          abortSignal: cancellation,
          onCreated: async (created) => {
            createdId = created.id
            cancelUrl = created.urls?.cancel
          },
        })
      } catch (err: unknown) {
        if (cancellation.aborted) await cancelIfPossible()
        throw classifyAudioGenFailure(err)
      }

      if (cancellation.aborted) {
        await cancelIfPossible()
        cancellation.throwIfAborted()
      }

      const outputUris = normalizeReplicateOutputUris(prediction.output)
      if (outputUris.length === 0 || !outputUris[0]) {
        throw CLIUsageError('Replicate AudioGen prediction completed but returned no output URI.')
      }

      const fetchFn = input.fetchImpl ?? fetch
      let bytes: Uint8Array
      try {
        bytes = await withRetry({
          retryClass: 'runtime_http_read',
          operationName: 'replicate-audiogen-sfx-download',
          timeoutMs: MEDIA_GENERATION_TIMEOUT_MS,
          abortSignal: cancellation,
        }, async (downloadSignal) => {
          const audioResponse = await fetchFn(outputUris[0] as string, { signal: downloadSignal ?? cancellation })
          if (!audioResponse.ok) {
            throw new SoundEffectProviderError(
              `Failed to download Replicate AudioGen output (${audioResponse.status}).`,
              isRetryableStatus(audioResponse.status),
              audioResponse.status >= 400 && audioResponse.status < 500 && audioResponse.status !== 408 && audioResponse.status !== 409 ? 'rejected' : 'ambiguous',
              audioResponse.status
            )
          }
          const downloaded = new Uint8Array(await audioResponse.arrayBuffer())
          if (downloaded.byteLength === 0) {
            throw new SoundEffectProviderError('Replicate AudioGen output download was empty.', false, 'ambiguous')
          }
          return downloaded
        }, (error) => classifyFetchRetry(error, 'runtime_http_read'))
      } catch (err: unknown) {
        if (cancellation.aborted) await cancelIfPossible()
        if (err instanceof SoundEffectProviderError) throw err
        throw classifyAudioGenFailure(err)
      }

      const contentType = task.outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav'
      const providerRequestId = prediction.id ?? createdId

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
