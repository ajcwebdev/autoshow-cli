import { runTts } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runImageGen } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import { runVideoGen } from '~/cli/commands/process-steps/step-6-video/run-video-gen'
import { collectVideoTargets } from '~/cli/commands/process-steps/step-6-video/video-targets'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runMusicGen } from '~/cli/commands/process-steps/step-7-music/run-music-gen'
import type { GenerationStageOptions, GenerationStageRunResult, Step3Metadata, StructuredRunResult } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import { createGenerationResourceGate, resolveGenerationResourceCapacity } from './generation-resource-gate'

export const runGenerationStagesForSingleWrite = async (options: {
  step3Results: Step3Metadata[]
  step3RunResults: Pick<StructuredRunResult, 'renderedText'>[]
  outputDir: string
  generationOptions: GenerationStageOptions
}): Promise<GenerationStageRunResult> => {
  const ttsTargets = collectTtsTargets(options.generationOptions)
  const imageTargets = collectImageTargets(options.generationOptions)
  const videoTargets = collectVideoTargets(options.generationOptions)
  const musicTargets = collectMusicTargets(options.generationOptions)
  const ttsRequested = ttsTargets.length > 0
  const imageRequested = imageTargets.length > 0
  const videoRequested = videoTargets.length > 0
  const musicRequested = musicTargets.length > 0

  const result: GenerationStageRunResult = {
    step4Metadata: null,
    step5Metadata: null,
    step6Metadata: null,
    step7Metadata: null,
    ttsTargets,
    imageTargets,
    videoTargets,
    musicTargets,
    attemptedTtsTargets: [],
    attemptedImageTargets: [],
    attemptedVideoTargets: [],
    attemptedMusicTargets: []
  }

  if (!ttsRequested && !imageRequested && !musicRequested && !videoRequested) {
    return result
  }

  if (options.step3Results.length === 0) {
    return result
  }

  if (options.step3Results.length > 1) {
    if (ttsRequested) l.warn(`TTS skipped: step 4 only runs when write produces exactly one summary, but ${options.step3Results.length} LLM outputs were generated`)
    if (imageRequested) l.warn(`Image gen skipped: cannot determine which of ${options.step3Results.length} LLM outputs to use`)
    if (musicRequested) l.warn(`Music gen skipped: cannot determine which of ${options.step3Results.length} LLM outputs to use`)
    if (videoRequested) l.warn(`Video gen skipped: cannot determine which of ${options.step3Results.length} LLM outputs to use`)
    return result
  }

  if (options.step3Results[0]?.validationFailed === true) {
    if (ttsRequested) l.warn('TTS skipped: the LLM output failed structured validation')
    if (imageRequested) l.warn('Image gen skipped: the LLM output failed structured validation')
    if (musicRequested) l.warn('Music gen skipped: the LLM output failed structured validation')
    if (videoRequested) l.warn('Video gen skipped: the LLM output failed structured validation')
    return result
  }

  const renderedText = options.step3RunResults[0]?.renderedText ?? ''
  const generationResourceGate = createGenerationResourceGate({
    capacity: resolveGenerationResourceCapacity(options.generationOptions)
  })
  const gatedOptions = {
    ...options.generationOptions,
    generationResourceGate
  }

  const [ttsResult, imageResult, musicResult, videoResult] = await Promise.all([
    ttsRequested
      ? runWithLogContext({ step: 'step-4-tts' }, async () => await runTts(renderedText, options.outputDir, gatedOptions))
      : null,
    imageRequested
      ? runWithLogContext({ step: 'step-5-image' }, async () => await runImageGen(renderedText, options.outputDir, gatedOptions))
      : null,
    musicRequested
      ? runWithLogContext({ step: 'step-7-music' }, async () => await runMusicGen(renderedText, options.outputDir, gatedOptions))
      : null,
    videoRequested
      ? runWithLogContext({ step: 'step-6-video' }, async () => await runVideoGen(renderedText, options.outputDir, gatedOptions))
      : null
  ])

  return {
    ...result,
    step4Metadata: ttsResult?.metadata ?? null,
    step5Metadata: imageResult?.metadata ?? null,
    step7Metadata: musicResult?.metadata ?? null,
    step6Metadata: videoResult?.metadata ?? null,
    ttsCharacterCount: renderedText.length,
    ttsInputText: renderedText,
    attemptedTtsTargets: ttsTargets,
    attemptedImageTargets: imageTargets,
    attemptedVideoTargets: videoTargets,
    attemptedMusicTargets: musicTargets
  }
}
