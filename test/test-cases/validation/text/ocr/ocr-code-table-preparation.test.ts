import { describe, expect, test } from 'bun:test'
import {
  assertCodeReferenceMatchesSource, assertTableReferenceMatchesSource,
  canonicalizeTable, serializeCodeReference, serializeTableReference, tableTokenText,
  type TableSourceRecord
} from '~/tools/ocr-preparation/prepare-code-tables'

const sourceTable = (): TableSourceRecord => ({ filename: 'fixture.png', html: {
  cells: [
    { tokens: ['<b>', 'Profit', '</b>'] },
    { tokens: ['2', '0', '2', '6'] },
    { tokens: ['−', '1', '.', '0', '5', '%'] },
    { tokens: [] },
    { tokens: ['<sup>', '1', '</sup>', 'E', '−', '3'], span: { rowspan: 1, colspan: 2 } }
  ],
  structure: { tokens: ['<thead>', '<tr>', '<td>', '</td>', '<td>', '</td>', '</tr>', '</thead>',
    '<tbody>', '<tr>', '<td>', '</td>', '<td>', '</td>', '</tr>', '<tr>', '<td', ' colspan="2"', '>', '</td>', '</tr>', '</tbody>'] }
} })

describe('local code reference preparation preserves OCR-significant content', () => {
  const source = 'if (args[0] == "--") {\r\n\tvar n = x[i - 1];\r\n}'
  test('only line endings and final newline change; tabs and incomplete fragments stay literal', () => {
    expect(serializeCodeReference(source)).toBe('if (args[0] == "--") {\n\tvar n = x[i - 1];\n}\n')
    expect(serializeCodeReference('else if (x < 1)\n{\n\treturn;')).toBe('else if (x < 1)\n{\n\treturn;\n')
  })
  for (const [label, changed] of [
    ['Boolean operator', 'if (args[0] = "--") {\n\tvar n = x[i - 1];\n}\n'],
    ['hyphen', 'if (args[0] == "-") {\n\tvar n = x[i - 1];\n}\n'],
    ['index sign', 'if (args[0] == "--") {\n\tvar n = x[i + 1];\n}\n'],
    ['indentation', 'if (args[0] == "--") {\n    var n = x[i - 1];\n}\n'],
    ['invented completion', 'if (args[0] == "--") {\n\tvar n = x[i - 1];\n}\n}\n']
  ] as const) test(`rejects changed ${label} before any model dispatch`, () => {
    expect(() => assertCodeReferenceMatchesSource(source, changed)).toThrow('differs')
  })
  test('rejects empty or binary source', () => {
    expect(() => serializeCodeReference('  ')).toThrow()
    expect(() => serializeCodeReference('x\0y')).toThrow()
  })
})

describe('local table preparation preserves text, blanks and structure independently', () => {
  test('maps exact signed numbers, blanks, formatting and merged anchors without duplication', () => {
    const source = sourceTable()
    const canonical = canonicalizeTable(source)
    expect(canonical.rowCount).toBe(3)
    expect(canonical.columnCount).toBe(2)
    expect(canonical.cells.map(cell => [cell.row, cell.column, cell.rowSpan, cell.columnSpan, cell.text])).toEqual([
      [0, 0, 1, 1, 'Profit'], [0, 1, 1, 1, '2026'], [1, 0, 1, 1, '−1.05%'], [1, 1, 1, 1, ''], [2, 0, 1, 2, '1E−3']
    ])
    expect(serializeTableReference(canonical)).toBe('Profit\t2026\n−1.05%\t\n1E−3\t\n')
    expect(canonical.cells[0]!.rawTokens).toEqual(['<b>', 'Profit', '</b>'])
    expect(() => assertTableReferenceMatchesSource(source, canonical, serializeTableReference(canonical))).not.toThrow()
  })
  for (const kind of ['sign', 'decimal', 'percent', 'blank', 'assignment', 'span', 'raw-formatting']) test(`rejects changed ${kind} while other dimensions may remain identical`, () => {
    const source = sourceTable()
    const changed = canonicalizeTable(source)
    if (kind === 'sign') changed.cells[2]!.text = '1.05%'
    if (kind === 'decimal') changed.cells[2]!.text = '−105%'
    if (kind === 'percent') changed.cells[2]!.text = '−1.05'
    if (kind === 'blank') changed.cells[3]!.text = '0'
    if (kind === 'assignment') changed.cells[2]!.column = 1
    if (kind === 'span') changed.cells[4]!.columnSpan = 1
    if (kind === 'raw-formatting') changed.cells[0]!.rawTokens = ['Profit']
    expect(() => assertTableReferenceMatchesSource(source, changed, serializeTableReference(changed))).toThrow('Structured table')
  })
  test('rejects differing flat text even when structured reference is intact', () => {
    const source = sourceTable()
    const canonical = canonicalizeTable(source)
    expect(() => assertTableReferenceMatchesSource(source, canonical, 'Profit 2026 1.05% 1E3\n')).toThrow('Table text')
  })
  test('retains rowspan assignment across subsequent rows', () => {
    const source: TableSourceRecord = { filename: 'span.png', html: {
      cells: [{ tokens: ['A'], span: { rowspan: 2, colspan: 1 } }, { tokens: ['1'] }, { tokens: ['2'] }],
      structure: { tokens: ['<tr><td rowspan="2"></td><td></td></tr><tr><td></td></tr>'] }
    } }
    expect(canonicalizeTable(source).cells.map(cell => [cell.row, cell.column])).toEqual([[0, 0], [0, 1], [1, 1]])
  })
  test('rejects missing cells, inconsistent spans and unrecognized markup', () => {
    const missing = sourceTable(); missing.html.cells.pop()
    expect(() => canonicalizeTable(missing)).toThrow('more cells')
    const mismatch = sourceTable(); mismatch.html.cells[4]!.span!.colspan = 3
    expect(() => canonicalizeTable(mismatch)).toThrow('span disagrees')
    expect(() => tableTokenText(['<PERCENTAGE>'])).toThrow('Unknown')
  })
  test('converts supported entities while rejecting invalid entities and preserving comparisons', () => {
    expect(tableTokenText(['&lt;', ' ', '1', ' ', '&amp;', ' ', '&#x2212;', '2'])).toBe('< 1 & −2')
    expect(tableTokenText(['<sup>', ' ', '</sup>'])).toBe('')
    expect(() => tableTokenText(['&invented;'])).toThrow()
    expect(() => tableTokenText(['&#0;'])).toThrow()
  })
})
