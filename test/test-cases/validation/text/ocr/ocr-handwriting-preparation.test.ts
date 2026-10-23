import { expect, test } from 'bun:test'
import { assertHandwritingReference, assertHandwritingSourceBytes, canonicalizeLocHandwriting, canonicalizeWhiteboard, parseLocCsv, selectReviewedLocAsset, selectWhiteboardRecord } from '~/tools/ocr-preparation/prepare-handwriting'
import { PROJECT_ROOT } from '~/utils/project-root'

const csv = 'Asset,AssetId,AssetStatus,DownloadUrl,Transcription\r\nasset-1,101,completed,https://tile.loc.gov/a.jpg,"One, two\r\nA ""quote""."\r\n'
test('reviewed LOC CSV preserves quoted commas, line endings and escaped quotes', () => {
  expect(selectReviewedLocAsset(csv, 'asset-1', '101').Transcription).toBe('One, two\r\nA "quote".')
  expect(() => parseLocCsv('"Unclosed')).toThrow('Unclosed')
  expect(() => parseLocCsv('"closed"trailing')).toThrow('Trailing')
})
test('wrong LOC IDs, unfinished rows and duplicate asset mappings fail admission', () => {
  expect(() => selectReviewedLocAsset(csv, 'asset-1', '102')).toThrow('identity')
  expect(() => selectReviewedLocAsset(csv.replace('completed', 'in_progress'), 'asset-1', '101')).toThrow('review status')
  expect(() => selectReviewedLocAsset(csv + csv.split('\r\n').slice(1).join('\r\n'), 'asset-1', '101')).toThrow('exactly one')
})
test('historical spelling and deleted words remain visible without editorial brackets; active reading text is separate', () => {
  const result = canonicalizeLocHandwriting({ Asset: 'mss35634001-41', AssetId: '341465', AssetStatus: 'completed', DownloadUrl: 'https://tile.loc.gov/a.jpg', Transcription: 'left [there] Tintagel\r\npassing [from] Boscastle\r\n' })
  expect(result.text).toBe('left there Tintagel\npassing from Boscastle\n')
  expect(result.readingText).toBe('left Tintagel\npassing Boscastle\n')
  expect(result.structure.deletedWordsRetained).toEqual(['there', 'from'])
  expect(result.structure.includesPrintedHeadings).toBe(true)
  expect(canonicalizeLocHandwriting({ Asset: 'mgw500029-5', AssetId: '367462', AssetStatus: 'completed', DownloadUrl: '', Transcription: 'His Excelency' }).structure.includesPrintedHeadings).toBe(false)
  expect(() => canonicalizeLocHandwriting({ Asset: 'other', AssetId: '0', AssetStatus: 'completed', DownloadUrl: '', Transcription: '[unknown]' })).toThrow('Unreviewed')
})
test('changed or unreviewed publisher bytes fail independent source pins', () => {
  expect(() => assertHandwritingSourceBytes('source/whiteboards-metadata.jsonl', new TextEncoder().encode('changed'))).toThrow('Unreviewed')
  expect(() => assertHandwritingSourceBytes('source/unknown.jsonl', new TextEncoder().encode('changed'))).toThrow('Unreviewed')
})
test('preparation command rejects execution flags before reading private fixtures', async () => {
  const proc = Bun.spawn([process.execPath, 'src/tools/ocr-preparation/prepare-handwriting.ts', '--run'], { cwd: PROJECT_ROOT, stdout: 'pipe', stderr: 'pipe' })
  expect(await proc.exited).toBe(1)
  expect(await new Response(proc.stderr).text()).toContain('no model execution')
})
test('Whiteboards selects transcription rather than semantic description and rejects a mismatched image', () => {
  const row = { id: '01', file_name: '01.webp', category: 'prose', transcription: 'Visible label', description: 'Invented semantic explanation' }
  expect(canonicalizeWhiteboard(selectWhiteboardRecord(JSON.stringify(row), '01')).text).toBe('Visible label\n')
  expect(() => selectWhiteboardRecord(JSON.stringify({ ...row, file_name: '02.webp' }), '01')).toThrow('pair')
  expect(() => selectWhiteboardRecord(JSON.stringify(row) + '\n' + JSON.stringify(row), '01')).toThrow('ambiguous')
})
test('handwritten table excludes drawing characters while retaining every cell and header', () => {
  const result = canonicalizeWhiteboard({ id: '07', file_name: '07.webp', category: 'table', transcription: 'Title\n\nHeading\n\nCITY | COUNTRY\n----+----\nDublin | Ireland\nAmman | Jordan\nWashington DC | USA' })
  expect(result.text).toBe('Title\n\nHeading\n\nCITY\tCOUNTRY\nDublin\tIreland\nAmman\tJordan\nWashington DC\tUSA\n')
  const changed = structuredClone(result.structure) as { cells: string[][] }
  changed.cells[1]!.reverse()
  expect(() => assertHandwritingReference(result.text, result.text, changed, result.structure)).toThrow('cell association')
})
test('flowchart lexical labels exclude boxes and independently preserve branch topology', () => {
  const transcription = 'Title\n\n   Heading\n\n   Question?\n      /   \\\n          Y             N\n          ↓             ↓\n  ┌──┐ ┌──┐\n  │YES│ │NO!│\n  └──┘ └──┘'
  const result = canonicalizeWhiteboard({ id: '08', file_name: '08.webp', category: 'flowchart', transcription })
  expect(result.text).toBe('Title\n\nHeading\n\nQuestion?\n\nY\tN\nYES\tNO!\n')
  const changed = structuredClone(result.structure) as { edges: Array<{ to: string }> }
  changed.edges[0]!.to = 'no'
  expect(() => assertHandwritingReference(result.text, result.text, changed, result.structure)).toThrow('branch topology')
  expect(() => assertHandwritingReference(result.text.replace('YES', 'Y3S'), result.text, result.structure, result.structure)).toThrow('lexical')
})
