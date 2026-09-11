import { posix } from 'node:path'

export const normalizeRelPath = (value: string): string => {
  const normalized = posix.normalize(value.replace(/\\/g, '/'))
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

export const normalizeEntryPath = (value: string): string =>
  value.replace(/\\/g, '/').replace(/^\.?\//, '')

const decodeHrefPath = (href: string): string =>
  href
    .split('/')
    .map(segment => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')

export const tryDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const resolvePackageHref = (packagePath: string, href: string): string => {
  const cleanHref = href.split(/[?#]/, 1)[0]?.trim() ?? ''
  if (!cleanHref) return ''
  const resolved = posix.normalize(posix.join(posix.dirname(packagePath), decodeHrefPath(cleanHref)))
  return normalizeRelPath(resolved)
}

export const normalizeRootRelativeHref = (href: string): string => {
  const cleanHref = href.split(/[?#]/, 1)[0]?.trim() ?? ''
  if (!cleanHref) return ''
  const normalized = posix.normalize(decodeHrefPath(cleanHref.replace(/^\/+/, '')))
  return normalized === '.' ? '' : normalizeEntryPath(normalized)
}

export const splitTocHref = (hrefRaw: string): { href: string, fragment?: string } => {
  const hashIndex = hrefRaw.indexOf('#')
  if (hashIndex === -1) {
    return { href: hrefRaw }
  }

  const href = hrefRaw.slice(0, hashIndex)
  const fragment = hrefRaw.slice(hashIndex + 1).trim()
  return {
    href,
    ...(fragment ? { fragment } : {})
  }
}
