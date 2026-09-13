// Reject the shipped example placeholders, without guessing at provider key formats.
export const normalizeCredentialValue = (raw: string | undefined): string | undefined => {
  const value = raw?.trim()
  return value && !/^your_[a-z0-9_]+_(?:key|token)_here$/i.test(value) ? value : undefined
}
