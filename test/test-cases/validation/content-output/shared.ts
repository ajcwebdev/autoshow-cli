import type { Step3Metadata } from '~/types'

/**
 * The content-output suites all render from the same one-token structured run and
 * differ only in which LLM produced it and which preset shaped it, so those two are
 * required and everything else the renderers read has a fixture default.
 */
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
