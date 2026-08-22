/** Bun-native file URL conversion with Node-compatible malformed-escape rejection. */
export const fileUrlToPath = (value: string | URL): string => {
  const url = value instanceof URL ? value : new URL(value)
  if (url.protocol !== 'file:') {
    throw new TypeError('The URL must use the file: scheme')
  }
  decodeURIComponent(url.pathname)
  return Bun.fileURLToPath(url)
}
