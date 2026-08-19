import type { CompatStructuredResponse, LLMTarget, NormalizedReasoningEffort, ResolvedStructuredSchema, StructuredRequestOptions, StructuredValidationContext } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import { buildStructuredInstructionSuffix } from './schema-resolver'
import { parseAndValidateStructured } from './validator'
import { buildStructuredValidationFailureEnvelope } from './validation-failure'

const buildCompatPrompt = (prompt: string, schema: ResolvedStructuredSchema): string => {
  return [
    prompt,
    '',
    'Structured JSON requirements:',
    buildStructuredInstructionSuffix(schema.leafPromptNames),
    'JSON schema:',
    JSON.stringify(schema.jsonSchema, null, 2)
  ].join('\n')
}

export const runCompatFallback = async (
  target: LLMTarget,
  prompt: string,
  model: string,
  schema: ResolvedStructuredSchema,
  retryBudget: number,
  validationContext?: StructuredValidationContext,
  requestedReasoningEffort?: NormalizedReasoningEffort
): Promise<CompatStructuredResponse> => {
  const compatPrompt = buildCompatPrompt(prompt, schema)
  const requestOptions: StructuredRequestOptions = {
    schemaName: schema.schemaName,
    schema: schema.jsonSchema,
    strict: false,
    strategy: 'schema-guided',
    requestedReasoningEffort
  }

  const maxAttempts = retryBudget + 1
  let lastIssue = 'Unknown compat failure'
  let lastResponse: Awaited<ReturnType<LLMTarget['run']>> | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await target.run(compatPrompt, model, requestOptions)
    lastResponse = response
    const validated = parseAndValidateStructured(schema.schema, response.result, validationContext)

    if (validated.success) {
      return {
        parsedJson: validated.value,
        rawResponse: response.result,
        metadata: response.metadata
      }
    }

    lastIssue = validated.issue ?? 'Unknown compat validation failure'
    if (attempt < maxAttempts) {
      l.warn(`Structured compat retry ${attempt}/${maxAttempts - 1} for ${target.label}/${model}: ${lastIssue}`)
    }
  }

  if (!lastResponse) {
    throw InfraError(`Structured compat mode failed for ${target.label}/${model}: ${lastIssue}`, { stage: 'write:compat-fallback' })
  }

  l.warn(`Structured compat fallback for ${target.label}/${model}: ${lastIssue}`)
  return {
    parsedJson: buildStructuredValidationFailureEnvelope(lastResponse.result, lastIssue),
    rawResponse: lastResponse.result,
    metadata: lastResponse.metadata
  }
}
