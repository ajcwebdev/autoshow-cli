import type { SoundEffectCapabilityFixture, SoundEffectGenerationResponse, SoundEffectRenderTask, SoundEffectRequestEvidence, SoundEffectTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { canonicalTtsJson, canonicalTargetKey, hashCanonicalTtsValue } from '../script-to-audio/contract-identity'

const DOCS = [
  'https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert',
  'https://elevenlabs.io/docs/overview/capabilities/sound-effects',
  'https://elevenlabs.io/docs/help-center/product/content-production/sound-effects/how-much-does-it-cost-to-generate-sound-effects',
  'https://elevenlabs.io/pricing/api?price.platform=api',
]

const fixtureBase = {
  schemaVersion: 1 as const,
  provider: 'elevenlabs' as const,
  model: 'eleven_text_to_sound_v2',
  transport: 'hosted-api' as const,
  endpoint: '/v1/sound-generation' as const,
  serializerVersion: 'elevenlabs.sound-generation.v1',
  checkedAt: '2026-08-13',
  sourceRefs: DOCS,
  constraints: {
    promptMaxScalars: 450,
    durationSeconds: { min: 0.5, max: 30, optional: true },
    promptInfluence: { min: 0, max: 1, default: 0.3 },
    loopModels: ['eleven_text_to_sound_v2'],
    outputFormats: ['mp3_44100_128', 'wav_48000'],
  },
  pricing: {
    currency: 'USD' as const,
    specifiedDurationPerMinute: 0.12,
    automaticDurationPerRequest: null,
  },
}

export const ELEVENLABS_SFX_CAPABILITY_FIXTURE: SoundEffectCapabilityFixture = {
  ...fixtureBase,
  capabilityFixtureHash: hashCanonicalTtsValue(fixtureBase),
}

export type ElevenLabsSoundEffectHttpRequest = (input: {
  method: 'POST'
  path: '/v1/sound-generation'
  query: { output_format: string }
  headers: Record<string, string>
  body: Record<string, unknown>
  cancellation: AbortSignal
}) => Promise<{ status: number, headers?: Headers | Record<string, string> | undefined, body: Uint8Array }>

export class SoundEffectProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly admissionDisposition: 'rejected' | 'ambiguous',
    readonly status?: number | undefined,
    readonly headers?: Headers | Record<string, string> | undefined
  ) {
    super(message)
    this.name = 'SoundEffectProviderError'
  }
}

const header = (headers: Headers | Record<string, string> | undefined, name: string): string | undefined => {
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return typeof entry?.[1] === 'string' ? entry[1] : undefined
}

const defaultRequest = (apiKey: string): ElevenLabsSoundEffectHttpRequest => async (input) => {
  const response = await fetch(`https://api.elevenlabs.io${input.path}?output_format=${encodeURIComponent(input.query.output_format)}`, {
    method: input.method,
    headers: { ...input.headers, 'xi-api-key': apiKey },
    body: JSON.stringify(input.body),
    signal: input.cancellation,
  })
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { status: response.status, headers: response.headers, body: bytes }
}

export const resolveSoundEffectTarget = (selector: string, options: { outputFormat?: string | undefined, promptInfluence?: number | undefined } = {}): SoundEffectTarget => {
  const match = /^([^=]+)=([^=]+)$/u.exec(selector.trim())
  if (!match?.[1] || !match[2]) throw CLIUsageError('--sfx-provider must use provider=model syntax, for example elevenlabs=eleven_text_to_sound_v2 or replicate=sepal/audiogen.')
  const provider = match[1].toLowerCase()
  const model = match[2]
  if (provider === 'replicate') {
    const { resolveReplicateAudioGenTarget } = require('./replicate-audiogen-adapter')
    return resolveReplicateAudioGenTarget(model, options)
  }
  if (provider !== 'elevenlabs') throw CLIUsageError(`Unsupported sound-effect provider ${provider}; expected elevenlabs or replicate.`)
  if (model !== ELEVENLABS_SFX_CAPABILITY_FIXTURE.model) throw CLIUsageError(`Unsupported ElevenLabs sound-effect model ${model}; expected ${ELEVENLABS_SFX_CAPABILITY_FIXTURE.model}.`)
  const outputFormat = options.outputFormat ?? 'mp3_44100_128'
  if (!ELEVENLABS_SFX_CAPABILITY_FIXTURE.constraints.outputFormats.includes(outputFormat)) throw CLIUsageError(`Unsupported ElevenLabs sound-effect output format ${outputFormat}.`)
  const promptInfluence = options.promptInfluence ?? ELEVENLABS_SFX_CAPABILITY_FIXTURE.constraints.promptInfluence?.default ?? 0.3
  if (!Number.isFinite(promptInfluence) || promptInfluence < 0 || promptInfluence > 1) throw CLIUsageError('ElevenLabs sound-effect prompt influence must be between 0 and 1.')
  return {
    provider: 'elevenlabs', model, transport: 'hosted-api',
    targetKey: canonicalTargetKey('sound-effect-generation', 'elevenlabs', model, 'hosted-api'),
    capabilityFixture: ELEVENLABS_SFX_CAPABILITY_FIXTURE,
    outputFormat,
    promptInfluence,
  }
}

