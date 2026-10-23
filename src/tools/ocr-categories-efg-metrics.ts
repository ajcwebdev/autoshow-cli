import { AppValidationError } from '~/utils/error-handler'
import * as v from 'valibot'
import { isDeepStrictEqual } from 'node:util'
import { canonicalizeTable, serializeTableReference } from './ocr-preparation/prepare-code-tables'
import { normalizeHistoricalReference } from './ocr-preparation/prepare-historical-newspapers'
import { levenshteinDistance } from '../../.codex/skills/consensus/scripts/ocr/ocr_consensus_lib'

export type EfgOcrCategory = 'numeric-tables' | 'handwriting' | 'newspapers'
const string = v.string()
const nonempty = v.pipe(string, v.nonEmpty())
const positive = v.pipe(v.number(), v.integer(), v.minValue(1))
const nonnegative = v.pipe(v.number(), v.integer(), v.minValue(0))
const tableSchema = v.object({ schemaVersion: v.literal(1), kind: v.literal('ocr-table-canonical'), filename: nonempty,
  rowCount: positive, columnCount: positive, structureTokens: v.array(string), cells: v.array(v.object({
    index: nonnegative, row: nonnegative, column: nonnegative, rowSpan: positive, columnSpan: positive, text: string,
    rawTokens: v.array(string), bbox: v.optional(v.array(v.number())), isHeader: v.boolean()
  })) })
const manuscriptSchema = v.object({ kind: v.literal('reviewed-manuscript'), asset: nonempty, includesPrintedHeadings: v.boolean(),
  deletedWordsRetained: v.array(nonempty), originalEditorialNotation: v.array(nonempty) })
const whiteboardTableSchema = v.object({ kind: v.literal('table'), headings: v.array(nonempty), rows: positive, columns: positive,
  cells: v.array(v.array(nonempty)), readingOrder: nonempty })
const flowchartSchema = v.object({ kind: v.literal('flowchart'), title: nonempty, heading: nonempty,
  nodes: v.array(v.object({ id: nonempty, text: nonempty, shape: nonempty })),
  edges: v.array(v.object({ from: nonempty, to: nonempty, label: nonempty })), readingOrder: nonempty })
const proseSchema = v.object({ kind: v.literal('prose'), literalArrowInHeading: v.literal(true) })
const newspaperSchema = v.object({ sourceId: nonempty, sourceRevision: nonempty, readingOrder: v.array(nonempty),
  imageSize: v.object({ width: positive, height: positive }), errata: v.array(v.object({ source: nonempty, corrected: nonempty, basis: nonempty })) })

