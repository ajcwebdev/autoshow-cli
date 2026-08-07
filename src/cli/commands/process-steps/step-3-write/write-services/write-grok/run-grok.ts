import * as l from '~/utils/app-logger/app-logger'
import { readEnv } from '~/utils/validate/env-utils'
import { InternalError, hintsForMissingEnv } from '~/utils/error-handler'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import type { Step3Metadata, StructuredRequestOptions } from '~/types'
import { runOpenAICompatibleChatModel } from '../openai-compatible-chat'

const getGrokClientConfig = (baseUrl: string = XAI_DEFAULT_BASE_URL): { apiKey: string, baseURL: string } => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    l.error('XAI_API_KEY not found in environment for Grok model')
    throw InternalError('XAI_API_KEY environment variable is required for --grok models', { stage: 'write:grok', hints: hintsForMissingEnv('XAI_API_KEY') })
  }

  return {
    apiKey,
    baseURL: baseUrl.trim().replace(/\/+$/, '')
  }
}

export const runGrokModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions,
  baseUrl?: string
): Promise<{ result: string, metadata: Step3Metadata }> => {
  const config = getGrokClientConfig(baseUrl)

  return await runOpenAICompatibleChatModel({
    prompt,
    model,
    structuredOpts,
    config,
    service: 'grok',
    providerLabel: 'Grok',
    operationName: 'grok-llm'
  })
}
