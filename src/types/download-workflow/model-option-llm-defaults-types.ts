export type ResolvedLLMModelOptions = {
  openaiModels: string[] | undefined
  geminiModels: string[] | undefined
  anthropicModels: string[] | undefined
  grokModels: string[] | undefined
}

export type LLMModelOptionKey = keyof ResolvedLLMModelOptions
