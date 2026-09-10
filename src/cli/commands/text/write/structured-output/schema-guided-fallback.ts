import type { LLMTarget, NormalizedReasoningEffort, ResolvedStructuredSchema, SchemaGuidedStructuredResponse, StructuredRequestOptions, StructuredValidationContext } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { AppError } from '~/utils/error-handler'
import { formatRetryExhaustedMessage, logRetryAttempt } from '~/utils/retries'
import { buildStructuredInstructionSuffix } from './schema-resolver'
import { parseAndValidateStructured } from './validator'
import { buildStructuredValidationFailureEnvelope } from './validation-failure'

const buildSchemaGuidedPrompt = (prompt: string, schema: ResolvedStructuredSchema): string => {
  return [
    prompt,
    '',
    'Structured JSON requirements:',
    buildStructuredInstructionSuffix(schema.leafPromptNames),
    'JSON schema:',
    JSON.stringify(schema.jsonSchema, null, 2)
  ].join('\n')
}

export const runSchemaGuidedFallback = async (
  target: LLMTarget,
  prompt: string,
  model: string,
  schema: ResolvedStructuredSchema,
  retryBudget: number,
  validationContext?: StructuredValidationContext,
  requestedReasoningEffort?: NormalizedReasoningEffort
): Promise<SchemaGuidedStructuredResponse> => {
  const schemaGuidedPrompt = buildSchemaGuidedPrompt(prompt, schema)
  const requestOptions: StructuredRequestOptions = {
    schemaName: schema.schemaName,
    schema: schema.jsonSchema,
    strict: false,
    strategy: 'schema-guided',
    requestedReasoningEffort
  }

  const maxAttempts = retryBudget + 1
  let lastIssue = 'Unknown schema-guided failure'
  let lastResponse: Awaited<ReturnType<LLMTarget['run']>> | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await target.run(schemaGuidedPrompt, model, requestOptions)
    lastResponse = response
    const validated = parseAndValidateStructured(schema.schema, response.result, validationContext)

    if (validated.success) {
      return {
        parsedJson: validated.value,
        rawResponse: response.result,
        metadata: response.metadata
      }
    }

    lastIssue = validated.issue ?? 'Unknown schema-guided validation failure'
    if (attempt < maxAttempts) {
      logRetryAttempt({
        operation: `structured-schema-guided-${target.label.toLowerCase()}`,
        failedAttempt: attempt,
        nextAttempt: attempt + 1,
        maxAttempts,
        reason: 'structured_response',
        reasonCode: 'classifier_refused',
        delayMs: 0
      }, { provider: target.label, model, issue: lastIssue })
    }
  }

  if (!lastResponse) {
    throw new AppError(
      formatRetryExhaustedMessage(`structured-schema-guided-${target.label.toLowerCase()}`, maxAttempts, maxAttempts, 'max attempts reached', 0),
      {
        kind: 'retry_exhausted',
        stage: 'write:schema-guided-fallback',
        retryable: false,
        metadata: {
          provider: target.label,
          model,
          issue: lastIssue,
          attemptsMade: maxAttempts,
          maxAttempts,
          stopReason: 'max attempts reached',
          stopReasonCode: 'max_attempts'
        }
      }
    )
  }

  l.warn(`Structured schema-guided fallback for ${target.label}/${model}: ${lastIssue}`, {
    category: 'pipeline',
    metadata: { provider: target.label, model, issue: lastIssue }
  })
  return {
    parsedJson: buildStructuredValidationFailureEnvelope(lastResponse.result, lastIssue),
    rawResponse: lastResponse.result,
    metadata: lastResponse.metadata
  }
}
