import { rethrowAsUsage } from '~/utils/error-handler'
import {
  validateOpenAIModel,
  validateGroqModel,
  validateGeminiModel,
  validateAnthropicModel,
  validateMinimaxModel,
  validateGrokModel,
  validateGlmModel,
  validateKimiModel,
  validateTogetherModel,
  validateCerebrasModel,
  validateWhisperModel,
  validateWhisperfileModel,
  validateDeepinfraSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateGroqSttModel,
  validateGrokSttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
  validateGladiaSttModel,
  validateHappyscribeSttModel,
  validateSupadataSttModel,
  validateScrapeCreatorsSttModel,
  validateGeminiSttModel,
  validateTogetherSttModel,
  validateGlmOcrModel,
  validateKimiOcrModel,
  validateAnthropicOcrModel,
  validateGeminiOcrModel,
  validateDeepinfraOcrModel,
  validateMistralOcrModel,
  validateOpenAIOcrModel,
  validateGrokOcrModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGrokTtsModel,
  validateMistralTtsModel,
  validateOpenAITtsModel,
  validateSpeechifyTtsModel,
  validateHumeTtsModel,
  validateCartesiaTtsModel,
  validateFishTtsModel,
  validateInworldTtsModel,
  validateDeepinfraTtsModel,
  validateElevenlabsMusicModel,
  validateMinimaxMusicModel,
  validateGeminiMusicModel,
  validateGeminiImageModel,
  validateGrokImageModel,
  validateOpenAIImageModel,
  validateBflImageModel,
  validateReplicateImageModel,
  validateLumalabsImageModel,
  validateFalImageModel,
  validateGeminiVideoModel,
  validateGrokVideoModel,
  validateLtxVideoModel,
  validateReplicateVideoModel,
  validateLumalabsVideoModel,
  validateFalVideoModel
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

  const selectedWhisperModels = readValidatedMany('whisper-stt', validateWhisperModel)
  const whisperPathActive = selectedWhisperModels !== undefined
    || mergedFlags['whisper-stt'] !== undefined
    || allShortcutFlags['all-local-stt']
  const whisperModels = selectedWhisperModels
    ?? (whisperPathActive ? [validateCliValue(validateWhisperModel, 'tiny')] : undefined)

  return {
    whisperModels,
    whisperfileModels: readValidatedMany('whisperfile-stt', validateWhisperfileModel),
    deepinfraSttModels: readValidatedMany('deepinfra-stt', validateDeepinfraSttModel),
    groqSttModels: readValidatedMany('groq-stt', validateGroqSttModel),
    grokSttModels: readValidatedMany('grok-stt', validateGrokSttModel),
    deepgramSttModels: readValidatedMany('deepgram-stt', validateDeepgramSttModel),
    sonioxSttModels: readValidatedMany('soniox-stt', validateSonioxSttModel),
    speechmaticsSttModels: readValidatedMany('speechmatics-stt', validateSpeechmaticsSttModel),
    mistralSttModels: readValidatedMany('mistral-stt', validateMistralSttModel),
    assemblyaiSttModels: readValidatedMany('assemblyai-stt', validateAssemblyaiSttModel),
    gladiaSttModels: readValidatedMany('gladia-stt', validateGladiaSttModel),
    happyscribeSttModels: readValidatedMany('happyscribe-stt', validateHappyscribeSttModel),
    supadataSttModels: readValidatedMany('supadata-stt', validateSupadataSttModel),
    scrapecreatorsSttModels: readValidatedMany('scrapecreators-stt', validateScrapeCreatorsSttModel),
    geminiSttModels: readValidatedMany('gemini-stt', validateGeminiSttModel),
    togetherSttModels: readValidatedMany('together-stt', validateTogetherSttModel),
    mistralOcrModels: readValidatedMany('mistral-ocr', validateMistralOcrModel),
    glmOcrModels: readValidatedMany('glm-ocr', validateGlmOcrModel),
    kimiOcrModels: readValidatedMany('kimi-ocr', validateKimiOcrModel),
    openaiOcrModels: readValidatedMany('openai-ocr', validateOpenAIOcrModel),
    grokOcrModels: readValidatedMany('grok-ocr', validateGrokOcrModel),
    anthropicOcrModels: readValidatedMany('anthropic-ocr', validateAnthropicOcrModel),
    geminiOcrModels: readValidatedMany('gemini-ocr', validateGeminiOcrModel),
    deepinfraOcrModels: readValidatedMany('deepinfra-ocr', validateDeepinfraOcrModel),
    openaiModels: readValidatedMany('openai', validateOpenAIModel),
    groqModels: readValidatedMany('groq', validateGroqModel),
    geminiModels: readValidatedMany('gemini', validateGeminiModel),
    anthropicModels: readValidatedMany('anthropic', validateAnthropicModel),
    minimaxModels: readValidatedMany('minimax', validateMinimaxModel),
    grokModels: readValidatedMany('grok', validateGrokModel),
    glmModels: readValidatedMany('glm', validateGlmModel),
    kimiModels: readValidatedMany('kimi', validateKimiModel),
    togetherModels: readValidatedMany('together', validateTogetherModel),
    cerebrasModels: readValidatedMany('cerebras', validateCerebrasModel),
    elevenlabsTtsModels: readValidatedMany('elevenlabs-tts', validateElevenlabsTtsModel),
    minimaxTtsModels: readValidatedMany('minimax-tts', validateMinimaxTtsModel),
    grokTtsModels: readValidatedMany('grok-tts', validateGrokTtsModel),
    mistralTtsModels: readValidatedMany('mistral-tts', validateMistralTtsModel),
    openaiTtsModels: readValidatedMany('openai-tts', validateOpenAITtsModel),
    speechifyTtsModels: readValidatedMany('speechify-tts', validateSpeechifyTtsModel),
    humeTtsModels: readValidatedMany('hume-tts', validateHumeTtsModel),
    cartesiaTtsModels: readValidatedMany('cartesia-tts', validateCartesiaTtsModel),
    fishTtsModels: readValidatedMany('fish-tts', validateFishTtsModel),
    inworldTtsModels: readValidatedMany('inworld-tts', validateInworldTtsModel),
    deepinfraTtsModels: readValidatedMany('deepinfra-tts', validateDeepinfraTtsModel),
    geminiImageModels: readValidatedMany('gemini-image', validateGeminiImageModel),
    openaiImageModels: readValidatedMany('openai-image', validateOpenAIImageModel),
    grokImageModels: readValidatedMany('grok-image', validateGrokImageModel),
    bflImageModels: readValidatedMany('bfl-image', validateBflImageModel),
    replicateImageModels: readValidatedMany('replicate-image', validateReplicateImageModel),
    lumalabsImageModels: readValidatedMany('lumalabs-image', validateLumalabsImageModel),
    falImageModels: readValidatedMany('fal-image', validateFalImageModel),
    elevenlabsMusicModels: readValidatedMany('elevenlabs-music', validateElevenlabsMusicModel),
    minimaxMusicModels: readValidatedMany('minimax-music', validateMinimaxMusicModel),
    geminiMusicModels: readValidatedMany('gemini-music', validateGeminiMusicModel),
    geminiVideoModels: readValidatedMany('gemini-video', validateGeminiVideoModel),
    grokVideoModels: readValidatedMany('grok-video', validateGrokVideoModel),
    ltxVideoModels: readValidatedMany('ltx-video', validateLtxVideoModel),
    replicateVideoModels: readValidatedMany('replicate-video', validateReplicateVideoModel),
    lumalabsVideoModels: readValidatedMany('lumalabs-video', validateLumalabsVideoModel),
    falVideoModels: readValidatedMany('fal-video', validateFalVideoModel)
  }
}
