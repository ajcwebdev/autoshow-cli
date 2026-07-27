import type { ResolvedLLMConfig } from '~/types'

export type LLMModelOptionKey = Exclude<keyof ResolvedLLMConfig, 'llmService' | 'llmModel'>

export type ResolvedLLMModelOptions = Pick<ResolvedLLMConfig, LLMModelOptionKey>
