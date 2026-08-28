import { isRecord } from '~/utils/rest-client'

export const SUPADATA_PLAN_LIMIT_PATTERN = /\blimit[-\s_]?exceeded\b|\bexceeded\b[\s\S]{0,40}\b(?:limit|quota|plan)\b|\bquota[-\s_]?(?:exceeded|exhausted)\b/i

const readErrorText = (payload: unknown): string[] => {
  if (typeof payload === 'string') return [payload]
  if (!isRecord(payload)) return []

  const fields = [payload['error'], payload['message'], payload['details']]
  const texts = fields.filter((field): field is string => typeof field === 'string')
  if (isRecord(payload['error']) && typeof payload['error']['message'] === 'string') {
    texts.push(payload['error']['message'])
  }
  return texts
}

export const isSupadataPlanLimitExhausted = (
  payload: unknown,
  message?: string | undefined
): boolean => {
  const candidates = readErrorText(payload)
  if (typeof message === 'string') candidates.push(message)
  return candidates.some((text) => SUPADATA_PLAN_LIMIT_PATTERN.test(text))
}
