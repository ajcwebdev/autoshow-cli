import type { SanitizedProviderError, TtsExecutionReadinessObservation, TtsTarget } from '~/types'
import { CLIUsageError, extractErrorMetadata, ProviderError, ValidationError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { findHostedTtsCredential } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { childEnv } from '~/utils/child-env'
import { parseHumeVoiceCatalogEnvelope } from '../tts-services/hume/hume-advanced-provider'

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
    const process = Bun.spawn([binary, '-version'], { env: childEnv(), stdout: 'ignore', stderr: 'ignore' })
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
  retryable: boolean,
  detail: Partial<Pick<SanitizedProviderError, 'status' | 'stage' | 'errorName' | 'providerMessage'>> = {}
): TtsExecutionReadinessObservation => ({
  targetKey,
  accountState: 'unavailable',
  status: 'blocked',
  error: { phase: 'readiness', code, message, retryable, blockedReason: code, ...detail }
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
      if (!response.ok) {
        throw ProviderError(`Hume voice catalog request failed (HTTP ${response.status}).`, {
          stage: 'tts:readiness',
          status: response.status,
          headers: response.headers
        })
      }
      const page = parseHumeVoiceCatalogEnvelope(await response.json())
      if (page.pageNumber !== pageNumber) {
        throw ValidationError('Hume voice catalog returned an unexpected page number.', { stage: 'tts:readiness', retryable: false })
      }
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
  if (!response.ok) {
    throw ProviderError(`Inworld voice catalog request failed (HTTP ${response.status}).`, {
      stage: 'tts:readiness',
      status: response.status,
      headers: response.headers
    })
  }
  const payload = await response.json() as { voices?: unknown }
  if (!Array.isArray(payload.voices)) {
    throw ValidationError('Inworld voice catalog response omits voices.', { stage: 'tts:readiness', retryable: false })
  }
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
      if (!response.ok) {
        throw ProviderError(`MiniMax voice catalog request failed (HTTP ${response.status}).`, {
          stage: 'tts:readiness',
          status: response.status,
          headers: response.headers
        })
      }
      const payload = await response.json() as Record<string, unknown>
      const baseResponse = payload['base_resp']
      const statusCode = baseResponse && typeof baseResponse === 'object' && !Array.isArray(baseResponse) ? (baseResponse as Record<string, unknown>)['status_code'] : undefined
      if (typeof statusCode === 'number' && statusCode !== 0) {
        throw ValidationError(`MiniMax voice catalog returned a failed base response (status_code ${statusCode}).`, {
          stage: 'tts:readiness',
          retryable: false,
          metadata: { statusCode }
        })
      }
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
  } catch (error) {
    const label = target.service === 'elevenlabs' ? 'ElevenLabs' : target.service === 'hume' ? 'Hume' : target.service === 'minimax' ? 'MiniMax' : target.service === 'cartesia' ? 'Cartesia' : target.service === 'inworld' ? 'Inworld' : 'Speechify'
    const metadata = extractErrorMetadata(error)
    const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
    const retryable = metadata['retryable'] === false ? false : true
    return advancedVoiceBlockedObservation(
      targetKey,
      `${target.service}-readiness-inspection-failed`,
      `${label} read-only voice readiness inspection failed before synthesis.`,
      retryable,
      {
        ...(status !== undefined ? { status } : {}),
        ...(typeof metadata['stage'] === 'string' ? { stage: metadata['stage'] } : {}),
        ...(error instanceof Error ? { errorName: error.name, providerMessage: error.message } : {})
      }
    )
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
      const credential = findHostedTtsCredential(target.service)
      if (!credential?.ttsPreflight) {
        throw ValidationError(`TTS provider ${target.service} has no credential specification.`, {
          stage: 'tts:readiness',
          retryable: false
        })
      }
      const observation = resolveCredential(credential.providerId, 'observe', {
        description: credential.ttsPreflight.label
      })
      const apiKey = observation.value
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
        : missingCredentialObservation(target.targetKey as string, observation.envVar, credential.ttsPreflight.label)
    }))
  })()
}
