import { ValidationError } from './error-handler'

export type OrderedXmlElement = {
  name: string
  attributes: Record<string, string>
  children: OrderedXmlChild[]
}

export type OrderedXmlChild =
  | string
  | OrderedXmlElement
  | { comment: string }
  | { target: string, data: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeAttributes = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) throw ValidationError('Bun.XML returned invalid element attributes.', { stage: 'xml:parse' })
  const attributes: Record<string, string> = {}
  for (const [name, attribute] of Object.entries(value)) {
    if (typeof attribute !== 'string') throw ValidationError('Bun.XML returned a non-string attribute.', { stage: 'xml:parse' })
    attributes[name] = attribute
  }
  return attributes
}

const normalizeChild = (
  value: unknown,
  depth: number,
  state: { count: number, maxDepth: number, maxNodes: number }
): OrderedXmlChild => {
  if (typeof value === 'string') return value
  if (!isRecord(value)) throw ValidationError('Bun.XML returned an invalid ordered child.', { stage: 'xml:parse' })
  if (typeof value['comment'] === 'string') return { comment: value['comment'] }
  if (typeof value['target'] === 'string' && typeof value['data'] === 'string') {
    return { target: value['target'], data: value['data'] }
  }
  return normalizeElement(value, depth, state)
}

const normalizeElement = (
  value: Record<string, unknown>,
  depth: number,
  state: { count: number, maxDepth: number, maxNodes: number }
): OrderedXmlElement => {
  if (depth > state.maxDepth) throw ValidationError(`XML exceeds the ${state.maxDepth} element depth limit.`, { stage: 'xml:parse' })
  state.count++
  if (state.count > state.maxNodes) throw ValidationError(`XML exceeds the ${state.maxNodes} element node limit.`, { stage: 'xml:parse' })
  if (typeof value['name'] !== 'string' || !Array.isArray(value['children'])) {
    throw ValidationError('Bun.XML returned an invalid ordered element.', { stage: 'xml:parse' })
  }
  return {
    name: value['name'],
    attributes: normalizeAttributes(value['attributes']),
    children: value['children'].map((child) => normalizeChild(child, depth + 1, state))
  }
}

export const parseOrderedXml = (
  xml: string,
  options: { maxBytes?: number, maxDepth?: number, maxNodes?: number } = {}
): OrderedXmlElement => {
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024
  const byteLength = Buffer.byteLength(xml)
  if (byteLength > maxBytes) throw ValidationError(`XML exceeds the ${maxBytes} byte limit.`, { stage: 'xml:parse' })
  let parsed: unknown
  try {
    parsed = Bun.XML.parse(xml, { compact: false })
  } catch (error) {
    throw ValidationError('XML is malformed or unsupported by Bun.XML.', {
      stage: 'xml:parse',
      ...(error instanceof Error ? { cause: error } : {})
    })
  }
  if (!isRecord(parsed)) throw ValidationError('Bun.XML returned an invalid document root.', { stage: 'xml:parse' })
  return normalizeElement(parsed, 1, {
    count: 0,
    maxDepth: options.maxDepth ?? 512,
    maxNodes: options.maxNodes ?? 1_000_000
  })
}

export const findOrderedXmlElements = (root: OrderedXmlElement, name: string): OrderedXmlElement[] => {
  const matches: OrderedXmlElement[] = []
  const visit = (element: OrderedXmlElement): void => {
    if (element.name === name) matches.push(element)
    for (const child of element.children) {
      if (typeof child === 'object' && 'name' in child) visit(child)
    }
  }
  visit(root)
  return matches
}

export const orderedXmlText = (element: OrderedXmlElement): string =>
  element.children.map((child) => {
    if (typeof child === 'string') return child
    if ('name' in child) return orderedXmlText(child)
    return ''
  }).join('')
