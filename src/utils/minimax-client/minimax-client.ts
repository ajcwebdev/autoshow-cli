import * as v from 'valibot'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { extractRestErrorMessage, parseJsonOrText, readJsonResponse, readRestResponseText } from '~/utils/rest-client'
import { validateData } from '~/utils/validate/validation'
import type { MinimaxBaseResponse, MinimaxCreateResponse, MinimaxFetchJsonOptions, MinimaxQueryResponse } from '~/types'

export const MinimaxBaseRespSchema = v.object({
  status_code: v.optional(v.number(), undefined),
  status_msg: v.optional(v.string(), undefined)
})

export const MinimaxCreateResponseSchema = v.object({
  task_id: v.union([v.string(), v.number()]),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

const MinimaxQueryDataSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  error_message: v.optional(v.string(), undefined)
})

export const MinimaxQueryResponseSchema = v.object({
  status: v.optional(v.union([v.string(), v.number()]), undefined),
  file_id: v.optional(v.union([v.string(), v.number()]), undefined),
  error_message: v.optional(v.string(), undefined),
  data: v.optional(MinimaxQueryDataSchema, undefined),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
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
  const json = await readJsonResponse(response, options.responseContext, { stage: options.stage })
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

export const readMinimaxTaskStatus = (query: MinimaxQueryResponse): string | number | undefined =>
  query.data?.status ?? query.status

export const resolveMinimaxFileId = (
  query: MinimaxQueryResponse,
  create?: MinimaxCreateResponse | undefined
): string | undefined => {
  const rawFileId = query.data?.file_id ?? query.file_id ?? create?.file_id
  return rawFileId === undefined ? undefined : String(rawFileId)
}

export const isMinimaxTaskSuccess = (status: string | number | undefined): boolean => {
  if (status === 2 || status === '2') return true
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase()
    return normalized === 'success' || normalized === 'succeeded' || normalized === 'completed'
  }
  return false
}

export const isMinimaxTaskFailure = (status: string | number | undefined): boolean => {
  if (status === 3 || status === '3') return true
  if (typeof status === 'string') {
    const normalized = status.trim().toLowerCase()
    return normalized === 'fail' || normalized === 'failed' || normalized === 'error'
  }
  return false
}
