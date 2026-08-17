import type { ResolvedLLMModelOptions } from '../download-workflow/model-option-llm-defaults-types'
import type { SttRuntimeOptions } from '../download-workflow/stt-options-types'
import type { Step2SelectionOriginOptions } from './step-2-shared-types'

export type ProcessingSource =
  | { url: string, filePath?: never }
  | { filePath: string, url?: never }

type ProcessingSttOptions = Partial<Omit<
  SttRuntimeOptions,
  | 'sttProviderConcurrency'
  | 'sttLocalConcurrency'
  | 'sttSegmentConcurrency'
  | 'sttPreflightConcurrency'
>> & Pick<SttRuntimeOptions, 'whisperModel'>

type ProcessingLlmOptions = Partial<ResolvedLLMModelOptions & {
  llmProviderConcurrency: number
  llmLocalConcurrency: number
}>

type ProcessingWriteOptions = {
  concurrencyMode: import('~/types').HostedConcurrencyMode
  hostedConcurrencyCoordinator?: import('~/types').HostedConcurrencyCoordinator | undefined
  configPath: string | undefined
  youtubeCaptions: boolean
  skipLLM: boolean
  prompts: string[]
  promptFile: string | undefined
  renderedText: boolean
  renderedOutDir: string | undefined
  trackList: string | undefined
  promptMd: boolean
  reasoningEffort: import('~/cli/commands/setup-and-utilities/models/reasoning-resolver').NormalizedReasoningEffort | undefined
}

export type ProcessingOptions = ProcessingSource
  & Step2SelectionOriginOptions
  & ProcessingSttOptions
  & ProcessingLlmOptions
  & Partial<ProcessingWriteOptions>
  & { outputDir: string }
