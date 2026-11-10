import { UsageError } from './error-handler'

const withoutUtf8Bom = (input: Uint8Array): Uint8Array =>
  input.byteLength >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf
    ? input.subarray(3)
    : input

const incompleteUtf8Prefix = (input: Uint8Array): string | undefined => {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let prefix: string
  try {
    prefix = decoder.decode(input, { stream: true })
  } catch {
    return undefined
  }
  try {
    decoder.decode()
    return undefined
  } catch {
    return prefix
  }
}

type JsonPrefixScan = { stack: string[], inString: boolean, escaped: boolean }

/** Returns undefined when a closer does not match the innermost open container. */
const scanJsonPrefix = (trimmed: string): JsonPrefixScan | undefined => {
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (const char of trimmed) {
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') stack.push(char)
    if (char === '}' || char === ']') {
      const expected = char === '}' ? '{' : '['
      if (stack.pop() !== expected) return undefined
    }
  }
  return { stack, inString, escaped }
}

const jsonPrefixCompletionCandidates = (trimmed: string, scan: JsonPrefixScan): string[] => {
  if (!scan.inString) {
    return ['', 'null', '0', 'e', 'ue', 'rue', 'se', 'lse', 'alse', 'l', 'll', 'ull', ':null', '"value":null']
  }
  let stringClose = '"'
  // The scanner has already consumed the escape marker after reading `u`,
  // but a crash can still leave its four hexadecimal digits unfinished.
  const unicodeEscape = trimmed.match(/\\u([0-9a-fA-F]{0,3})$/)
  if (unicodeEscape) stringClose = `${'0'.repeat(4 - unicodeEscape[1]!.length)}"`
  else if (scan.escaped) stringClose = `\\"`
  return [stringClose, `${stringClose}:null`]
}

const isCompletableJsonPrefix = (text: string): boolean => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  const scan = scanJsonPrefix(trimmed)
  if (!scan) return false
  if (!scan.inString && scan.stack.length === 0) return false
  const closers = scan.stack.toReversed().map((opening) => opening === '{' ? '}' : ']').join('')
  const candidates = jsonPrefixCompletionCandidates(trimmed, scan)
  return candidates.some((candidate) => {
    try {
      JSON.parse(`${trimmed}${candidate}${closers}`)
      return true
    } catch {
      return false
    }
  })
}

const throwMalformedJsonl = (label: string, error?: Error | null): never => {
  throw UsageError(`${label} contains a malformed complete JSONL record.`, error ? { cause: error } : {})
}

export const parseJsonlBytes = (
  input: Uint8Array,
  options: { allowTornFinalRecord: boolean, label: string }
): unknown[] => {
  const bytes = withoutUtf8Bom(input)
  if (bytes.byteLength === 0) return []
  let lastNewline = -1
  for (let index = bytes.byteLength - 1; index >= 0; index--) {
    if (bytes[index] === 0x0a) {
      lastNewline = index
      break
    }
  }

  const completeBytes = lastNewline >= 0 ? bytes.subarray(0, lastNewline + 1) : bytes.subarray(0, 0)
  const tail = lastNewline >= 0 ? bytes.subarray(lastNewline + 1) : bytes
  const values: unknown[] = []
  if (completeBytes.byteLength > 0) {
    const parsed = Bun.JSONL.parseChunk(completeBytes)
    if (parsed.error || !parsed.done) throwMalformedJsonl(options.label, parsed.error)
    values.push(...parsed.values)
  }
  if (tail.byteLength === 0 || (tail.byteLength === 1 && tail[0] === 0x0d)) return values

  let tailText: string
  try {
    tailText = new TextDecoder('utf-8', { fatal: true }).decode(tail)
  } catch (error) {
    const prefix = options.allowTornFinalRecord ? incompleteUtf8Prefix(tail) : undefined
    if (prefix !== undefined && isCompletableJsonPrefix(`${prefix}\ufffd`)) return values
    return throwMalformedJsonl(options.label, error instanceof Error ? error : null)
  }
  try {
    values.push(JSON.parse(tailText) as unknown)
    return values
  } catch (error) {
    if (options.allowTornFinalRecord && isCompletableJsonPrefix(tailText)) return values
    return throwMalformedJsonl(options.label, error instanceof Error ? error : null)
  }
}
