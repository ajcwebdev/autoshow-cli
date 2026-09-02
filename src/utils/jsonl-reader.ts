import { UsageError } from './error-handler'

const withoutUtf8Bom = (input: Uint8Array): Uint8Array =>
  input.byteLength >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf
    ? input.subarray(3)
    : input

const isIncompleteUtf8Suffix = (input: Uint8Array): boolean => {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  try {
    decoder.decode(input, { stream: true })
  } catch {
    return false
  }
  try {
    decoder.decode()
    return false
  } catch {
    return true
  }
}

const isCompletableJsonPrefix = (text: string): boolean => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
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
      if (stack.pop() !== expected) return false
    }
  }
  if (!inString && stack.length === 0) return false
  const closers = stack.toReversed().map((opening) => opening === '{' ? '}' : ']').join('')
  const candidates: string[] = []
  if (inString) {
    let stringClose = '"'
    if (escaped) {
      const unicodeEscape = trimmed.match(/\\u([0-9a-fA-F]{0,3})$/)
      stringClose = unicodeEscape
        ? `${'0'.repeat(4 - unicodeEscape[1]!.length)}"`
        : `\\"`
    }
    candidates.push(stringClose, `${stringClose}:null`)
  } else {
    candidates.push('', 'null', '0', 'e', 'ue', 'rue', 'se', 'lse', 'alse', 'l', 'll', 'ull', ':null', '"value":null')
  }
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
    if (options.allowTornFinalRecord && isIncompleteUtf8Suffix(tail)) return values
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