/** Validate reference serialization privately; return counts and policy only, never reference labels or coordinates. */
export const validateEfgOcrStructure = (category: EfgOcrCategory, source: unknown, reference: string) => {
  if (category === 'numeric-tables') {
    const table = v.parse(tableSchema, source)
    const rebuilt = canonicalizeTable({ filename: table.filename, html: { structure: { tokens: table.structureTokens },
      cells: table.cells.map(cell => ({ tokens: cell.rawTokens, ...(cell.bbox ? { bbox: cell.bbox } : {}),
        span: { rowspan: cell.rowSpan, colspan: cell.columnSpan }, is_header: cell.isHeader })) } })
    if (!isDeepStrictEqual(rebuilt, table) || serializeTableReference(rebuilt) !== reference) throw new AppValidationError('Table structure or row-major reference serialization changed')
    return { referenceStructureKind: table.kind, referenceCellCount: table.cells.length, referenceRows: table.rowCount, referenceColumns: table.columnCount,
      referenceMergedCells: table.cells.filter(cell => cell.rowSpan > 1 || cell.columnSpan > 1).length,
      referenceBlankAnchorCells: table.cells.filter(cell => !cell.text).length }
  }
  if (category === 'newspapers') {
    const newspaper = v.parse(newspaperSchema, source)
    return { referenceStructureKind: 'publisher-reading-order', reviewedReferenceErrata: newspaper.errata.length }
  }
  const parsed = v.parse(v.union([manuscriptSchema, whiteboardTableSchema, flowchartSchema, proseSchema]), source)
  if (parsed.kind === 'reviewed-manuscript') {
    if (!isDeepStrictEqual(parsed.originalEditorialNotation, parsed.deletedWordsRetained.map(word => `[${word}]`))) throw new AppValidationError('Manuscript deletion notation changed')
    return { referenceStructureKind: parsed.kind, retainedDeletedWordCount: parsed.deletedWordsRetained.length,
      publisherHeadingCaseConvention: parsed.includesPrintedHeadings }
  }
  if (parsed.kind === 'table') {
    if (parsed.cells.length !== parsed.rows || parsed.cells.some(row => row.length !== parsed.columns)
      || `${parsed.headings.join('\n\n')}\n\n${parsed.cells.map(row => row.join('\t')).join('\n')}\n` !== reference) throw new AppValidationError('Handwriting table reference serialization changed')
    return { referenceStructureKind: parsed.kind, referenceCellCount: parsed.rows * parsed.columns,
      referenceRows: parsed.rows, referenceColumns: parsed.columns }
  }
  if (parsed.kind === 'flowchart') {
    const ids = parsed.nodes.map(node => node.id)
    const question = parsed.nodes.find(node => node.id === 'question'), yes = parsed.nodes.find(node => node.id === 'yes'), no = parsed.nodes.find(node => node.id === 'no')
    if (ids.length !== 3 || new Set(ids).size !== 3 || !question || !yes || !no
      || !isDeepStrictEqual(parsed.edges, [{ from: 'question', to: 'yes', label: 'Y' }, { from: 'question', to: 'no', label: 'N' }])
      || `${parsed.title}\n\n${parsed.heading}\n\n${question.text}\n\nY\tN\n${yes.text}\t${no.text}\n` !== reference) throw new AppValidationError('Flowchart reference label/order serialization changed')
    return { referenceStructureKind: parsed.kind, referenceNodeCount: parsed.nodes.length, referenceEdgeCount: parsed.edges.length }
  }
  return { referenceStructureKind: parsed.kind, literalArrowIncludedInLexicalTarget: true }
}

export const efgOcrEvaluationPolicy = (category: EfgOcrCategory, scope: string, publisher: boolean, structure?: ReturnType<typeof validateEfgOcrStructure>) => ({
  scope, referenceTextScope: publisher ? 'Exhaustive lexical target for the declared input page/crop; drawing syntax is excluded where the publisher serialization declares it.' : 'Existing archived multi-provider consensus; not independent publisher gold.',
  primaryLexicalAccuracyAvailable: true, outputGeometryAvailable: false, structureAccuracyAvailable: false,
  structureAccuracyUnavailableReason: category === 'numeric-tables' || structure?.referenceStructureKind === 'table'
    ? 'Text-only OCR does not establish cell assignment, row/column mapping, spans or blank-cell geometry. Numeric/text presence is not table-structure accuracy.'
    : structure?.referenceStructureKind === 'flowchart'
      ? 'Text-only OCR does not establish node placement, edge direction or label-to-branch association. Correct label text is not graph-topology accuracy.'
      : category === 'newspapers'
        ? 'Text-only OCR does not establish column/region localization or page layout. An article crop does not establish whole-page reading order.'
        : 'Text-only OCR does not establish handwriting placement, drawing geometry or spatial association.',
  lexicalMetricLimitation: 'Headline WER/CER use the existing case-insensitive lexical normalization and declared reference order. Reading-order or serialization differences can increase edit distance; these scores do not measure layout or exact glyph/punctuation fidelity.',
  fidelityMetricLimitation: 'Literal numeric, punctuation and whitespace comparisons are representation-fidelity diagnostics. TSV tabs, span-continuation blanks, Markdown wrappers and source case conventions can differ without establishing a recognition error.',
  ...(structure ?? {})
})

// These are literal ASCII-digit substrings, not parsed financial values. Currency,
// signs, decimal/group separators, exponent notation, percent and paired parentheses
// remain part of a match; lexical surroundings and cell association are not inferred.
const literalNumbers = (text: string): string[] => text.match(/\((?:[+\-−±]?[£$€¥]?|[£$€¥][+\-−±]?)(?:\d+(?:[.,]\d+)*|\.\d+)(?:[eE][+\-]?\d+)?[%‰]?\)|(?:[+\-−±]?[£$€¥]?|[£$€¥][+\-−±]?)(?:\d+(?:[.,]\d+)*|\.\d+)(?:[eE][+\-]?\d+)?[%‰]?/g) ?? []
const ratio = (distance: number, count: number): number | null => count ? distance / count : null

