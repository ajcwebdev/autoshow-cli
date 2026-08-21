export const estimateTokens = (text: string): number => text.split(/\s+/).filter(Boolean).length

export const toArray = <T>(value: T | T[] | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value]

/**
 * Turns a structured-output field key into a Markdown heading label: camelCase,
 * snake_case, and kebab-case all collapse to spaced words with a leading capital.
 */
export const humanizeKey = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}
