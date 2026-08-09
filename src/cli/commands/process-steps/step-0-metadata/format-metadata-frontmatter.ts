import type { MetadataScalar } from '~/types'

const INDENT = '  '

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isScalar = (value: unknown): value is MetadataScalar =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const escapeSingleQuotedString = (value: string): string =>
  value.replace(/'/g, "''")

const renderScalar = (value: MetadataScalar, indentLevel: number): string => {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (!value.includes('\n')) {
    return `'${escapeSingleQuotedString(value)}'`
  }

  const indent = INDENT.repeat(indentLevel + 1)
  return `|-\n${value.split('\n').map(line => `${indent}${line}`).join('\n')}`
}

const renderEntry = (entry: unknown, prefix: string, indentLevel: number): string[] => {
  if (Array.isArray(entry)) {
    return entry.length === 0 ? [`${prefix} []`] : [prefix, renderArray(entry, indentLevel + 1)]
  }
  if (isPlainObject(entry)) {
    const hasEntries = Object.values(entry).some((nested) => nested !== undefined)
    return hasEntries ? [prefix, renderObject(entry, indentLevel + 1)] : [`${prefix} {}`]
  }
  if (isScalar(entry)) {
    return [`${prefix} ${renderScalar(entry, indentLevel)}`]
  }
  return [`${prefix} '${escapeSingleQuotedString(String(entry))}'`]
}

const renderObject = (value: Record<string, unknown>, indentLevel: number): string => {
  const lines: string[] = []
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      lines.push(...renderEntry(entry, `${INDENT.repeat(indentLevel)}${key}:`, indentLevel))
    }
  }
  return lines.join('\n')
}

const renderArray = (value: unknown[], indentLevel: number): string => {
  const lines: string[] = []
  for (const entry of value) {
    lines.push(...renderEntry(entry, `${INDENT.repeat(indentLevel)}-`, indentLevel))
  }
  return lines.join('\n')
}

export const formatMetadataAsFrontmatter = (metadata: Record<string, unknown>): string => {
  const body = renderObject(metadata, 0)
  return body.length > 0 ? `---\n${body}\n---\n` : '---\n---\n'
}
