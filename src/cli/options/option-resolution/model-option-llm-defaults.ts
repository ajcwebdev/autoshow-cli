import type { ResolvedLLMConfig, ResolvedLLMModelOptions } from '~/types'
import { selectCheapestDefaultLlmSelection } from '~/cli/commands/setup-and-utilities/models/cheapest-models'

export const buildLLMModelOptions = (config: ResolvedLLMConfig): ResolvedLLMModelOptions => ({
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

const first = (models: string[] | undefined): string | undefined => models?.[0]

export const resolveLLMDefaults = (opts: Partial<ResolvedLLMModelOptions>): ResolvedLLMConfig => {
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
    cerebrasModels?.length
  ].some((value) => typeof value === 'number' && value > 0)

  const cheapest = anySelected ? undefined : selectCheapestDefaultLlmSelection()
  const withDefault = <T extends string[]>(
    models: T | undefined,
    provider: NonNullable<typeof cheapest>['provider']
  ): T | undefined =>
    models
    ?? (cheapest?.provider === provider ? [cheapest.model] as T : undefined)

  const resolvedOpenai = withDefault(openaiModels, 'openai')
  const resolvedGroq = withDefault(groqModels, 'groq')
  const resolvedGemini = withDefault(geminiModels, 'gemini')
  const resolvedAnthropic = withDefault(anthropicModels, 'anthropic')
  const resolvedMinimax = withDefault(minimaxModels, 'minimax')
  const resolvedGrok = withDefault(grokModels, 'grok')
  const resolvedGlm = withDefault(glmModels, 'glm')
  const resolvedKimi = withDefault(kimiModels, 'kimi')
  const resolvedTogether = withDefault(togetherModels, 'together')
  const resolvedCerebras = withDefault(cerebrasModels, 'cerebras')

  return {
    openaiModels: resolvedOpenai,
    openaiModel: first(resolvedOpenai),
    groqModels: resolvedGroq,
    groqModel: first(resolvedGroq),
    geminiModels: resolvedGemini,
    geminiModel: first(resolvedGemini),
    anthropicModels: resolvedAnthropic,
    anthropicModel: first(resolvedAnthropic),
    minimaxModels: resolvedMinimax,
    minimaxModel: first(resolvedMinimax),
    grokModels: resolvedGrok,
    grokModel: first(resolvedGrok),
    glmModels: resolvedGlm,
    glmModel: first(resolvedGlm),
    kimiModels: resolvedKimi,
    kimiModel: first(resolvedKimi),
    togetherModels: resolvedTogether,
    togetherModel: first(resolvedTogether),
    cerebrasModels: resolvedCerebras,
    cerebrasModel: first(resolvedCerebras),
    llmService: resolvedOpenai?.length ? 'openai'
      : resolvedGroq?.length ? 'groq'
        : resolvedGemini?.length ? 'gemini'
          : resolvedAnthropic?.length ? 'anthropic'
            : resolvedMinimax?.length ? 'minimax'
              : resolvedGrok?.length ? 'grok'
                : resolvedGlm?.length ? 'glm'
                  : resolvedKimi?.length ? 'kimi'
                    : resolvedTogether?.length ? 'together'
                      : resolvedCerebras?.length ? 'cerebras'
                        : cheapest?.provider,
    llmModel: first(resolvedOpenai)
      ?? first(resolvedGroq)
      ?? first(resolvedGemini)
      ?? first(resolvedAnthropic)
      ?? first(resolvedMinimax)
      ?? first(resolvedGrok)
      ?? first(resolvedGlm)
      ?? first(resolvedKimi)
      ?? first(resolvedTogether)
      ?? first(resolvedCerebras)
      ?? cheapest?.model
      ?? '',
  }
}
