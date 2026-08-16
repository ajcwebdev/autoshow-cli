import type { AccountCapabilityState, SanitizedProviderError, TtsProvider, TtsTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { readEnv } from '~/utils/validate/env-utils'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { parseHumeVoiceCatalogEnvelope } from '../tts-services/hume/hume-advanced-provider'

const HOSTED_TTS_CREDENTIALS = {
  elevenlabs: { env: 'ELEVENLABS_API_KEY', label: 'ElevenLabs TTS' },
  minimax: { env: 'MINIMAX_API_KEY', label: 'MiniMax TTS' },
  groq: { env: 'GROQ_API_KEY', label: 'Groq TTS' },
  grok: { env: 'XAI_API_KEY', label: 'Grok TTS' },
  mistral: { env: 'MISTRAL_API_KEY', label: 'Mistral TTS' },
  openai: { env: 'OPENAI_API_KEY', label: 'OpenAI TTS' },
  gemini: { env: 'GEMINI_API_KEY', label: 'Gemini TTS' },
  deepgram: { env: 'DEEPGRAM_API_KEY', label: 'Deepgram TTS' },
  speechify: { env: 'SPEECHIFY_API_KEY', label: 'Speechify TTS' },
  hume: { env: 'HUME_API_KEY', label: 'Hume TTS' },
  cartesia: { env: 'CARTESIA_API_KEY', label: 'Cartesia TTS' },
  fish: { env: 'FISH_API_KEY', label: 'Fish Audio TTS' },
  inworld: { env: 'INWORLD_API_KEY', label: 'Inworld AI TTS' },
  deepinfra: { env: 'DEEPINFRA_API_KEY', label: 'DeepInfra TTS' },
  replicate: { env: 'REPLICATE_API_TOKEN', label: 'Replicate TTS' },
  fal: { env: 'FAL_API_KEY', label: 'fal.ai TTS' }
} as const satisfies Record<TtsProvider, { env: string, label: string }>

export type TtsExecutionReadinessObservation = Readonly<{
  targetKey: string
  accountState: AccountCapabilityState
  status: 'ready' | 'blocked'
  error?: SanitizedProviderError | undefined
}>

/**
 * A blocked pre-ingest observation stays authoritative because protected capabilities were not
 * materialized. Otherwise a fresh observation may narrow ready to blocked, but never widen a
 * previously blocked target back to ready inside the same execution admission.
 */
export const mergeTtsExecutionReadinessObservations = (
  preIngest: readonly TtsExecutionReadinessObservation[],
  fresh: readonly TtsExecutionReadinessObservation[]
): TtsExecutionReadinessObservation[] => {
  const freshByTargetKey = new Map(fresh.map((entry) => [entry.targetKey, entry] as const))
  const merged = preIngest.map((entry) =>
    entry.status === 'blocked' ? entry : freshByTargetKey.get(entry.targetKey) ?? entry
  )
  const retainedKeys = new Set(merged.map((entry) => entry.targetKey))
  for (const entry of fresh) {
    if (!retainedKeys.has(entry.targetKey)) merged.push(entry)
  }
  return merged
}

const missingCredentialObservation = (
  targetKey: string,
  env: string,
  label: string
): TtsExecutionReadinessObservation => ({
  targetKey,
  accountState: 'not-configured',
  status: 'blocked',
  error: {
    phase: 'readiness',
    code: 'provider-credential-not-configured',
    message: `${env} environment variable is required for ${label}.`,
    retryable: false,
    blockedReason: 'provider-credential-not-configured'
  }
})

const probeRuntimeTool = async (binary: string): Promise<boolean> => {
  try {
    const process = Bun.spawn([binary, '-version'], { stdout: 'ignore', stderr: 'ignore' })
    return await process.exited === 0
  } catch {
    return false
  }
}

const blockedMediaRuntimeObservation = (
  targetKey: string,
  unavailableTools: readonly string[]
): TtsExecutionReadinessObservation => ({
  targetKey,
  accountState: 'unavailable',
  status: 'blocked',
  error: {
    phase: 'readiness',
    code: 'local-media-runtime-not-ready',
    message: `TTS requires working ffmpeg and ffprobe binaries before synthesis; unavailable: ${unavailableTools.join(', ')}. Run \`bun autoshow setup\`, then retry.`,
    retryable: false,
    blockedReason: 'local-setup-required'
  }
})

const advancedVoiceBlockedObservation = (
  targetKey: string,
  code: string,
  message: string,
  retryable: boolean
): TtsExecutionReadinessObservation => ({
  targetKey,
  accountState: 'unavailable',
  status: 'blocked',
  error: { phase: 'readiness', code, message, retryable, blockedReason: code }
})

export const listHumeVoiceIdsForReadiness = async (
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<Set<string>> => {
  const availableIds = new Set<string>()
  for (const provider of ['HUME_AI', 'CUSTOM_VOICE'] as const) {
    let pageNumber = 0
    let totalPages = 1
    do {
      const response = await fetchImpl(`https://api.hume.ai/v0/tts/voices?${new URLSearchParams({ provider, page_number: String(pageNumber), page_size: '100' })}`, { headers: { 'X-Hume-Api-Key': apiKey } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const page = parseHumeVoiceCatalogEnvelope(await response.json())
      if (page.pageNumber !== pageNumber) throw new Error('Hume voice catalog returned an unexpected page number.')
      for (const value of page.voices) {
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { id?: unknown }).id === 'string') availableIds.add((value as { id: string }).id)
      }
      totalPages = page.totalPages
      pageNumber++
    } while (pageNumber < totalPages)
  }
  return availableIds
}

export const listInworldVoiceIdsForReadiness = async (
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<Set<string>> => {
  const authorization = apiKey.startsWith('Basic ') ? apiKey : `Basic ${apiKey}`
  const response = await fetchImpl('https://api.inworld.ai/voices/v1/voices?languages=EN_US', {
    headers: { Authorization: authorization }
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = await response.json() as { voices?: unknown }
  if (!Array.isArray(payload.voices)) throw new Error('Inworld voice catalog response omits voices.')
  return new Set(payload.voices.flatMap(value =>
    value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { voiceId?: unknown }).voiceId === 'string'
      ? [(value as { voiceId: string }).voiceId]
      : []
  ))
}

const checkAdvancedVoiceReadiness = async (
  target: TtsTarget,
  apiKey: string
): Promise<TtsExecutionReadinessObservation> => {
  const targetKey = target.targetKey as string
  const voiceIds = [...new Set(target.readinessVoiceIds ?? [])]
  if (voiceIds.length === 0 || !['elevenlabs', 'hume', 'minimax', 'cartesia', 'speechify', 'inworld'].includes(target.service)) {
    return { targetKey, accountState: 'available', status: 'ready' }
  }
  try {
    if (target.service === 'elevenlabs') {
      const results = await Promise.all(voiceIds.map(async voiceId => {
        const response = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(voiceId)}`, { headers: { 'xi-api-key': apiKey } })
        if (!response.ok) return false
        const payload = await response.json() as { voice_id?: unknown, high_quality_base_model_ids?: unknown, sharing?: { disable_at_unix?: unknown } | null, fine_tuning?: { state?: Record<string, unknown> } | null }
        if (payload.voice_id !== voiceId) return false
        const relevantFineTuningState = payload.fine_tuning?.state?.[target.model]
        if (relevantFineTuningState === 'not_verified' || relevantFineTuningState === 'not_started' || relevantFineTuningState === 'failed') return false
        const modelIds = Array.isArray(payload.high_quality_base_model_ids) ? payload.high_quality_base_model_ids.filter(value => typeof value === 'string') : []
        if (modelIds.length > 0 && !modelIds.includes(target.model)) return false
        const disableAtUnix = payload.sharing?.disable_at_unix
        return typeof disableAtUnix !== 'number' || disableAtUnix * 1000 > Date.now()
      }))
      if (results.some(ready => !ready)) return advancedVoiceBlockedObservation(targetKey, 'elevenlabs-voice-not-ready', 'One or more approved ElevenLabs voices are missing, inaccessible, or not synthesis-ready for the configured account.', false)
      return { targetKey, accountState: 'available', status: 'ready' }
    }
    if (target.service === 'hume') {
      const availableIds = await listHumeVoiceIdsForReadiness(apiKey)
      if (voiceIds.some(voiceId => !availableIds.has(voiceId))) return advancedVoiceBlockedObservation(targetKey, 'hume-voice-not-ready', 'One or more approved Hume voices are missing or inaccessible for the configured account.', false)
      return { targetKey, accountState: 'available', status: 'ready' }
    }
    if (target.service === 'inworld') {
      const availableIds = await listInworldVoiceIdsForReadiness(apiKey)
      const missingVoiceIds = voiceIds.filter(voiceId => !availableIds.has(voiceId))
      if (missingVoiceIds.length > 0) return advancedVoiceBlockedObservation(targetKey, 'inworld-voice-not-ready', `Approved Inworld voice ${missingVoiceIds.join(', ')} is missing or inaccessible for the configured account. Run \`bun autoshow voice list --provider inworld --source provider-library\` and update the casting profile before synthesis.`, false)
      return { targetKey, accountState: 'available', status: 'ready' }
    }
    if (target.service === 'minimax') {
      const response = await fetch('https://api.minimax.io/v1/get_voice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_type: 'all' })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json() as Record<string, unknown>
      const baseResponse = payload['base_resp']
      const statusCode = baseResponse && typeof baseResponse === 'object' && !Array.isArray(baseResponse) ? (baseResponse as Record<string, unknown>)['status_code'] : undefined
      if (typeof statusCode === 'number' && statusCode !== 0) throw new Error('MiniMax base response failed')
      const availableIds = new Set(['system_voice', 'voice_cloning', 'voice_generation'].flatMap(key => {
        const voices = payload[key]
        return Array.isArray(voices) ? voices.flatMap(value => value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { voice_id?: unknown }).voice_id === 'string' ? [(value as { voice_id: string }).voice_id] : []) : []
      }))
      if (voiceIds.some(voiceId => !availableIds.has(voiceId))) return advancedVoiceBlockedObservation(targetKey, 'minimax-voice-not-ready', 'One or more approved MiniMax voices are missing, inactive, expired, or inaccessible for the configured account.', false)
      return { targetKey, accountState: 'available', status: 'ready' }
    }
    if (target.service === 'cartesia') {
      const results = await Promise.all(voiceIds.map(async voiceId => {
        const response = await fetch(`https://api.cartesia.ai/voices/${encodeURIComponent(voiceId)}`, { headers: { Authorization: `Bearer ${apiKey}`, 'Cartesia-Version': '2026-03-01' } })
        if (!response.ok) return false
        const payload = await response.json() as { id?: unknown }
        return payload.id === voiceId
      }))
      if (results.some(ready => !ready)) return advancedVoiceBlockedObservation(targetKey, 'cartesia-voice-not-ready', 'One or more approved Cartesia voices are missing or inaccessible for the configured account.', false)
      return { targetKey, accountState: 'available', status: 'ready' }
    }
    const results = await Promise.all(voiceIds.map(async voiceId => {
      const response = await fetch(`https://api.speechify.ai/v1/voices/${encodeURIComponent(voiceId)}`, { headers: { Authorization: `Bearer ${apiKey}` } })
      if (!response.ok) return false
      const payload = await response.json() as { id?: unknown, models?: unknown }
      if (payload.id !== voiceId) return false
      const modelIds = Array.isArray(payload.models) ? payload.models.flatMap(value => value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { name?: unknown }).name === 'string' ? [(value as { name: string }).name] : []) : []
      return modelIds.length === 0 || modelIds.includes(target.model)
    }))
    if (results.some(ready => !ready)) return advancedVoiceBlockedObservation(targetKey, 'speechify-voice-not-ready', 'One or more approved Speechify voices are missing, inaccessible, or unavailable for the selected model.', false)
    return { targetKey, accountState: 'available', status: 'ready' }
  } catch {
    const label = target.service === 'elevenlabs' ? 'ElevenLabs' : target.service === 'hume' ? 'Hume' : target.service === 'minimax' ? 'MiniMax' : target.service === 'cartesia' ? 'Cartesia' : target.service === 'inworld' ? 'Inworld' : 'Speechify'
    return advancedVoiceBlockedObservation(targetKey, `${target.service}-readiness-inspection-failed`, `${label} read-only voice readiness inspection failed before synthesis.`, true)
  }
}

export const validateTtsTargetsForExecution = (
  targets: readonly TtsTarget[]
): Promise<TtsExecutionReadinessObservation[]> => {
  if (targets.length === 0) {
    throw CLIUsageError('TTS execution requires at least one fully validated target.')
  }
  const targetKeys = new Set<string>()
  for (const target of targets) {
    if (
      (target.operation !== 'tts-synthesis' && target.operation !== 'comic-audio')
      || !target.targetKey
      || !target.transport
      || !target.model.trim()
    ) {
      throw CLIUsageError(`Audio target ${target.service}/${target.model} is missing complete operation-scoped execution identity.`)
    }
    if (target.targetKey !== canonicalTargetKey(target.operation, target.service, target.model, target.transport)) {
      throw CLIUsageError(`Audio target ${target.service}/${target.model} has a non-canonical operation-scoped execution identity.`)
    }
    if (targetKeys.has(target.targetKey)) {
      throw CLIUsageError(`Duplicate operation-scoped TTS execution target: ${target.targetKey}`)
    }
    targetKeys.add(target.targetKey)
  }

  return (async () => {
    const toolChecks = await Promise.all([
      probeRuntimeTool(getFfmpegBinary()),
      probeRuntimeTool(getFfprobeBinary())
    ])
    const unavailableTools = ['ffmpeg', 'ffprobe'].filter((_tool, index) => !toolChecks[index])
    if (unavailableTools.length > 0) {
      return targets.map((target) => blockedMediaRuntimeObservation(target.targetKey as string, unavailableTools))
    }

    const humeReadinessByVoiceSet = new Map<string, Promise<TtsExecutionReadinessObservation>>()

    return await Promise.all(targets.map(async (target): Promise<TtsExecutionReadinessObservation> => {
      const credential = HOSTED_TTS_CREDENTIALS[target.service]
      const apiKey = readEnv(credential.env)
      if (apiKey && target.service === 'hume' && (target.readinessVoiceIds?.length ?? 0) > 0) {
        const voiceSetKey = [...new Set(target.readinessVoiceIds)].sort().join('\0')
        let probe = humeReadinessByVoiceSet.get(voiceSetKey)
        if (!probe) {
          probe = checkAdvancedVoiceReadiness(target, apiKey)
          humeReadinessByVoiceSet.set(voiceSetKey, probe)
        }
        const observation = await probe
        return { ...observation, targetKey: target.targetKey as string }
      }
      return apiKey
        ? await checkAdvancedVoiceReadiness(target, apiKey)
        : missingCredentialObservation(target.targetKey as string, credential.env, credential.label)
    }))
  })()
}
