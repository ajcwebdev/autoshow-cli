import type { RuntimeModelOptions, TargetCounts } from '~/types'
import { IMAGE_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { VIDEO_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { MUSIC_PRICING_PROVIDERS } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { collectSelections } from '~/utils/pricing/model-selection'

const countSelectedTargets = (
  models: string[] | undefined,
  model: string | undefined
): number => models?.length ?? (model ? 1 : 0)

export const resolveTargetCounts = (modelOptions: RuntimeModelOptions): TargetCounts => {
  const hostedOcrTargetCount =
    countSelectedTargets(modelOptions.mistralOcrModels, modelOptions.mistralOcrModel)
    + countSelectedTargets(modelOptions.glmOcrModels, modelOptions.glmOcrModel)
    + countSelectedTargets(modelOptions.kimiOcrModels, modelOptions.kimiOcrModel)
    + countSelectedTargets(modelOptions.openaiOcrModels, modelOptions.openaiOcrModel)
    + countSelectedTargets(modelOptions.grokOcrModels, modelOptions.grokOcrModel)
    + countSelectedTargets(modelOptions.anthropicOcrModels, modelOptions.anthropicOcrModel)
    + countSelectedTargets(modelOptions.geminiOcrModels, modelOptions.geminiOcrModel)
    + countSelectedTargets(modelOptions.deepinfraOcrModels, modelOptions.deepinfraOcrModel)
  const hostedLlmTargetCount =
    countSelectedTargets(modelOptions.openaiModels, modelOptions.openaiModel)
    + countSelectedTargets(modelOptions.groqModels, modelOptions.groqModel)
    + countSelectedTargets(modelOptions.geminiModels, modelOptions.geminiModel)
    + countSelectedTargets(modelOptions.anthropicModels, modelOptions.anthropicModel)
    + countSelectedTargets(modelOptions.minimaxModels, modelOptions.minimaxModel)
    + countSelectedTargets(modelOptions.grokModels, modelOptions.grokModel)
    + countSelectedTargets(modelOptions.glmModels, modelOptions.glmModel)
    + countSelectedTargets(modelOptions.kimiModels, modelOptions.kimiModel)
    + countSelectedTargets(modelOptions.togetherModels, modelOptions.togetherModel)
    + countSelectedTargets(modelOptions.cerebrasModels, modelOptions.cerebrasModel)
  const hostedTtsTargetCount =
    countSelectedTargets(modelOptions.elevenlabsTtsModels, modelOptions.elevenlabsTtsModel)
    + countSelectedTargets(modelOptions.minimaxTtsModels, modelOptions.minimaxTtsModel)
    + countSelectedTargets(modelOptions.groqTtsModels, modelOptions.groqTtsModel)
    + countSelectedTargets(modelOptions.grokTtsModels, modelOptions.grokTtsModel)
    + countSelectedTargets(modelOptions.mistralTtsModels, modelOptions.mistralTtsModel)
    + countSelectedTargets(modelOptions.openaiTtsModels, modelOptions.openaiTtsModel)
    + countSelectedTargets(modelOptions.geminiTtsModels, modelOptions.geminiTtsModel)
    + countSelectedTargets(modelOptions.deepgramTtsModels, modelOptions.deepgramTtsModel)
    + countSelectedTargets(modelOptions.speechifyTtsModels, modelOptions.speechifyTtsModel)
    + countSelectedTargets(modelOptions.humeTtsModels, modelOptions.humeTtsModel)
    + countSelectedTargets(modelOptions.cartesiaTtsModels, modelOptions.cartesiaTtsModel)
  const hostedImageTargetCount = collectSelections(modelOptions, IMAGE_PRICING_PROVIDERS).length
  const hostedVideoTargetCount = collectSelections(modelOptions, VIDEO_PRICING_PROVIDERS).length
  const hostedMusicTargetCount = collectSelections(modelOptions, MUSIC_PRICING_PROVIDERS).length

  return {
    hostedOcrTargetCount,
    hostedLlmTargetCount,
    hostedTtsTargetCount,
    hostedImageTargetCount,
    hostedVideoTargetCount,
    hostedMusicTargetCount,
  }
}
