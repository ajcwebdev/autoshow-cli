export type ResolvedLLMModelOptions = {
  llamaModels: string[] | undefined
  llamaModel: string | undefined
  llamafileModels: string[] | undefined
  llamafileModel: string | undefined
  openaiModels: string[] | undefined
  openaiModel: string | undefined
  groqModels: string[] | undefined
  groqModel: string | undefined
  geminiModels: string[] | undefined
  geminiModel: string | undefined
  anthropicModels: string[] | undefined
  anthropicModel: string | undefined
  minimaxModels: string[] | undefined
  minimaxModel: string | undefined
  grokModels: string[] | undefined
  grokModel: string | undefined
  glmModels: string[] | undefined
  glmModel: string | undefined
  kimiModels: string[] | undefined
  kimiModel: string | undefined
  togetherModels: string[] | undefined
  togetherModel: string | undefined
  cerebrasModels: string[] | undefined
  cerebrasModel: string | undefined
}

export type LLMModelOptionKey = keyof ResolvedLLMModelOptions
