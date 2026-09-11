
const isAsciiLetter = (value: string | undefined): boolean =>
  value !== undefined && /[a-zA-Z]/.test(value)

const isAsciiDigit = (value: string | undefined): boolean =>
  value !== undefined && /[0-9]/.test(value)

export const skipRtfFallbackChars = (rtf: string, start: number, count: number): number => {
  let index = start
  let skipped = 0
  while (index < rtf.length && skipped < count) {
    if (rtf[index] === '\\' && rtf[index + 1] === "'") {
      index += 4
    } else {
      index++
    }
    skipped++
  }
  return index
}

export type RtfControlToken =
  | { kind: 'text'; text: string; end: number }
  | { kind: 'ignore'; end: number }
  | { kind: 'word'; word: string; number: number | undefined; end: number }

export const decodeRtfControl = (rtf: string, index: number): RtfControlToken => {
  const next = rtf[index + 1]
  if (next === undefined) {
    return { kind: 'text', text: '', end: index + 1 }
  }

  if (next === '\\' || next === '{' || next === '}') {
    return { kind: 'text', text: next, end: index + 2 }
  }

  if (next === '*') {
    return { kind: 'ignore', end: index + 2 }
  }

  if (next === "'") {
    const hex = rtf.slice(index + 2, index + 4)
    const code = Number.parseInt(hex, 16)
    return { kind: 'text', text: Number.isFinite(code) ? String.fromCharCode(code) : '', end: index + 4 }
  }

  if (!isAsciiLetter(next)) {
    const text = next === '~' ? ' ' : next === '_' ? '-' : ['-', '\n', '\r'].includes(next) ? '' : next
    return { kind: 'text', text, end: index + 2 }
  }

  let wordEnd = index + 1
  while (isAsciiLetter(rtf[wordEnd])) wordEnd++
  const word = rtf.slice(index + 1, wordEnd)

  let numberEnd = wordEnd
  if (rtf[numberEnd] === '-' || isAsciiDigit(rtf[numberEnd])) {
    numberEnd++
    while (isAsciiDigit(rtf[numberEnd])) numberEnd++
  }
  const numberRaw = rtf.slice(wordEnd, numberEnd)
  const number = numberRaw.length > 0 ? Number.parseInt(numberRaw, 10) : undefined

  index = numberEnd
  if (rtf[index] === ' ') index++
  return { kind: 'word', word, number, end: index }
}
