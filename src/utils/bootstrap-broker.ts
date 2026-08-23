import { ensureWhisperReady } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { ensureWhisperfileReady } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisperfile/whisperfile'
import type { BootstrapHandler } from '~/types'
import { InternalError } from '~/utils/error-handler'
import { requireProviderKey } from '~/utils/validate/env-utils'

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
    ensure: async (): Promise<void> => { requireProviderKey('deepgram', 'stt:deepgram', 'Deepgram transcription') }
  },
  'deepinfra-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('deepinfra', 'stt:deepinfra', 'DeepInfra transcription') }
  },
  'soniox-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('soniox', 'stt:soniox', 'Soniox transcription') }
  },
  'speechmatics-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('speechmatics', 'stt:speechmatics', 'Speechmatics transcription') }
  },
  'groq-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('groq', 'stt:groq', 'Groq transcription') }
  },
  'grok-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('grok', 'stt:grok', 'Grok transcription') }
  },
  'mistral-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('mistral', 'stt:mistral', 'Mistral transcription') }
  },
  'assemblyai-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('assemblyai', 'stt:assemblyai', 'AssemblyAI transcription') }
  },
  'gladia-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('gladia', 'stt:gladia', 'Gladia transcription') }
  },
  'happyscribe-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('happyscribe', 'stt:happyscribe', 'Happy Scribe transcription') }
  },
  'supadata-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('supadata', 'stt:supadata', 'Supadata transcription') }
  },
  'scrapecreators-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('scrapecreators', 'stt:scrapecreators', 'ScrapeCreators transcript retrieval') }
  },
  'gemini-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('gemini', 'stt:gemini', 'Gemini transcription') }
  },
  'together-stt': {
    ensure: async (): Promise<void> => { requireProviderKey('together', 'stt:together', 'Together transcription') }
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
