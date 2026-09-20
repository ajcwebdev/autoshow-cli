import * as v from 'valibot'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { validateData } from '~/utils/validate/validation'
import type { MinimaxBaseResponse, MinimaxFetchJsonOptions } from '~/types'

export const MinimaxBaseRespSchema = v.object({
  status_code: v.optional(v.number(), undefined),
  status_msg: v.optional(v.string(), undefined)
})



export const minimaxJsonRequestInit = (
  apiKey: string,
  method: 'GET' | 'POST',
  body?: unknown,
  signal?: AbortSignal
): RequestInit => ({
  method,
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  ...(signal ? { signal } : {})
})

const ensureMinimaxBaseRespSuccess = (
  baseResp: { status_code?: number | undefined, status_msg?: string | undefined } | undefined,
  context: string,
  stage: string
): void => {
  if (baseResp?.status_code !== undefined && baseResp.status_code !== 0) {
    throw InfraError(`${context} failed (${baseResp.status_code}): ${baseResp.status_msg ?? 'Unknown error'}`, { stage })
  }
}

export const minimaxFetchJson = async <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  input: string | URL,
  options: MinimaxFetchJsonOptions<TSchema>
): Promise<v.InferOutput<TSchema>> => {
  const request = async (signal?: AbortSignal): Promise<Response> => {
    const response = await fetch(input, {
      ...options.init,
      ...(signal ? { signal } : {})
    })
    if (!response.ok) {
      if (options.decorateError) {
        throw await options.decorateError(response)
      }
      const captured = await readRestResponseText(response)
      const payload = captured.truncated ? captured.sanitizedPreview : parseJsonOrText(captured.text)
      throw InfraError(`${options.httpErrorMessage} (${response.status}): ${extractRestErrorMessage(payload, captured.text, response.status)}`, {
        stage: options.stage,
        status: response.status,
        headers: response.headers
      })
    }
    return response
  }

  const response = options.execute
    ? await options.execute(request)
    : await request()
  const json = await readJsonResponse(response, options.responseContext, {
    stage: options.stage,
    ...(options.maxResponseBytes !== undefined ? { maxBytes: options.maxResponseBytes } : {})
  })
  if (typeof json === 'object' && json !== null && !Array.isArray(json) && Object.keys(json).length === 0) {
    throw ValidationError(`Empty response body for ${options.responseContext}`, { stage: options.stage })
  }
  const parsed = validateData(
    options.schema,
    json,
    options.responseContext
  )
  ensureMinimaxBaseRespSuccess(
    (parsed as MinimaxBaseResponse).base_resp,
    options.baseRespContext,
    options.stage
  )
  return parsed
}