export const validateElevenLabsSoundEffectTask = (task: SoundEffectRenderTask, target: SoundEffectTarget): void => {
  const constraints = target.capabilityFixture.constraints
  const promptLength = [...task.prompt].length
  if (promptLength < 1 || promptLength > constraints.promptMaxScalars) throw CLIUsageError(`ElevenLabs sound-effect prompt must contain 1-${constraints.promptMaxScalars} Unicode scalar values.`)
  if (task.durationSeconds !== undefined && (task.durationSeconds < constraints.durationSeconds.min || task.durationSeconds > constraints.durationSeconds.max)) throw CLIUsageError(`ElevenLabs sound-effect duration must be ${constraints.durationSeconds.min}-${constraints.durationSeconds.max} seconds.`)
  if (task.loop && !constraints.loopModels?.includes(target.model)) throw CLIUsageError(`ElevenLabs sound-effect model ${target.model} does not support seamless loop generation.`)
}

export const serializeElevenLabsSoundEffectRequest = (task: SoundEffectRenderTask, target: SoundEffectTarget): {
  path: '/v1/sound-generation'
  query: { output_format: string }
  body: { text: string, model_id: string, duration_seconds: number | null, prompt_influence: number, loop: boolean }
} => {
  validateElevenLabsSoundEffectTask(task, target)
  return {
    path: '/v1/sound-generation',
    query: { output_format: task.outputFormat },
    body: {
      text: task.prompt,
      model_id: target.model,
      duration_seconds: task.durationSeconds ?? null,
      prompt_influence: task.promptInfluence,
      loop: task.loop,
    },
  }
}

export const createElevenLabsSoundEffectAdapter = (input: {
  apiKey: string
  request?: ElevenLabsSoundEffectHttpRequest | undefined
  now?: (() => string) | undefined
}) => {
  if (!input.apiKey.trim()) throw CLIUsageError('ElevenLabs sound-effect execution requires ELEVENLABS_API_KEY.')
  const request = input.request ?? defaultRequest(input.apiKey)
  const now = input.now ?? (() => new Date().toISOString())
  return {
    generate: async (task: SoundEffectRenderTask, target: SoundEffectTarget, requestOrdinal: number, cancellation: AbortSignal): Promise<SoundEffectGenerationResponse> => {
      cancellation.throwIfAborted()
      const serialized = serializeElevenLabsSoundEffectRequest(task, target)
      const response = await request({ method: 'POST', ...serialized, headers: { 'content-type': 'application/json', accept: 'audio/mpeg,audio/wav;q=0.9' }, cancellation })
      if (response.status < 200 || response.status >= 300) {
        const rejected = response.status < 500 && response.status !== 408 && response.status !== 409
        const retryable = response.status === 429
        throw new SoundEffectProviderError(`ElevenLabs sound generation failed with HTTP ${response.status}.`, retryable, rejected ? 'rejected' : 'ambiguous', response.status, response.headers)
      }
      if (response.body.byteLength === 0) throw CLIUsageError('ElevenLabs sound generation returned empty audio.')
      const contentType = header(response.headers, 'content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
      if (!/^audio\/(?:mpeg|mp3|wav|wave|x-wav)$/iu.test(contentType)) throw CLIUsageError(`ElevenLabs sound generation returned unsupported content type ${contentType}.`)
      const providerRequestId = header(response.headers, 'request-id') ?? header(response.headers, 'x-request-id')
      const rawCharacterCost = header(response.headers, 'character-cost')
      const observedCharacterCost = rawCharacterCost !== undefined && /^\d+$/u.test(rawCharacterCost) ? Number(rawCharacterCost) : undefined
      const evidenceBase = {
        schemaVersion: 1 as const,
        requestIdentity: task.requestIdentity,
        requestOrdinal,
        endpoint: serialized.path,
        serializerVersion: target.capabilityFixture.serializerVersion,
        requestBodyHash: hashCanonicalTtsValue(serialized.body),
        queryHash: hashCanonicalTtsValue(serialized.query),
        ...(providerRequestId ? { providerRequestId } : {}),
        observedContentType: contentType,
        ...(observedCharacterCost !== undefined ? { observedCharacterCost } : {}),
        capturedAt: now(),
      }
      const requestEvidence: SoundEffectRequestEvidence = { ...evidenceBase, requestEvidenceId: hashCanonicalTtsValue(evidenceBase) }
      return { bytes: response.body, contentType, ...(providerRequestId ? { providerRequestId } : {}), ...(observedCharacterCost !== undefined ? { observedCharacterCost } : {}), requestEvidence }
    },
    canonicalRequestJson: (task: SoundEffectRenderTask, target: SoundEffectTarget): string => canonicalTtsJson(serializeElevenLabsSoundEffectRequest(task, target)),
  }
}
