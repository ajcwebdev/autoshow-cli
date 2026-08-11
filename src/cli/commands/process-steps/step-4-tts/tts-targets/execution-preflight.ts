import type { AccountCapabilityState, SanitizedProviderError, TtsProvider, TtsTarget } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { readEnv } from '~/utils/validate/env-utils'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { isKittenTtsSetupReady } from '../tts-local/kitten/kitten-tts-targets'
import { hasCachedKittenTtsModel } from '../tts-local/kitten/kitten-tts-model-cache'

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
  cartesia: { env: 'CARTESIA_API_KEY', label: 'Cartesia TTS' }
} as const satisfies Record<Exclude<TtsProvider, 'kitten'>, { env: string, label: string }>

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

const blockedKittenObservation = (
  targetKey: string,
  code: 'local-tts-runtime-not-ready' | 'local-tts-model-not-cached' | 'local-tts-readiness-check-failed',
  message: string
): TtsExecutionReadinessObservation => ({
  targetKey,
  accountState: 'unavailable',
  status: 'blocked',
  error: {
    phase: 'readiness',
    code,
    message,
    retryable: false,
    blockedReason: 'local-setup-required'
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

export const validateTtsTargetsForExecution = (
  targets: readonly TtsTarget[]
): Promise<TtsExecutionReadinessObservation[]> => {
  if (targets.length === 0) {
    throw CLIUsageError('TTS execution requires at least one fully validated target.')
  }
  const targetKeys = new Set<string>()
  for (const target of targets) {
    if (
      target.operation !== 'tts-synthesis'
      || !target.targetKey
      || !target.transport
      || !target.model.trim()
    ) {
      throw CLIUsageError(`TTS target ${target.service}/${target.model} is missing complete operation-scoped execution identity.`)
    }
    if (target.targetKey !== canonicalTargetKey(target.operation, target.service, target.model, target.transport)) {
      throw CLIUsageError(`TTS target ${target.service}/${target.model} has a non-canonical operation-scoped execution identity.`)
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

    const kittenTargets = targets.filter((target) => target.service === 'kitten')
    let kittenSetupReady = true
    let kittenProbeError: unknown
    const kittenModelReady = new Map<string, boolean>()
    if (kittenTargets.length > 0) {
      try {
        kittenSetupReady = await isKittenTtsSetupReady()
        const models = [...new Set(kittenTargets.map((target) => target.model))]
        const cacheResults = await Promise.all(models.map(async (model) => [model, await hasCachedKittenTtsModel(model)] as const))
        for (const [model, ready] of cacheResults) kittenModelReady.set(model, ready)
      } catch (error) {
        kittenProbeError = error
      }
    }

    return targets.map((target): TtsExecutionReadinessObservation => {
      if (target.service === 'kitten') {
        if (kittenProbeError !== undefined) {
          return blockedKittenObservation(
            target.targetKey as string,
            'local-tts-readiness-check-failed',
            'Kitten TTS readiness could not be verified without mutation. Run `bun autoshow setup --step tts`, then retry.'
          )
        }
        if (!kittenSetupReady) {
          return blockedKittenObservation(
            target.targetKey as string,
            'local-tts-runtime-not-ready',
            'Kitten TTS runtime or required Python imports are not ready. Run `bun autoshow setup --step tts` before synthesis.'
          )
        }
        if (!kittenModelReady.get(target.model)) {
          return blockedKittenObservation(
            target.targetKey as string,
            'local-tts-model-not-cached',
            `Kitten TTS model ${target.model} is not cached. Run \`bun autoshow setup --step tts\` before synthesis.`
          )
        }
        return { targetKey: target.targetKey as string, accountState: 'available', status: 'ready' }
      }
      const credential = HOSTED_TTS_CREDENTIALS[target.service]
      return readEnv(credential.env)
        ? { targetKey: target.targetKey as string, accountState: 'available', status: 'ready' }
        : missingCredentialObservation(target.targetKey as string, credential.env, credential.label)
    })
  })()
}
