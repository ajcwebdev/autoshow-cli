import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { LlamaResponseSchema } from '~/types'
import { validateData } from '~/utils/validate/validation'
import * as l from '~/utils/app-logger/app-logger'
import { InfraError } from '~/utils/error-handler'
import {
  LLAMAFILE_BASE_URL,
  LLAMAFILE_CHAT_TEMPLATE_KWARGS,
  LLAMAFILE_EMPTY_RESPONSE_MAX_ATTEMPTS,
  LLAMAFILE_EMPTY_RESPONSE_RETRY_DELAY_MS
} from './llamafile-constants'

export const requestLlamafileCompletion = async (
  prompt: string,
  model: string,
  signal?: AbortSignal
): Promise<{ responseText: string, outputTokenCount: number }> => {
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
      chat_template_kwargs: LLAMAFILE_CHAT_TEMPLATE_KWARGS
    }),
    ...(signal ? { signal } : {})
  }

  for (let attempt = 1; attempt <= LLAMAFILE_EMPTY_RESPONSE_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${LLAMAFILE_BASE_URL}/v1/chat/completions`, init)

    if (!response.ok) {
      throw InfraError(`llamafile API error: ${response.status} ${response.statusText}`, { stage: 'write:llamafile' })
    }

    const rawData = await response.json()
    const data = validateData(LlamaResponseSchema, rawData, 'llamafile API response')
    const responseText = data.choices?.[0]?.message?.content ?? ''

    if (responseText.trim().length > 0) {
      return {
        responseText,
        outputTokenCount: data.usage?.completion_tokens || countTokens(responseText)
      }
    }

    if (attempt < LLAMAFILE_EMPTY_RESPONSE_MAX_ATTEMPTS) {
      l.debug(`llamafile returned an empty response; retrying (${attempt}/${LLAMAFILE_EMPTY_RESPONSE_MAX_ATTEMPTS})`)
      await Bun.sleep(LLAMAFILE_EMPTY_RESPONSE_RETRY_DELAY_MS)
    }
  }

  throw InfraError('No response from llamafile model', { stage: 'write:llamafile' })
}
