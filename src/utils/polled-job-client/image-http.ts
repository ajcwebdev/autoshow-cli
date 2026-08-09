export const readJsonOrText = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (text.length === 0) return ''
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export const extractImageErrorMessage = (
  payload: unknown,
  extraKeys: readonly string[] = []
): string | undefined => {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'details', ...extraKeys]) {
    const value = record[key]
    if (typeof value === 'string') return value
    if (value !== undefined) return JSON.stringify(value)
  }
  return JSON.stringify(payload)
}

export const withImageProviderHeaders = (
  init: RequestInit,
  authHeaders: Record<string, string>
): RequestInit => {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  for (const [name, value] of Object.entries(authHeaders)) {
    headers.set(name, value)
  }
  return { ...init, headers }
}
