import type { TtsPronunciationLexicon, TtsPronunciationRule } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { hashCanonicalTtsValue } from '../script-to-audio/contract-identity'

const MAX_RULES = 5000
const WORD_CHARACTER = '[\\p{L}\\p{N}_]'

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')

const parseRule = (value: unknown, index: number, path: string): TtsPronunciationRule => {
  const label = `Pronunciation lexicon ${path} rule ${index + 1}`
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw UsageError(`${label} must be an object.`)
  const record = value as Record<string, unknown>
  const unknownKey = Object.keys(record).find((key) => !['match', 'alias', 'caseSensitive', 'wordBoundary'].includes(key))
  if (unknownKey) throw UsageError(`${label} has unsupported key "${unknownKey}". Expected match, alias, caseSensitive, wordBoundary.`)
  const { match, alias, caseSensitive, wordBoundary } = record
  if (typeof match !== 'string' || !match.trim()) throw UsageError(`${label} requires a non-empty "match" string.`)
  if (typeof alias !== 'string' || !alias.trim()) throw UsageError(`${label} requires a non-empty "alias" string.`)
  if (caseSensitive !== undefined && typeof caseSensitive !== 'boolean') throw UsageError(`${label} "caseSensitive" must be true or false.`)
  if (wordBoundary !== undefined && typeof wordBoundary !== 'boolean') throw UsageError(`${label} "wordBoundary" must be true or false.`)
  return { match, alias, caseSensitive: caseSensitive ?? true, wordBoundary: wordBoundary ?? true }
}

export const parseTtsPronunciationLexicon = (json: string, path: string): TtsPronunciationLexicon => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw UsageError(`Pronunciation lexicon ${path} is not valid JSON.`)
  }
  if (!Array.isArray(parsed) || parsed.length === 0) throw UsageError(`Pronunciation lexicon ${path} must be a non-empty JSON array of rules.`)
  if (parsed.length > MAX_RULES) throw UsageError(`Pronunciation lexicon ${path} has ${parsed.length} rules; the maximum is ${MAX_RULES}.`)
  const rules = parsed.map((value, index) => parseRule(value, index, path))
  const seen = new Set<string>()
  for (const rule of rules) {
    const key = rule.caseSensitive ? `s:${rule.match}` : `i:${rule.match.toLowerCase()}`
    if (seen.has(key)) throw UsageError(`Pronunciation lexicon ${path} defines "${rule.match}" more than once.`)
    seen.add(key)
  }
  return { schemaVersion: 1, rules, lexiconSha256: hashCanonicalTtsValue({ schemaVersion: 1, rules }) }
}

export const loadTtsPronunciationLexicon = async (path: string): Promise<TtsPronunciationLexicon> => {
  const file = Bun.file(path)
  if (!(await file.exists())) throw UsageError(`Pronunciation lexicon was not found: ${path}`)
  return parseTtsPronunciationLexicon(await file.text(), path)
}

const ruleRegExp = (rule: TtsPronunciationRule): RegExp => new RegExp(
  rule.wordBoundary
    ? `(?<!${WORD_CHARACTER})${escapeRegExp(rule.match)}(?!${WORD_CHARACTER})`
    : escapeRegExp(rule.match),
  rule.caseSensitive ? 'gu' : 'giu'
)

// One pass over the original text: the earliest match wins, ties go to the earlier rule, and
// inserted aliases are never rescanned.
export const applyTtsPronunciationLexicon = (
  text: string,
  lexicon: TtsPronunciationLexicon | undefined
): { text: string, replacements: number } => {
  if (!lexicon) return { text, replacements: 0 }
  const candidates = lexicon.rules.flatMap((rule, ruleIndex) =>
    [...text.matchAll(ruleRegExp(rule))].map((match) => ({ start: match.index, end: match.index + match[0].length, ruleIndex, alias: rule.alias })))
    .sort((left, right) => left.start - right.start || left.ruleIndex - right.ruleIndex)
  let cursor = 0
  let replacements = 0
  let result = ''
  for (const candidate of candidates) {
    if (candidate.start < cursor) continue
    result += text.slice(cursor, candidate.start) + candidate.alias
    cursor = candidate.end
    replacements += 1
  }
  return { text: result + text.slice(cursor), replacements }
}
