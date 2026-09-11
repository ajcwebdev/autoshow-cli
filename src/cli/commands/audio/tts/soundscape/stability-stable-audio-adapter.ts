import type {
  SoundEffectCapabilityFixture,
  SoundEffectGenerationResponse,
  SoundEffectRenderTask,
  SoundEffectRequestEvidence,
  SoundEffectTarget,
  StabilitySoundEffectHttpRequest,
  StabilitySoundEffectSerializedRequest,
} from '~/types'
import { sleepWithAbortSignal } from '~/utils/retry-abortable-delay'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { canonicalTargetKey, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'
import { SoundEffectProviderError } from './sound-effect-errors'
import { resolveCredential } from '~/utils/validate/env-utils'

const DOCS = [
  'https://platform.stability.ai/docs/api-reference',
  'https://platform.stability.ai/pricing',
]

export const STABILITY_STABLE_AUDIO_MODEL_ID = 'stable-audio-3'
const STABILITY_STABLE_AUDIO_SERIALIZER_VERSION = 'stability.stable-audio-3.v2'
export const STABILITY_STABLE_AUDIO_COST_USD = 0.26
export const STABILITY_STABLE_AUDIO_ENDPOINT = '/v2beta/audio/stable-audio/text-to-audio'
export const STABILITY_STABLE_AUDIO_SELECTOR = `stability=${STABILITY_STABLE_AUDIO_MODEL_ID}`
const STABILITY_API_BASE_URL = 'https://api.stability.ai'

const fixtureBase = {
  schemaVersion: 1 as const,
  provider: 'stability' as const,
  model: STABILITY_STABLE_AUDIO_MODEL_ID,
  transport: 'hosted-api' as const,
  endpoint: STABILITY_STABLE_AUDIO_ENDPOINT,
  serializerVersion: STABILITY_STABLE_AUDIO_SERIALIZER_VERSION,
  checkedAt: '2026-09-11',
  sourceRefs: DOCS,
  constraints: {
    promptMaxScalars: 10000,
    durationSeconds: { min: 1, max: 380, default: 8 },
    outputFormats: ['wav', 'mp3'],
  },
  pricing: {
    currency: 'USD' as const,
    specifiedDurationPerMinute: 0,
    automaticDurationPerRequest: STABILITY_STABLE_AUDIO_COST_USD,
    perSuccessfulGeneration: STABILITY_STABLE_AUDIO_COST_USD,
  },
}

const STABILITY_STABLE_AUDIO_SFX_CAPABILITY_FIXTURE: SoundEffectCapabilityFixture = {
  ...fixtureBase,
  capabilityFixtureHash: hashCanonicalTtsValue(fixtureBase),
}

export const resolveStabilitySoundEffectTarget = (
  model: string,
  options: { outputFormat?: string | undefined } = {}
): SoundEffectTarget => {
  const [modelId] = model.split('@')
  if (modelId !== STABILITY_STABLE_AUDIO_MODEL_ID) {
    throw UsageError(`Unsupported Stability sound-effect model ${model}; expected ${STABILITY_STABLE_AUDIO_MODEL_ID}.`)
  }
  const outputFormat = options.outputFormat ?? 'wav'
  if (!STABILITY_STABLE_AUDIO_SFX_CAPABILITY_FIXTURE.constraints.outputFormats.includes(outputFormat)) {
    throw UsageError(`Unsupported Stability sound-effect output format ${outputFormat}.`)
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
    throw UsageError('Stability Stable Audio 3 is a dedicated action-SFX and ambience target and cannot render vocal reactions, dialogue, or voice identity.')
  }
  if (!target.capabilityFixture.constraints.outputFormats.includes(task.outputFormat)) throw UsageError(`Unsupported Stability sound-effect output format ${task.outputFormat}.`)
  const constraints = target.capabilityFixture.constraints
  const promptLength = [...task.prompt].length
  if (promptLength < 1 || promptLength > constraints.promptMaxScalars) {
    throw UsageError(`Stability sound-effect prompt must contain 1-${constraints.promptMaxScalars} Unicode scalar values.`)
  }
  if (
    task.durationSeconds !== undefined &&
    (!Number.isFinite(task.durationSeconds) || task.durationSeconds < constraints.durationSeconds.min || task.durationSeconds > constraints.durationSeconds.max)
  ) {
    throw UsageError(
      `Stability sound-effect duration must be ${constraints.durationSeconds.min}-${constraints.durationSeconds.max} seconds.`
    )
  }
}

export const serializeStabilitySoundEffectRequest = (
  task: SoundEffectRenderTask,
  target: SoundEffectTarget
): StabilitySoundEffectSerializedRequest => {
  validateStabilitySoundEffectTask(task, target)
  return {
    // Retained v1 plans must keep their exact serialized identity for cache validation.
    path: target.capabilityFixture.endpoint,
    body: {
      prompt: task.prompt,
      duration: target.capabilityFixture.serializerVersion.endsWith('.v1')
        ? Math.round(task.durationSeconds ?? target.capabilityFixture.constraints.durationSeconds.default ?? 8)
        : task.durationSeconds ?? target.capabilityFixture.constraints.durationSeconds.default ?? 8,
      output_format: task.outputFormat,
    },
  }
}

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
  wait?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined
  maxPolls?: number | undefined
}) => {
  const apiKey = resolveCredential('stability', 'require', { stage: 'tts:soundscape', providedValue: options.apiKey, useProvidedValue: true, description: 'Stability Stable Audio 3' })
  const request = options.request ?? defaultRequest(apiKey)
  const wait = options.wait ?? sleepWithAbortSignal
  const maxPolls = options.maxPolls ?? 180
  if (!Number.isInteger(maxPolls) || maxPolls < 1) throw UsageError('Stable Audio maxPolls must be a positive integer.')
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
      if (target.capabilityFixture.serializerVersion !== STABILITY_STABLE_AUDIO_SERIALIZER_VERSION) throw UsageError('Retained Stable Audio v1 requests can be reused but cannot be submitted with an obsolete contract; create a new sound-effect plan.')
      const serialized = serializeStabilitySoundEffectRequest(task, target)
      const form = new FormData()
      form.set('prompt', serialized.body.prompt)
      form.set('duration', String(serialized.body.duration))
      form.set('output_format', serialized.body.output_format)
      let response = await request({
        method: 'POST',
        path: serialized.path,
        headers: { Accept: 'audio/*' },
        body: form,
        cancellation,
      })
      if (response.status !== 202) {
        const rejected = response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 409
        throw new SoundEffectProviderError(
          `Stability Stable Audio 3 submission failed with HTTP ${response.status}.`,
          rejected && (response.status === 425 || response.status === 429),
          rejected ? 'rejected' : 'ambiguous', response.status, response.headers
        )
      }
      let providerRequestId: string
      try {
        const payload = JSON.parse(new TextDecoder().decode(response.body)) as { id?: unknown }
        if (typeof payload.id !== 'string' || !/^[a-zA-Z0-9_-]+$/u.test(payload.id)) throw ValidationError('Invalid generation ID')
        providerRequestId = payload.id
      } catch {
        throw new SoundEffectProviderError('Stable Audio accepted a submission without a valid generation ID.', false, 'ambiguous')
      }
      for (let poll = 0; poll < maxPolls; poll++) {
        await wait(10_000, cancellation)
        cancellation.throwIfAborted()
        response = await request({ method: 'GET', path: `/v2beta/audio/results/${providerRequestId}`, headers: { Accept: 'audio/*' }, cancellation })
        if (response.status === 200) break
        if (response.status === 202 || response.status === 429 || response.status >= 500) continue
        // A result failure never authorizes another create request.
        throw new SoundEffectProviderError(`Stable Audio result ${providerRequestId} failed with HTTP ${response.status}; automatic redispatch is blocked.`, false, 'ambiguous', response.status, response.headers)
      }
      const contentType = header(response.headers, 'content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
      if (response.status !== 200 || !contentType.startsWith('audio/') || response.body.byteLength === 0) {
        throw new SoundEffectProviderError(`Stable Audio result ${providerRequestId} is incomplete; automatic redispatch is blocked.`, false, 'ambiguous')
      }
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
        billedCostUsd: STABILITY_STABLE_AUDIO_COST_USD,
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
