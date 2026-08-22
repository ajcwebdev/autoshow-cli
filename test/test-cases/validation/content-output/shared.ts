import type { Step3Metadata } from '~/types'

export const buildStep3Metadata = (
  llm: { llmService: Step3Metadata['llmService'], llmModel: string, structuredPresetNames: string[] },
  overrides: Partial<Step3Metadata> = {}
): Step3Metadata => ({
  llmService: llm.llmService,
  llmModel: llm.llmModel,
  processingTime: 1,
  inputTokenCount: 1,
  outputTokenCount: 1,
  outputFileName: 'text.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: llm.structuredPresetNames,
  ...overrides
})
