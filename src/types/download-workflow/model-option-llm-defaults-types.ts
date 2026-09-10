export type ResolvedLLMModelOptions = {
  openaiModels: string[] | undefined
  geminiModels: string[] | undefined
  anthropicModels: string[] | undefined
  minimaxModels: string[] | undefined
  grokModels: string[] | undefined
  glmModels: string[] | undefined
  kimiModels: string[] | undefined
  togetherModels: string[] | undefined
}

export type LLMModelOptionKey = keyof ResolvedLLMModelOptions
