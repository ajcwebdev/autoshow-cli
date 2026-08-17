import { collectLlmTargets } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { resolveStructuredStrategy, resolveValidationRetryBudget, shouldApplyStrictMode } from '~/cli/commands/process-steps/step-3-write/structured-output/capabilities'
import { runCompatFallback } from '~/cli/commands/process-steps/step-3-write/structured-output/compat-fallback'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { CLIUsageError, InternalError } from '~/utils/error-handler'
import type { ComicStructuredLlmResult, ComicStructuredSchema, HostedConcurrencyCoordinator, LLMOptions, LLMTarget, ResolvedStructuredSchema, StructuredRequestOptions, StructuredValidationContext } from '~/types'
import { runComicHostedRequest } from '../hosted-concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'

// Maps a central registry LLM service name onto the matching LLMOptions model field
// that collectLlmTargets reads.
const SERVICE_TO_LLM_OPTION_FIELD: Record<string, keyof LLMOptions> = {
  openai: 'openaiModels',
  groq: 'groqModels',
  gemini: 'geminiModels',
  anthropic: 'anthropicModels',
  minimax: 'minimaxModels',
  grok: 'grokModels',
  glm: 'glmModels',
  kimi: 'kimiModels',
  together: 'togetherModels',
  cerebras: 'cerebrasModels',
}

// Resolves a single central LLM model id to one shared dispatch target. Validation
// against the central registry replaces comic's removed per-provider type guards.
export const resolveComicLlmTarget = (modelId: string): LLMTarget => {
  const service = findRegistryServiceForModel('llm', modelId)
  if (!service) {
    throw CLIUsageError(`Unknown LLM model "${modelId}". It is not present in the central LLM registry.`)
  }

  const field = SERVICE_TO_LLM_OPTION_FIELD[service]
  if (!field) {
    throw CLIUsageError(`LLM provider "${service}" for model "${modelId}" is not supported by comic.`)
  }

  const targets = collectLlmTargets({ [field]: [modelId] } as Partial<LLMOptions> as LLMOptions)
  const target = targets[0]
  if (!target) {
    throw InternalError(`Failed to build an LLM target for "${modelId}"`, { stage: 'comic:llm' })
  }

  return target
}

// Runs a structured-JSON prompt through the shared LLM dispatch, returning the raw
// model text plus token metadata. Callers keep their own JSON normalization and
// schema validation. Native-structured providers send the JSON schema server-side;
// schema-guided providers embed it via runCompatFallback.
export const runComicStructuredLlm = async (
  prompt: string,
  schema: ComicStructuredSchema,
  modelId: string,
  scheduling: {
    hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
    concurrency?: number | undefined
    workId?: string | undefined
    unitIndex?: number | undefined
  } = {}
): Promise<ComicStructuredLlmResult> => {
  const target = resolveComicLlmTarget(modelId)
  const validationContext: StructuredValidationContext = { leafPromptNames: [], presetNames: [] }

  return await runComicHostedRequest({
    concurrency: scheduling.concurrency ?? DEFAULT_CLI_CONCURRENCY,
    hostedConcurrencyCoordinator: scheduling.hostedConcurrencyCoordinator
  }, target.service, 'comic-llm', scheduling.workId ?? schema.schemaName, scheduling.unitIndex ?? 0, async () => {
    if (resolveStructuredStrategy(target.service) === 'schema-guided') {
      const resolvedSchema: ResolvedStructuredSchema = {
        schemaName: schema.schemaName,
        leafPromptNames: [],
        presetNames: [],
        schema: schema.valibotSchema,
        jsonSchema: schema.jsonSchema,
      }
      const compat = await runCompatFallback(target, prompt, target.model, resolvedSchema, resolveValidationRetryBudget(target.service), validationContext)
      return { text: compat.rawResponse, metadata: compat.metadata }
    }

    const structuredOpts: StructuredRequestOptions = {
      schemaName: schema.schemaName,
      schema: schema.jsonSchema,
      strict: shouldApplyStrictMode(target.service, true),
      strategy: 'native',
    }
    const response = await target.run(prompt, target.model, structuredOpts)
    return { text: response.result, metadata: response.metadata }
  })
}
