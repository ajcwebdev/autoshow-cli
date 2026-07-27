import { ensureAssemblyAiSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/assemblyai/assemblyai'
import { ensureDeepgramSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-deepgram/deepgram-stt'
import { ensureDeepinfraSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/deepinfra/deepinfra'
import { ensureGladiaSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gladia/gladia'
import { ensureGrokSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-grok/grok-stt'
import { ensureGroqSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-groq/groq-stt'
import { ensureHappyScribeSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/happyscribe'
import { ensureMistralSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/mistral-stt'
import { ensureGeminiSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gemini-stt/gemini-stt'
import { ensureTogetherSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/together/together'
import { ensureRevSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/rev/rev'
import { ensureSonioxSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/soniox/soniox'
import { ensureSupadataSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-supadata/supadata'
import { ensureScrapeCreatorsSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/scrapecreators/scrapecreators'
import { ensureSpeechmaticsSttSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/speechmatics/speechmatics'
import { ensureReverbRuntimeSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb'
import { ensureWhisperReady } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper'
import { ensureWhisperfileReady } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisperfile/whisperfile'
import { ensureGlmOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { ensureKimiOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/kimi-ocr/kimi'
import { ensureGeminiOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gemini-ocr/gemini-ocr'
import { ensureGrokOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/grok-ocr/grok-ocr'
import { ensureMistralOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/mistral-ocr/mistral-ocr'
import { ensureOpenAIOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/openai-ocr/openai-ocr'
import { ensureAnthropicOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/anthropic-ocr/anthropic-ocr'
import { ensureDeepinfraOcrSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/deepinfra-ocr/deepinfra-ocr'
import { ensureTesseractSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/tesseract-utils'
import { ensureDeepgramTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepgram/deepgram-tts'
import { ensureHumeTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/hume/hume-tts'
import { ensureCartesiaTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/cartesia-tts'
import { ensureGrokTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-grok/grok-tts'
import { ensureMistralTtsSetup } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-mistral/mistral-tts'
import type { BootstrapHandler } from '~/types'
import { InternalError } from '~/utils/error-handler'

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
  reverb: {
    ensure: async () => await ensureReverbRuntimeSetup()
  },
  'deepgram-stt': {
    ensure: async () => await ensureDeepgramSttSetup()
  },
  'deepinfra-stt': {
    ensure: async () => await ensureDeepinfraSttSetup()
  },
  'soniox-stt': {
    ensure: async () => await ensureSonioxSttSetup()
  },
  'speechmatics-stt': {
    ensure: async () => await ensureSpeechmaticsSttSetup()
  },
  'rev-stt': {
    ensure: async () => await ensureRevSttSetup()
  },
  'groq-stt': {
    ensure: async () => await ensureGroqSttSetup()
  },
  'grok-stt': {
    ensure: async () => await ensureGrokSttSetup()
  },
  'mistral-stt': {
    ensure: async () => await ensureMistralSttSetup()
  },
  'assemblyai-stt': {
    ensure: async () => await ensureAssemblyAiSttSetup()
  },
  'gladia-stt': {
    ensure: async () => await ensureGladiaSttSetup()
  },
  'happyscribe-stt': {
    ensure: async () => await ensureHappyScribeSttSetup()
  },
  'supadata-stt': {
    ensure: async () => await ensureSupadataSttSetup()
  },
  'scrapecreators-stt': {
    ensure: async () => await ensureScrapeCreatorsSttSetup()
  },
  'gemini-stt': {
    ensure: async () => await ensureGeminiSttSetup()
  },
  'together-stt': {
    ensure: async () => await ensureTogetherSttSetup()
  },
  tesseract: {
    ensure: async () => await ensureTesseractSetup()
  },
  'mistral-ocr': {
    ensure: async () => await ensureMistralOcrSetup()
  },
  'glm-ocr': {
    ensure: async () => await ensureGlmOcrSetup()
  },
  'kimi-ocr': {
    ensure: async () => await ensureKimiOcrSetup()
  },
  'openai-ocr': {
    ensure: async () => await ensureOpenAIOcrSetup()
  },
  'grok-ocr': {
    ensure: async () => await ensureGrokOcrSetup()
  },
  'anthropic-ocr': {
    ensure: async () => await ensureAnthropicOcrSetup()
  },
  'gemini-ocr': {
    ensure: async () => await ensureGeminiOcrSetup()
  },
  'deepinfra-ocr': {
    ensure: async () => await ensureDeepinfraOcrSetup()
  },
  'deepgram-tts': {
    ensure: async () => await ensureDeepgramTtsSetup()
  },
  'hume-tts': {
    ensure: async () => await ensureHumeTtsSetup()
  },
  'cartesia-tts': {
    ensure: async () => await ensureCartesiaTtsSetup()
  },
  'grok-tts': {
    ensure: async () => await ensureGrokTtsSetup()
  },
  'mistral-tts': {
    ensure: async () => await ensureMistralTtsSetup()
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
