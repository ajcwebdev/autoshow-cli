import type { CanonicalProviderOperation } from '~/types'
import { safeKeyPart } from '~/utils/value-helpers'

export const canonicalTargetKey = (
  operation: CanonicalProviderOperation,
  service: string,
  model: string,
  transport: string
): string => {
  const digest = new Bun.CryptoHasher('sha256').update(JSON.stringify({
    schemaVersion: 1,
    operation,
    service,
    model,
    transport
  })).digest('hex')
  return `${safeKeyPart(operation)}--${safeKeyPart(service)}--${digest}`
}
