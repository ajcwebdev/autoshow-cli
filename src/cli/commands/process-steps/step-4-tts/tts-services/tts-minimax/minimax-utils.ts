import * as v from 'valibot'
import { InfraError, ValidationError } from '~/utils/error-handler'

export const MinimaxBaseRespSchema = v.object({
  status_code: v.optional(v.number(), undefined),
  status_msg: v.optional(v.string(), undefined)
})

export const ensureMinimaxBaseRespSuccess = (
  baseResp: { status_code?: number | undefined, status_msg?: string | undefined } | undefined,
  context: string
): void => {
  if (baseResp?.status_code !== undefined && baseResp.status_code !== 0) {
    throw InfraError(`${context} failed (${baseResp.status_code}): ${baseResp.status_msg ?? 'Unknown error'}`, { stage: 'tts:minimax' })
  }
}

export const parseMinimaxJsonResponse = async (response: Response, context: string): Promise<unknown> => {
  const text = await response.text()
  if (!text.trim()) {
    throw ValidationError(`Empty response body for ${context}`, { stage: 'tts:minimax' })
  }
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw ValidationError(`Invalid JSON for ${context}: ${error instanceof Error ? error.message : String(error)}`, { stage: 'tts:minimax' })
  }
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
