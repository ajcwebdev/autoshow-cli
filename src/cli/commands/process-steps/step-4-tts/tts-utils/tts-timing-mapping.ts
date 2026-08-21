import type { PreparedProviderText } from '~/types'

/**
 * Maps a provider-space text offset back onto the canonical text using the prepared
 * source map. Only width-preserving mapped spans can carry a timing offset across, so a
 * rewritten span reports `undefined` rather than a misaligned canonical position.
 */
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
