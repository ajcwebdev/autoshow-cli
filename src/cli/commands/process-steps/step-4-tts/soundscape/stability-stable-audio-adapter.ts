import type {
  SoundEffectCapabilityFixture,
  SoundEffectGenerationResponse,
  SoundEffectRenderTask,
  SoundEffectRequestEvidence,
  SoundEffectTarget,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTargetKey, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { SoundEffectProviderError } from './sound-effect-errors'

const DOCS = [
  'https://platform.stability.ai/docs/api-reference',
  'https://platform.stability.ai/docs/getting-started/authentication',
]

export const STABILITY_STABLE_AUDIO_MODEL_ID = 'stable-audio-3'
export const STABILITY_STABLE_AUDIO_SERIALIZER_VERSION = 'stability.stable-audio-3.v1'
export const STABILITY_STABLE_AUDIO_ENDPOINT = '/v2beta/audio/stable-audio-3/text-to-audio'
export const STABILITY_STABLE_AUDIO_SELECTOR = `stability=${STABILITY_STABLE_AUDIO_MODEL_ID}`
export const STABILITY_API_BASE_URL = 'https://api.stability.ai'

const fixtureBase = {
  schemaVersion: 1 as const,
  provider: 'stability' as const,
  model: STABILITY_STABLE_AUDIO_MODEL_ID,
  transport: 'hosted-api' as const,
  endpoint: STABILITY_STABLE_AUDIO_ENDPOINT,
  serializerVersion: STABILITY_STABLE_AUDIO_SERIALIZER_VERSION,
  checkedAt: '2026-08-14',
  sourceRefs: DOCS,
  constraints: {
    promptMaxScalars: 1000,
    durationSeconds: { min: 1, max: 190, default: 8 },
    outputFormats: ['wav', 'mp3'],
  },
  pricing: {
    currency: 'USD' as const,
    specifiedDurationPerMinute: 0.4,
    automaticDurationPerRequest: null,
    typicalPerPrediction: 0.2,
    inputDependent: true,
  },
}

export const STABILITY_STABLE_AUDIO_SFX_CAPABILITY_FIXTURE: SoundEffectCapabilityFixture = {
  ...fixtureBase,
  capabilityFixtureHash: hashCanonicalTtsValue(fixtureBase),
}

export const resolveStabilitySoundEffectTarget = (
  model: string,
  options: { outputFormat?: string | undefined } = {}
): SoundEffectTarget => {
  const [modelId] = model.split('@')
  if (modelId !== STABILITY_STABLE_AUDIO_MODEL_ID) {
    throw CLIUsageError(`Unsupported Stability sound-effect model ${model}; expected ${STABILITY_STABLE_AUDIO_MODEL_ID}.`)
  }
  const outputFormat = options.outputFormat ?? 'wav'
  if (!STABILITY_STABLE_AUDIO_SFX_CAPABILITY_FIXTURE.constraints.outputFormats.includes(outputFormat)) {
    throw CLIUsageError(`Unsupported Stability sound-effect output format ${outputFormat}.`)
  }
  return {
    provider: 'stability',
    model: STABILITY_STABLE_AUDIO_MODEL_ID,
    transport: 'hosted-api',
    targetKey: canonicalTargetKey('sound-effect-generation', 'stability', STABILITY_STABLE_AUDIO_MODEL_ID, 'hosted-api'),
    capabilityFixture: STABILITY_STABLE_AUDIO_SFX_CAPABILITY_FIXTURE,
    outputFormat,
    promptInfluence: 1,
  }
}

export const validateStabilitySoundEffectTask = (task: SoundEffectRenderTask, target: SoundEffectTarget): void => {
  if (task.kind === 'vocal-reaction') {
    throw CLIUsageError('Stability Stable Audio 3 is a dedicated action-SFX and ambience target and cannot render vocal reactions, dialogue, or voice identity.')
  }
  const constraints = target.capabilityFixture.constraints
  const promptLength = [...task.prompt].length
  if (promptLength < 1 || promptLength > constraints.promptMaxScalars) {
    throw CLIUsageError(`Stability sound-effect prompt must contain 1-${constraints.promptMaxScalars} Unicode scalar values.`)
  }
  if (
    task.durationSeconds !== undefined &&
    (task.durationSeconds < constraints.durationSeconds.min || task.durationSeconds > constraints.durationSeconds.max)
  ) {
    throw CLIUsageError(
      `Stability sound-effect duration must be ${constraints.durationSeconds.min}-${constraints.durationSeconds.max} seconds.`
    )
  }
}

export type StabilitySoundEffectSerializedRequest = {
  path: typeof STABILITY_STABLE_AUDIO_ENDPOINT
  body: {
    prompt: string
    duration: number
    output_format: string
  }
}

export const serializeStabilitySoundEffectRequest = (
  task: SoundEffectRenderTask,
  target: SoundEffectTarget
): StabilitySoundEffectSerializedRequest => {
  validateStabilitySoundEffectTask(task, target)
  return {
    path: STABILITY_STABLE_AUDIO_ENDPOINT,
    body: {
      prompt: task.prompt,
      duration: Math.round(task.durationSeconds ?? target.capabilityFixture.constraints.durationSeconds.default ?? 8),
      output_format: task.outputFormat,
    },
  }
}

export type StabilitySoundEffectHttpRequest = (input: {
  method: 'POST'
  path: typeof STABILITY_STABLE_AUDIO_ENDPOINT
  headers: Record<string, string>
  body: FormData
  cancellation: AbortSignal
}) => Promise<{ status: number, headers?: Headers | Record<string, string> | undefined, body: Uint8Array }>

const defaultRequest = (apiKey: string): StabilitySoundEffectHttpRequest => async (input) => {
  const response = await fetch(`${STABILITY_API_BASE_URL}${input.path}`, {
    method: input.method,
    headers: { ...input.headers, Authorization: `Bearer ${apiKey}` },
    body: input.body,
    signal: input.cancellation,
  })
  return { status: response.status, headers: response.headers, body: new Uint8Array(await response.arrayBuffer()) }
}

export const createStabilitySoundEffectAdapter = (options: {
  apiKey: string
  request?: StabilitySoundEffectHttpRequest | undefined
  now?: (() => string) | undefined
}) => {
  if (!options.apiKey.trim()) throw CLIUsageError('Stability Stable Audio 3 requires STABILITY_API_KEY.')
  const request = options.request ?? defaultRequest(options.apiKey)
  const now = options.now ?? (() => new Date().toISOString())
  return {
    generate: async (
      task: SoundEffectRenderTask,
      target: SoundEffectTarget,
      requestOrdinal: number,
      cancellation: AbortSignal
    ): Promise<SoundEffectGenerationResponse> => {
      cancellation.throwIfAborted()
      validateStabilitySoundEffectTask(task, target)
      const serialized = serializeStabilitySoundEffectRequest(task, target)
      const form = new FormData()
      form.set('prompt', serialized.body.prompt)
      form.set('duration', String(serialized.body.duration))
      form.set('output_format', serialized.body.output_format)
      const response = await request({
        method: 'POST',
        path: serialized.path,
        headers: { Accept: 'audio/*' },
        body: form,
        cancellation,
      })
      if (response.status < 200 || response.status >= 300) {
        const rejected = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 409
        throw new SoundEffectProviderError(
          `Stability Stable Audio 3 failed with HTTP ${response.status}.`,
          rejected && (response.status === 425 || response.status === 429),
          rejected ? 'rejected' : 'ambiguous',
          response.status,
          response.headers
        )
      }
      if (response.body.byteLength === 0) throw CLIUsageError('Stability Stable Audio 3 returned empty audio.')
      const contentType = header(response.headers, 'content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
      const providerRequestId = header(response.headers, 'x-request-id')
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
      const requestEvidence: SoundEffectRequestEvidence = { ...evidenceBase, requestEvidenceId: hashCanonicalTtsValue(evidenceBase) }
      return { bytes: response.body, contentType, ...(providerRequestId ? { providerRequestId } : {}), requestEvidence }
    },
  }
}

const header = (headers: Headers | Record<string, string> | undefined, name: string): string | undefined => {
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return typeof entry?.[1] === 'string' ? entry[1] : undefined
}
