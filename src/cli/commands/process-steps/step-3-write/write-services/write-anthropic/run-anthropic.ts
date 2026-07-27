import * as l from '~/utils/app-logger/app-logger'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import { readEnv } from '~/utils/validate/env-utils'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runAnthropicCompatibleModel } from '../anthropic-compatible'
import { getAnthropicClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-anthropic/anthropic-utils'

export const runAnthropicModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions,
  baseUrl?: string
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const apiKey = readEnv('ANTHROPIC_API_KEY')
  if (!apiKey) {
    l.error(`ANTHROPIC_API_KEY not found in environment`)
    throw InternalError('ANTHROPIC_API_KEY environment variable is required', { stage: 'write:anthropic', hints: hintsForMissingEnv('ANTHROPIC_API_KEY') })
  }

  const config = getAnthropicClientConfig(baseUrl)

  return await runAnthropicCompatibleModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'anthropic',
    providerLabel: 'Anthropic',
    operationName: 'anthropic-llm',
    supportsStructuredOutput: true
  })
}