/** Numeric counts only: no gold numeric literals are emitted by this diagnostic. */
export const scoreEfgNumericFidelity = (reference: string, candidate: string) => {
  const expected = literalNumbers(reference), actual = literalNumbers(candidate)
  const expectedCounts = new Map<string, number>(), actualCounts = new Map<string, number>()
  for (const token of expected) expectedCounts.set(token, (expectedCounts.get(token) ?? 0) + 1)
  for (const token of actual) actualCounts.set(token, (actualCounts.get(token) ?? 0) + 1)
  const matched = [...expectedCounts].reduce((sum, [token, count]) => sum + Math.min(count, actualCounts.get(token) ?? 0), 0)
  const edits = levenshteinDistance(expected, actual)
  return { referenceLiteralNumberCount: expected.length, candidateLiteralNumberCount: actual.length,
    literalNumberSequenceExact: isDeepStrictEqual(expected, actual), literalNumberSequenceEdits: edits,
    literalNumberSequenceErrorRate: ratio(edits, expected.length),
    matchedLiteralNumberCount: matched, missingLiteralNumberCount: expected.length - matched, unmatchedCandidateLiteralNumberCount: actual.length - matched,
    literalNumberMultisetCoverage: ratio(matched, expected.length),
    policy: 'Exact ASCII-digit substrings retain adjacent currency/signs, commas/decimals, exponent notation, percent/per-mille and paired parentheses. Duplicate matches count separately. Sequence comparison uses the declared reference order; multiset coverage ignores order. No numeric-value equivalence, localization or cell/branch association is inferred; incidental duplicate numbers can match.' }
}

export const scoreEfgOcrFidelity = (reference: string, candidate: string, category: EfgOcrCategory,
  exactCharacterDistance: (reference: string, candidate: string) => number, readingReference?: string) => {
  const canonical = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')
  const gold = canonical(reference), actual = canonical(candidate), punctuation = (text: string) => (text.match(/[\p{P}\p{S}]/gu) ?? []).join('')
  const goldPunctuation = punctuation(gold), actualPunctuation = punctuation(actual)
  const strict = exactCharacterDistance(gold, actual)
  return { strictTextExact: gold === actual, strictCharacterEdits: strict,
    strictCharacterErrorRate: ratio(strict, [...gold].length), referenceCharacters: [...gold].length,
    referencePunctuationSymbolCount: [...goldPunctuation].length, candidatePunctuationSymbolCount: [...actualPunctuation].length,
    punctuationSymbolCharacterErrorRate: ratio(exactCharacterDistance(goldPunctuation, actualPunctuation), [...goldPunctuation].length),
    literalNumbers: scoreEfgNumericFidelity(gold, actual),
    ...(category === 'numeric-tables' ? {} : { diplomaticCharacterErrorRate: ratio(strict, [...gold].length),
      readingNormalizedCharacterErrorRate: ratio(exactCharacterDistance(normalizeHistoricalReference(gold), normalizeHistoricalReference(actual)), [...normalizeHistoricalReference(gold)].length) }),
    ...(readingReference === undefined ? {} : { publisherReadingCompanion: {
      characterErrorRate: ratio(exactCharacterDistance(normalizeHistoricalReference(readingReference), normalizeHistoricalReference(actual)), [...normalizeHistoricalReference(readingReference)].length),
      policy: 'Alternate publisher reading reference omits declared deleted words. Candidate text is not edited to remove matching words. NFKC, quote/dash folding and whitespace normalization apply to both texts. The diplomatic primary target remains unchanged.' } }),
    policy: 'Whole-document, case/punctuation/Unicode-sensitive text comparison normalizes only line endings and final newline. Punctuation/symbol diagnostics preserve Unicode punctuation and symbol order. These are representation-fidelity measures: source heading case, derived TSV whitespace, drawing serialization and output Markdown wrappers can affect them. They do not establish table cells, branch mapping or page geometry.' }
}
