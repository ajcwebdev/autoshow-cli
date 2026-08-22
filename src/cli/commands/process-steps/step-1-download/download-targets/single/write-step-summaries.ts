import { buildProviderStepSummaries } from '~/cli/commands/process-steps/generation-command-utils'
import type { BuildWriteStepSummariesContext, StepTimingCost } from '~/types'

export const buildWriteStepSummaries = (ctx: BuildWriteStepSummariesContext): StepTimingCost[] => {
  const { processingOptions, step1Time, step2Entries, step3Results, actualSteps } = ctx

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
      const displayService = entry.transcriptionService === 'whisper' ? 'whisper.cpp' : entry.transcriptionService
      const displayModel = entry.transcriptionService === 'whisper'
        ? (processingOptions.whisperModels?.[0] ?? entry.transcriptionModel)
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

  return stepSummaries
}
