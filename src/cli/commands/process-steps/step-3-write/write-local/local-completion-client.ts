import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { StructuredRequestOptions } from '~/types'
import { LlamaResponseSchema } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import { validateData } from '~/utils/validate/validation'

export type LocalCompletionProfile = {
  baseUrl: string
  service: string
  stage: string
}

export type LocalCompletionResult = {
  responseText: string
  outputTokenCount: number
}

const EMPTY_RESPONSE_MAX_ATTEMPTS = 3
const EMPTY_RESPONSE_RETRY_DELAY_MS = 500

export const requestLocalCompletion = async (
  profile: LocalCompletionProfile,
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions,
  signal?: AbortSignal
): Promise<LocalCompletionResult> => {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      temperature: 0.7,
      max_tokens: 4096,
      chat_template_kwargs: { enable_thinking: false },
      ...(structuredOpts?.strategy === 'native'
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: structuredOpts.schemaName,
                schema: structuredOpts.schema,
                strict: structuredOpts.strict
              }
            }
          }
        : {})
    }),
    ...(signal ? { signal } : {})
  }

  for (let attempt = 1; attempt <= EMPTY_RESPONSE_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${profile.baseUrl}/v1/chat/completions`, init)

    if (!response.ok) {
      throw InfraError(`${profile.service} API error: ${response.status} ${response.statusText}`, { stage: profile.stage })
    }

    const rawData = await response.json()
    const data = validateData(LlamaResponseSchema, rawData, `${profile.service} API response`)
    const responseText = data.choices?.[0]?.message?.content ?? ''

    if (responseText.trim().length > 0) {
      return {
        responseText,
        outputTokenCount: data.usage?.completion_tokens || countTokens(responseText)
      }
    }

    if (attempt < EMPTY_RESPONSE_MAX_ATTEMPTS) {
      l.debug(`${profile.service} returned an empty response; retrying (${attempt}/${EMPTY_RESPONSE_MAX_ATTEMPTS})`)
      await Bun.sleep(EMPTY_RESPONSE_RETRY_DELAY_MS)
    }
  }

  throw InfraError(`No response from ${profile.service} model`, { stage: profile.stage })
}
