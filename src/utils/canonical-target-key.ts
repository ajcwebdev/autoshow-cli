import { createHash } from 'node:crypto'

export type CanonicalProviderOperation =
  | 'tts-synthesis'
  | 'comic-structure'
  | 'comic-image'
  | 'comic-audio'
  | (string & {})

const safeKeyPart = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized.slice(0, 48) || 'none'
}

export const canonicalTargetKey = (
  operation: CanonicalProviderOperation,
  service: string,
  model: string,
  transport: string
): string => {
  const digest = createHash('sha256').update(JSON.stringify({
    schemaVersion: 1,
    operation,
    service,
    model,
    transport
  })).digest('hex')
  return `${safeKeyPart(operation)}--${safeKeyPart(service)}--${digest}`
}
