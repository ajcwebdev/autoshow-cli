import { rethrowAsUsage, UsageError } from '~/utils/error-handler'
import {
  validateOpenAIModel,
  validateGeminiModel,
  validateAnthropicModel,
  validateGrokModel,
  validateWhisperfileModel,
  validateDeepinfraSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateGrokSttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
  validateGladiaSttModel,
  validateScrapeCreatorsSttModel,
  validateGeminiSttModel,
  validateTogetherSttModel,
  validateOpenAISttModel,
  validateCloudflareSttModel,
  validateAnthropicOcrModel,
  validateGeminiOcrModel,
  validateMistralOcrModel,
  validateOpenAIOcrModel,
  validateGrokOcrModel,
  validateElevenlabsTtsModel,
  validateSonioxTtsModel,
  validateGrokTtsModel,
  validateGeminiTtsModel,
  validateOpenAITtsModel,
  validateInworldTtsModel,
  validateElevenlabsMusicModel,
  validateMinimaxMusicModel,
  validateGeminiMusicModel,
  validateGeminiImageModel,
  validateGrokImageModel,
  validateOpenAIImageModel,
  validateGeminiVideoModel,
  validateGrokVideoModel
} from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import type { AllShortcutFlag, BuildOptsDefaults, FlagOccurrenceValue, RepeatableModelFlag } from '~/types'
import { appendUnique, expandAllShortcutModels } from './model-flag-selection'

export const validateCliValue = <T>(validator: (value: string) => T, value: string): T =>
  rethrowAsUsage(() => validator(value))

export const readRuntimeModelOptions = (
  flags: Record<string, unknown>,
  rawModelOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>,
  allShortcutFlags: Record<AllShortcutFlag, boolean>,
  _defaults: BuildOptsDefaults
) => {
  const removedFlags = ['glm', 'kimi', 'together', 'glm-ocr', 'kimi-ocr', 'deepinfra-ocr', 'fal-image', 'fal-video']
    .filter(key => flags[key] !== undefined && flags[key] !== null)
  if (removedFlags.length > 0) {
    throw UsageError(`Provider selections ${removedFlags.join(', ')} are no longer supported. Remove them and select an active provider explicitly. AutoShow will not silently substitute a different model identity.`)
  }
  const mergedFlags = flags
  const readValidatedMany = <T extends string>(
    key: RepeatableModelFlag,
    validator: (value: string) => T
  ): T[] | undefined => {
    const values = expandAllShortcutModels(key, mergedFlags, rawModelOccurrences, allShortcutFlags)
    if (!values || values.length === 0) {
      return undefined
    }

    const normalized: T[] = []
    for (const value of values) {
      appendUnique(normalized, validateCliValue(validator, value))
    }
    return normalized.length > 0 ? normalized : undefined
  }

  return {
    whisperfileModels: readValidatedMany('whisperfile-stt', validateWhisperfileModel),
    deepinfraSttModels: readValidatedMany('deepinfra-stt', validateDeepinfraSttModel),
    grokSttModels: readValidatedMany('grok-stt', validateGrokSttModel),
    deepgramSttModels: readValidatedMany('deepgram-stt', validateDeepgramSttModel),
    sonioxSttModels: readValidatedMany('soniox-stt', validateSonioxSttModel),
    speechmaticsSttModels: readValidatedMany('speechmatics-stt', validateSpeechmaticsSttModel),
    mistralSttModels: readValidatedMany('mistral-stt', validateMistralSttModel),
    assemblyaiSttModels: readValidatedMany('assemblyai-stt', validateAssemblyaiSttModel),
    gladiaSttModels: readValidatedMany('gladia-stt', validateGladiaSttModel),
    scrapecreatorsSttModels: readValidatedMany('scrapecreators-stt', validateScrapeCreatorsSttModel),
    geminiSttModels: readValidatedMany('gemini-stt', validateGeminiSttModel),
    togetherSttModels: readValidatedMany('together-stt', validateTogetherSttModel),
    openaiSttModels: readValidatedMany('openai-stt', validateOpenAISttModel),
    cloudflareSttModels: readValidatedMany('cloudflare-stt', validateCloudflareSttModel),
    mistralOcrModels: readValidatedMany('mistral-ocr', validateMistralOcrModel),
    openaiOcrModels: readValidatedMany('openai-ocr', validateOpenAIOcrModel),
    grokOcrModels: readValidatedMany('grok-ocr', validateGrokOcrModel),
    anthropicOcrModels: readValidatedMany('anthropic-ocr', validateAnthropicOcrModel),
    geminiOcrModels: readValidatedMany('gemini-ocr', validateGeminiOcrModel),
    openaiModels: readValidatedMany('openai', validateOpenAIModel),
    geminiModels: readValidatedMany('gemini', validateGeminiModel),
    anthropicModels: readValidatedMany('anthropic', validateAnthropicModel),
    grokModels: readValidatedMany('grok', validateGrokModel),
    elevenlabsTtsModels: readValidatedMany('elevenlabs-tts', validateElevenlabsTtsModel),
    geminiTtsModels: readValidatedMany('gemini-tts', validateGeminiTtsModel),
    sonioxTtsModels: readValidatedMany('soniox-tts', validateSonioxTtsModel),
    grokTtsModels: readValidatedMany('grok-tts', validateGrokTtsModel),
    openaiTtsModels: readValidatedMany('openai-tts', validateOpenAITtsModel),
    inworldTtsModels: readValidatedMany('inworld-tts', validateInworldTtsModel),
    geminiImageModels: readValidatedMany('gemini-image', validateGeminiImageModel),
    openaiImageModels: readValidatedMany('openai-image', validateOpenAIImageModel),
    grokImageModels: readValidatedMany('grok-image', validateGrokImageModel),
    elevenlabsMusicModels: readValidatedMany('elevenlabs-music', validateElevenlabsMusicModel),
    minimaxMusicModels: readValidatedMany('minimax-music', validateMinimaxMusicModel),
    geminiMusicModels: readValidatedMany('gemini-music', validateGeminiMusicModel),
    geminiVideoModels: readValidatedMany('gemini-video', validateGeminiVideoModel),
    grokVideoModels: readValidatedMany('grok-video', validateGrokVideoModel)
  }
}
