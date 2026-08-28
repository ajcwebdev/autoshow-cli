import { ensureWhisperReady } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { ensureWhisperfileReady } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisperfile/whisperfile'
import type { BootstrapHandler } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { resolveCredential } from '~/utils/validate/env-utils'

const DEFAULT_WHISPER_MODEL = 'tiny'
const cache = new Map<string, Promise<void>>()

const parseProviderToken = (
  provider: string
): { key: string, model?: string } => {
  const trimmed = provider.trim()
  if (trimmed.length === 0) {
    throw InternalError('Provider name is required', { stage: 'setup:bootstrap' })
  }

  const parts = trimmed.split(':')
  const rawKey = parts[0]
  if (typeof rawKey !== 'string') {
    throw InternalError('Provider name is required', { stage: 'setup:bootstrap' })
  }

  const key = rawKey.trim().toLowerCase()
  const model = parts.slice(1).join(':').trim()
  return {
    key,
    ...(model.length > 0 ? { model } : {})
  }
}

const handlers: Record<string, BootstrapHandler> = {
  whisper: {
    ensure: async (model) => await ensureWhisperReady(model ?? DEFAULT_WHISPER_MODEL)
  },
  whisperfile: {
    ensure: async (model) => await ensureWhisperfileReady(model ?? DEFAULT_WHISPER_MODEL)
  },
  'deepgram-stt': {
    ensure: async (): Promise<void> => { resolveCredential('deepgram', 'require', { stage: 'stt:deepgram', description: 'Deepgram transcription' }) }
  },
  'deepinfra-stt': {
    ensure: async (): Promise<void> => { resolveCredential('deepinfra', 'require', { stage: 'stt:deepinfra', description: 'DeepInfra transcription' }) }
  },
  'soniox-stt': {
    ensure: async (): Promise<void> => { resolveCredential('soniox', 'require', { stage: 'stt:soniox', description: 'Soniox transcription' }) }
  },
  'speechmatics-stt': {
    ensure: async (): Promise<void> => { resolveCredential('speechmatics', 'require', { stage: 'stt:speechmatics', description: 'Speechmatics transcription' }) }
  },
  'groq-stt': {
    ensure: async (): Promise<void> => { resolveCredential('groq', 'require', { stage: 'stt:groq', description: 'Groq transcription' }) }
  },
  'grok-stt': {
    ensure: async (): Promise<void> => { resolveCredential('grok', 'require', { stage: 'stt:grok', description: 'Grok transcription' }) }
  },
  'mistral-stt': {
    ensure: async (): Promise<void> => { resolveCredential('mistral', 'require', { stage: 'stt:mistral', description: 'Mistral transcription' }) }
  },
  'assemblyai-stt': {
    ensure: async (): Promise<void> => { resolveCredential('assemblyai', 'require', { stage: 'stt:assemblyai', description: 'AssemblyAI transcription' }) }
  },
  'gladia-stt': {
    ensure: async (): Promise<void> => { resolveCredential('gladia', 'require', { stage: 'stt:gladia', description: 'Gladia transcription' }) }
  },
  'happyscribe-stt': {
    ensure: async (): Promise<void> => { resolveCredential('happyscribe', 'require', { stage: 'stt:happyscribe', description: 'Happy Scribe transcription' }) }
  },
  'supadata-stt': {
    ensure: async (): Promise<void> => { resolveCredential('supadata', 'require', { stage: 'stt:supadata', description: 'Supadata transcription' }) }
  },
  'scrapecreators-stt': {
    ensure: async (): Promise<void> => { resolveCredential('scrapecreators', 'require', { stage: 'stt:scrapecreators', description: 'ScrapeCreators transcript retrieval' }) }
  },
  'gemini-stt': {
    ensure: async (): Promise<void> => { resolveCredential('gemini', 'require', { stage: 'stt:gemini', description: 'Gemini transcription' }) }
  },
  'together-stt': {
    ensure: async (): Promise<void> => { resolveCredential('together', 'require', { stage: 'stt:together', description: 'Together transcription' }) }
  },
}

const resolveHandler = (provider: string): { cacheKey: string, handler: BootstrapHandler, model?: string } => {
  const { key, model } = parseProviderToken(provider)
  const handler = handlers[key]
  if (!handler) {
    throw InternalError(`Unsupported bootstrap provider: ${provider}`, { stage: 'setup:bootstrap' })
  }

  return {
    cacheKey: model ? `${key}:${model}` : key,
    handler,
    ...(model ? { model } : {})
  }
}

const runCached = async (
  cacheKey: string,
  operation: () => Promise<void>
): Promise<void> => {
  let pending = cache.get(cacheKey)
  if (!pending) {
    pending = operation().catch((error) => {
      cache.delete(cacheKey)
      throw error
    })
    cache.set(cacheKey, pending)
  }

  await pending
}

export const ensureProviderReady = async (provider: string): Promise<void> => {
  const resolved = resolveHandler(provider)
  await runCached(resolved.cacheKey, async () => {
    await resolved.handler.ensure(resolved.model)
  })
}
