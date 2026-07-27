import type { ResolvedLLMConfig, ResolvedLLMModelOptions, RuntimeOptions } from '~/types'

const DEFAULT_LLAMA_MODEL = 'ggml-org/gemma-3-270m-it-GGUF'

export const buildLLMModelOptions = (config: ResolvedLLMConfig): ResolvedLLMModelOptions => ({
  llamaModels: config.llamaModels,
  llamaModel: config.llamaModel,
  llamafileModels: config.llamafileModels,
  llamafileModel: config.llamafileModel,
  openaiModels: config.openaiModels,
  openaiModel: config.openaiModel,
  groqModels: config.groqModels,
  groqModel: config.groqModel,
  geminiModels: config.geminiModels,
  geminiModel: config.geminiModel,
  anthropicModels: config.anthropicModels,
  anthropicModel: config.anthropicModel,
  minimaxModels: config.minimaxModels,
  minimaxModel: config.minimaxModel,
  grokModels: config.grokModels,
  grokModel: config.grokModel,
  glmModels: config.glmModels,
  glmModel: config.glmModel,
  kimiModels: config.kimiModels,
  kimiModel: config.kimiModel,
  togetherModels: config.togetherModels,
  togetherModel: config.togetherModel,
  cerebrasModels: config.cerebrasModels,
  cerebrasModel: config.cerebrasModel,
})

export const resolveLLMDefaults = (opts: RuntimeOptions): ResolvedLLMConfig => {
  const llamaModels = opts.llamaModels
  const llamafileModels = opts.llamafileModels
  const openaiModels = opts.openaiModels
  const groqModels = opts.groqModels
  const geminiModels = opts.geminiModels
  const anthropicModels = opts.anthropicModels
  const minimaxModels = opts.minimaxModels
  const grokModels = opts.grokModels
  const glmModels = opts.glmModels
  const kimiModels = opts.kimiModels
  const togetherModels = opts.togetherModels
  const cerebrasModels = opts.cerebrasModels
  const anySelected = [
    openaiModels?.length,
    groqModels?.length,
    geminiModels?.length,
    anthropicModels?.length,
    minimaxModels?.length,
    grokModels?.length,
    glmModels?.length,
    kimiModels?.length,
    togetherModels?.length,
    cerebrasModels?.length,
    llamaModels?.length,
    llamafileModels?.length
  ].some((value) => typeof value === 'number' && value > 0)

  const resolvedLlamaModels = llamaModels
    ? llamaModels
    : anySelected
      ? undefined
      : [DEFAULT_LLAMA_MODEL]

  const first = (models: string[] | undefined): string | undefined => models?.[0]

  return {
    llamaModels: resolvedLlamaModels,
    llamaModel: first(resolvedLlamaModels),
    openaiModels,
    openaiModel: first(openaiModels),
    groqModels,
    groqModel: first(groqModels),
    geminiModels,
    geminiModel: first(geminiModels),
    anthropicModels,
    anthropicModel: first(anthropicModels),
    minimaxModels,
    minimaxModel: first(minimaxModels),
    grokModels,
    grokModel: first(grokModels),
    glmModels,
    glmModel: first(glmModels),
    kimiModels,
    kimiModel: first(kimiModels),
    togetherModels,
    togetherModel: first(togetherModels),
    cerebrasModels,
    cerebrasModel: first(cerebrasModels),
    llamafileModels,
    llamafileModel: first(llamafileModels),
    llmService: openaiModels?.length ? 'openai'
      : groqModels?.length ? 'groq'
        : geminiModels?.length ? 'gemini'
          : anthropicModels?.length ? 'anthropic'
            : minimaxModels?.length ? 'minimax'
              : grokModels?.length ? 'grok'
                : glmModels?.length ? 'glm'
                  : kimiModels?.length ? 'kimi'
                    : togetherModels?.length ? 'together'
                      : cerebrasModels?.length ? 'cerebras'
                        : llamafileModels?.length ? 'llamafile'
                          : resolvedLlamaModels?.length ? 'llama.cpp'
                            : undefined,
    llmModel: first(openaiModels)
      ?? first(groqModels)
      ?? first(geminiModels)
      ?? first(anthropicModels)
      ?? first(minimaxModels)
      ?? first(grokModels)
      ?? first(glmModels)
      ?? first(kimiModels)
      ?? first(togetherModels)
      ?? first(cerebrasModels)
      ?? first(llamafileModels)
      ?? first(resolvedLlamaModels)
      ?? DEFAULT_LLAMA_MODEL,
  }
}
