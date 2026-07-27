import { buildProviderStepSummaries } from '~/cli/commands/process-steps/generation-command-utils'
import { buildTimingProviderModelLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-prompt'
import type { BuildWriteStepSummariesContext, StepTimingCost } from '~/types'

export const buildWriteStepSummaries = (ctx: BuildWriteStepSummariesContext): StepTimingCost[] => {
  const { processingOptions, step1Time, step2Entries, step3Results, step4Metadata, step5Metadata, step6Metadata, step7Metadata, actualSteps } = ctx

  const stepSummaries: StepTimingCost[] = [
    {
      label: 'Download',
      processingTime: step1Time,
      cost: 0
    }
  ]

  stepSummaries.push(...buildProviderStepSummaries(
    'Transcribe',
    'stt',
    step2Entries,
    actualSteps,
    (entry) => {
      if (entry.transcriptionService === 'reverb') {
        return buildTimingProviderModelLabel(entry)
      }
      const displayService = entry.transcriptionService === 'whisper' ? 'whisper.cpp' : entry.transcriptionService
      const displayModel = entry.transcriptionService === 'whisper'
        ? (processingOptions.whisperModel ?? entry.transcriptionModel)
        : entry.transcriptionModel
      return `${displayService}/${displayModel}`
    },
    (entry) => entry.processingTime
  ))

  if (step3Results.length > 0) {
    stepSummaries.push(...buildProviderStepSummaries(
      'LLM',
      'llm',
      step3Results,
      actualSteps,
      (entry) => `${entry.llmService}/${entry.llmModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step4Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'TTS',
      'tts',
      step4Metadata,
      actualSteps,
      (entry) => `${entry.ttsService}/${entry.ttsModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step5Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Image',
      'image',
      step5Metadata,
      actualSteps,
      (entry) => `${entry.imageService}/${entry.imageModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step6Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Video',
      'video',
      step6Metadata,
      actualSteps,
      (entry) => `${entry.videoGenService}/${entry.videoGenModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step7Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Music',
      'music',
      step7Metadata,
      actualSteps,
      (entry) => `${entry.musicService}/${entry.musicModel}`,
      (entry) => entry.processingTime
    ))
  }

  return stepSummaries
}
