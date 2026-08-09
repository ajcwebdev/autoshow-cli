import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { CEREBRAS_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { CLIUsageError } from '~/utils/error-handler'
import { requireApiKey } from '~/utils/validate/env-utils'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

export const CEREBRAS_MODEL_BY_SELECTOR = {
  'gpt-oss-120b': 'gpt-oss-120b',
  'zai-glm-4.7': 'zai-glm-4.7'
} as const

const CEREBRAS_UNSUPPORTED_SCHEMA_KEYS = new Set([
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minItems',
  'maxItems'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const sanitizeCerebrasStructuredSchema = (schema: Record<string, unknown>): Record<string, unknown> => {
  const sanitize = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map((entry) => sanitize(entry))
    }

    if (!isRecord(node)) {
      return node
    }

    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node)) {
      if (CEREBRAS_UNSUPPORTED_SCHEMA_KEYS.has(key)) {
        continue
      }
      sanitized[key] = sanitize(value)
    }
    return sanitized
  }

  return sanitize(schema) as Record<string, unknown>
}

const ensureCerebrasApiKey = (): string => {
  const apiKey = requireApiKey('CEREBRAS_API_KEY', 'write:cerebras', '--cerebras models')
  return apiKey
}

export const resolveCerebrasApiModel = (model: string): string => {
  if (!(model in CEREBRAS_MODEL_BY_SELECTOR)) {
    throw CLIUsageError(
      `Unsupported Cerebras model selector "${model}". Allowed values: ${Object.keys(CEREBRAS_MODEL_BY_SELECTOR).join(', ')}`
    )
  }

  const selector = model as keyof typeof CEREBRAS_MODEL_BY_SELECTOR
  return CEREBRAS_MODEL_BY_SELECTOR[selector]
}

export const runCerebrasModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const config = {
    apiKey: ensureCerebrasApiKey(),
    baseURL: CEREBRAS_DEFAULT_BASE_URL,
    provider: 'cerebras'
  }

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'cerebras',
    providerLabel: 'Cerebras',
    operationName: 'cerebras-llm',
    customizeRequestBody: (requestBody, currentModel) => {
      requestBody['model'] = resolveCerebrasApiModel(currentModel)
      requestBody['stream'] = false
      requestBody['max_completion_tokens'] = 40960
    },
    buildStructuredResponseFormat: (currentStructuredOpts) => ({
      type: 'json_schema',
      json_schema: {
        name: currentStructuredOpts.schemaName,
        schema: sanitizeCerebrasStructuredSchema(currentStructuredOpts.schema),
        strict: currentStructuredOpts.strict
      }
    })
  })
}
