import { isRecord } from '~/utils/rest-client'

// Claude's raw JSON-schema endpoint rejects these constraints. Keep them as
// guidance in descriptions; the original local validator still enforces them.
// https://platform.claude.com/docs/en/build-with-claude/structured-outputs
const DESCRIPTION_CONSTRAINTS = new Set([
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minLength', 'maxLength', 'maxItems', 'uniqueItems', 'contains', 'minContains', 'maxContains'
])
const SUPPORTED_FORMATS = new Set([
  'date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid'
])
const SCHEMA_MAP_KEYS = new Set(['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas'])
const SCHEMA_LIST_KEYS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems'])
const SCHEMA_KEYS = new Set(['items', 'not', 'if', 'then', 'else', 'additionalItems', 'propertyNames'])

const transformSchemaNode = (node: unknown): unknown => {
  if (!isRecord(node)) return node
  const transformed: Record<string, unknown> = {}
  const guidance: string[] = []
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema') continue
    if (DESCRIPTION_CONSTRAINTS.has(key)
      || (key === 'minItems' && value !== 0 && value !== 1)
      || (key === 'format' && (typeof value !== 'string' || !SUPPORTED_FORMATS.has(value)))) {
      guidance.push(`${key}=${JSON.stringify(value)}`)
      if (key === 'minItems' && typeof value === 'number' && value > 1) transformed[key] = 1
      continue
    }
    if (SCHEMA_MAP_KEYS.has(key) && isRecord(value)) {
      transformed[key] = Object.fromEntries(Object.entries(value).map(([name, schema]) => [name, transformSchemaNode(schema)]))
    } else if ((SCHEMA_LIST_KEYS.has(key) || key === 'items') && Array.isArray(value)) {
      transformed[key] = value.map(transformSchemaNode)
    } else {
      transformed[key] = SCHEMA_KEYS.has(key) ? transformSchemaNode(value) : value
    }
  }
  if (node['type'] === 'object' || isRecord(node['properties'])
    || (Array.isArray(node['type']) && node['type'].includes('object'))) {
    transformed['additionalProperties'] = false
  }
  if (guidance.length > 0) {
    const existing = typeof node['description'] === 'string' ? `${node['description']}\n` : ''
    transformed['description'] = `${existing}Constraints checked locally: ${guidance.join('; ')}.`
  }
  return transformed
}

export const transformAnthropicJsonSchema = (schema: Record<string, unknown>): Record<string, unknown> =>
  transformSchemaNode(schema) as Record<string, unknown>
