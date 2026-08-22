import type { PreparedProviderText } from '~/types'

export const canonicalOffsetForProviderOffset = (
  prepared: PreparedProviderText,
  providerOffset: number
): number | undefined => {
  for (const span of prepared.spans) {
    if (span.kind !== 'mapped' || span.providerStart === undefined || span.providerEnd === undefined || span.canonicalStart === undefined || span.canonicalEnd === undefined) continue
    if (providerOffset < span.providerStart || providerOffset >= span.providerEnd) continue
    const providerWidth = span.providerEnd - span.providerStart
    const canonicalWidth = span.canonicalEnd - span.canonicalStart
    if (providerWidth !== canonicalWidth) return undefined
    return span.canonicalStart + (providerOffset - span.providerStart)
  }
  return undefined
}
