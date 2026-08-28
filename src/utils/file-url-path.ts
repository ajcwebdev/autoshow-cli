import { ValidationError } from '~/utils/error-handler'

export const fileUrlToPath = (value: string | URL): string => {
  const url = value instanceof URL ? value : new URL(value)
  if (url.protocol !== 'file:') {
    throw ValidationError('The URL must use the file: scheme', { retryable: false })
  }
  decodeURIComponent(url.pathname)
  return Bun.fileURLToPath(url)
}
