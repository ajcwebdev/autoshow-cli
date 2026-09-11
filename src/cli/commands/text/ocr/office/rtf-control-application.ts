import type { RtfState } from '~/types'
import type { RtfControlToken } from './rtf-control-tokens'

const RTF_IGNORED_DESTINATIONS = new Set([
  'annotation',
  'author',
  'colortbl',
  'datastore',
  'fonttbl',
  'footer',
  'footerf',
  'footerl',
  'footerr',
  'footnote',
  'generator',
  'header',
  'headerf',
  'headerl',
  'headerr',
  'info',
  'listoverridetable',
  'listtable',
  'object',
  'pict',
  'revtbl',
  'rsidtbl',
  'stylesheet',
  'themedata',
  'xmlnstbl'
])

const RTF_CONTROL_TEXT: Readonly<Record<string, string>> = {
  par: '\n', line: '\n', tab: '\t', emdash: '--', endash: '-', lquote: "'", rquote: "'", ldblquote: '"', rdblquote: '"', bullet: '*'
}

export const applyRtfControl = (token: RtfControlToken, state: RtfState): { state: RtfState; text: string; fallbackChars: number } => {
  const result = { state, text: '', fallbackChars: 0 }
  if (token.kind === 'ignore' || (token.kind === 'word' && RTF_IGNORED_DESTINATIONS.has(token.word))) {
    return { ...result, state: { ...state, ignored: true } }
  }
  if (state.ignored) return result
  if (token.kind === 'text') return { ...result, text: token.text }
  const { word, number } = token
  if (word === 'uc' && number !== undefined && Number.isFinite(number) && number >= 0) {
    return { ...result, state: { ...state, uc: number } }
  }
  if (word === 'u' && number !== undefined && Number.isFinite(number)) {
    const codePoint = number < 0 ? number + 65536 : number
    let text = ''
    try { text = String.fromCodePoint(codePoint) } catch {}
    return { ...result, text, fallbackChars: state.uc }
  }
  return { ...result, text: Object.hasOwn(RTF_CONTROL_TEXT, word) ? RTF_CONTROL_TEXT[word]! : '' }
}
