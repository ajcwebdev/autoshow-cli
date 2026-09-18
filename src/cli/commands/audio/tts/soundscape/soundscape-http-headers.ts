export const readSoundscapeHeader = (
  headers: Headers | Record<string, string> | undefined,
  name: string
): string | undefined => {
  if (!headers) return undefined
  if (headers instanceof Headers) return headers.get(name) ?? undefined
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())
  return typeof entry?.[1] === 'string' ? entry[1] : undefined
}
