import { AppValidationError, AppUsageError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { isDeepStrictEqual } from 'node:util'
import { resolve } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'

const codeRoot = 'input/examples/document/ocr-technical-code'
const tableRoot = 'input/examples/document/ocr-numeric-tables'
const codeArchive = 'https://zenodo.org/records/3743394/files/replication.zip?download=1'
const pubRevision = '8ffde9024bd331f5a61c3c549fdf30dd3c3e43a5'
const synthRevision = 'd4266dc3094e42e82f3b30060d22f3e4e394093c'
const pubBase = `https://raw.githubusercontent.com/ibm-aur-nlp/PubTabNet/${pubRevision}`
const synthArchive = 'https://ds4sd-public-artifacts.s3.eu-de.cloud-object-storage.appdomain.cloud/datasets/synthtabnet_public/samples.zip'
const hash = (bytes: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const utf8 = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes)

export interface TableSourceRecord {
  filename: string
  html: {
    cells: Array<{ tokens: string[], bbox?: number[], span?: { rowspan: number, colspan: number }, is_header?: boolean }>
    structure: { tokens: string[] }
  }
}

export interface CanonicalTableCell {
  index: number
  row: number
  column: number
  rowSpan: number
  columnSpan: number
  text: string
  rawTokens: string[]
  bbox?: number[]
  isHeader: boolean
}

export interface CanonicalTable {
  schemaVersion: 1
  kind: 'ocr-table-canonical'
  filename: string
  rowCount: number
  columnCount: number
  cells: CanonicalTableCell[]
  structureTokens: string[]
}

/** Preserve every source character except platform line endings and the final newline convention. */
export const serializeCodeReference = (source: string): string => {
  if (!source.trim() || source.includes('\0')) throw new AppValidationError('Source code must be nonempty UTF-8 text')
  return source.replace(/\r\n?/g, '\n').replace(/\n*$/, '\n')
}

export const assertCodeReferenceMatchesSource = (source: string, reference: string): void => {
  if (serializeCodeReference(source) !== reference) throw new AppValidationError('Code reference differs from exact visible source fragment')
}

/** Formatting belongs in rawTokens; visible characters, including signs and superscript text, remain. */
export const tableTokenText = (tokens: string[]): string => {
  if (!Array.isArray(tokens) || tokens.some(token => typeof token !== 'string')) throw new AppValidationError('Cell tokens must be strings')
  let text = tokens.join('').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<\/?(?:b|i|sup|sub|strong|em)>/gi, '')
  if (/<\/?[a-z][^>]*>/i.test(text)) throw new AppValidationError('Unknown table cell markup')
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  text = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_all, entity: string) => {
    if (entity.startsWith('#')) {
      const value = entity.toLowerCase().startsWith('#x') ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10)
      if (!Number.isSafeInteger(value) || value < 1 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) throw new AppValidationError('Invalid numeric HTML entity')
      return String.fromCodePoint(value)
    }
    const decoded = entities[entity.toLowerCase()]
    if (decoded === undefined) throw new AppValidationError(`Unsupported HTML entity: ${entity}`)
    return decoded
  })
  return text.replace(/\s+/g, ' ').trim()
}

/** Map official row-major structure onto source cells without deleting blank or merged cells. */
export const canonicalizeTable = (source: TableSourceRecord): CanonicalTable => {
  if (!source.filename || !Array.isArray(source.html?.cells) || !Array.isArray(source.html.structure?.tokens)) throw new AppValidationError('Invalid table source record')
  if (source.html.structure.tokens.some(token => typeof token !== 'string')) throw new AppValidationError('Structure tokens must be strings')
  const structure = source.html.structure.tokens.join('')
  const tags = structure.match(/<[^>]*>/g) ?? []
  if (tags.join('') !== structure) throw new AppValidationError('Unexpected text in table structure')
  const occupied = new Set<string>()
  const cells: CanonicalTableCell[] = []
  let row = -1
  let inRow = false
  let cellOpen = false
  let column = 0
  let columns = 0
  let header = false
  for (const tag of tags) {
    if (tag === '<thead>') { header = true; continue }
    if (tag === '</thead>') { header = false; continue }
    if (['<tbody>', '</tbody>', '<table>', '</table>'].includes(tag)) continue
    if (tag === '<tr>') {
      if (inRow || cellOpen) throw new AppValidationError('Nested table row')
      row++; inRow = true; column = 0; continue
    }
    if (tag === '</tr>') {
      if (!inRow || cellOpen) throw new AppValidationError('Unclosed table cell')
      inRow = false; continue
    }
    if (tag === '</td>' || tag === '</th>') {
      if (!cellOpen) throw new AppValidationError('Unmatched closing table cell')
      cellOpen = false; continue
    }
    const opening = /^<(td|th)((?:\s+(?:rowspan|colspan)="[1-9]\d*")*)>$/.exec(tag)
    if (!opening || !inRow || cellOpen) throw new AppValidationError(`Invalid table structure tag: ${tag}`)
    const attrs = opening[2] ?? ''
    const rowSpan = Number(/rowspan="(\d+)"/.exec(attrs)?.[1] ?? '1')
    const columnSpan = Number(/colspan="(\d+)"/.exec(attrs)?.[1] ?? '1')
    if ((attrs.match(/rowspan=/g)?.length ?? 0) > 1 || (attrs.match(/colspan=/g)?.length ?? 0) > 1 || rowSpan > 1000 || columnSpan > 1000) throw new AppValidationError('Invalid table span')
    while (occupied.has(`${row}:${column}`)) column++
    const sourceCell = source.html.cells[cells.length]
    if (!sourceCell) throw new AppValidationError('Structure has more cells than annotations')
    if (sourceCell.span && (sourceCell.span.rowspan !== rowSpan || sourceCell.span.colspan !== columnSpan)) throw new AppValidationError('Cell span disagrees with structure')
    for (let r = row; r < row + rowSpan; r++) for (let c = column; c < column + columnSpan; c++) {
      const key = `${r}:${c}`
      if (occupied.has(key)) throw new AppValidationError('Overlapping table cells')
      occupied.add(key)
    }
    cells.push({ index: cells.length, row, column, rowSpan, columnSpan,
      text: tableTokenText(sourceCell.tokens), rawTokens: [...sourceCell.tokens],
      ...(sourceCell.bbox ? { bbox: [...sourceCell.bbox] } : {}), isHeader: sourceCell.is_header ?? (header || opening[1] === 'th') })
    column += columnSpan; columns = Math.max(columns, column); cellOpen = true
  }
  if (inRow || cellOpen || cells.length !== source.html.cells.length || row < 0) throw new AppValidationError('Table structure/reference cell mismatch')
  if (cells.some(cell => cell.row + cell.rowSpan > row + 1)) throw new AppValidationError('Row span extends beyond table')
  return { schemaVersion: 1, kind: 'ocr-table-canonical', filename: source.filename, rowCount: row + 1,
    columnCount: columns, cells, structureTokens: [...source.html.structure.tokens] }
}

/** TSV is a derived reading view. Spanned continuations stay empty; source anchor text occurs once. */
export const serializeTableReference = (table: CanonicalTable): string => {
  const grid = Array.from({ length: table.rowCount }, () => Array<string>(table.columnCount).fill(''))
  for (const cell of table.cells) {
    const target = grid[cell.row]
    if (!target || cell.column < 0 || cell.column >= table.columnCount) throw new AppValidationError('Cell outside table bounds')
    target[cell.column] = cell.text
  }
  return grid.map(row => row.join('\t')).join('\n') + '\n'
}

export const assertTableReferenceMatchesSource = (source: TableSourceRecord, actual: CanonicalTable, text: string): void => {
  const expected = canonicalizeTable(source)
  if (!isDeepStrictEqual(actual, expected)) throw new AppValidationError('Structured table reference differs from source cells, text or spans')
  if (serializeTableReference(expected) !== text) throw new AppValidationError('Table text reference differs from canonical row-major view')
}

const codePins = [
  ['technical-code-nbitcoin', 'c#', 'co14', '7.cs', 'NBitcoin', '92876d9ca5bf05c97692bd22aa067c129b0009786a410ecedab366d7ac19af87', '968ec286240511b6f11c024c7e536197e1bb501e93831e796aa4a70834f4fffa'],
  ['technical-code-cli-parser', 'c#', 'ar12', '15.cs', 'CLI parser', 'e766ecb6169c5c1fe772aa9ca343ed2c2a7e2aeb22bc0e1ea6dc9ec7562fe695', '3fba2c538a1577346862c9b23f973b8b42c56844bd836012acf191d80f736fd2'],
  ['technical-code-pinta', 'c#', 'ti12', '26.cs', 'Pinta', '11390feb836f100c0218efdeb1fb5ca6a9ff1193a2cc9d0eaa53c2589df6ba86', '97d4146f076beea106f2d5d554972b7a057a2685e23e547d13d15142a51e6bab'],
  ['technical-code-podio', 'java', 'co10', '32.java', 'Podio', '58e3ef9f8d8d1b9e0d435918a977e2419458342f9af2063f7fd16a26759dd232', '43f3bc04789cfa3d8ee7f2c244a6765f05f05a54ce3430c396fc24697fe79d08'],
  ['technical-code-country-codes', 'java', 'ar14', '40.java', 'Gisgraphy', 'e40a4e823234f1039d3d1b289245aff0fa0072b85b496fa41cb3be35984fd54e', '9c29beebf785e753956ca1cf7c10c275cb8a6d4b29149d39187f36db2422eb5f']
] as const

const tablePins = [
  ['numeric-tables-practitioner-attitudes', 'PMC1626454_002_00.png', 'PubTabNet_Examples.jsonl', '858ad438bdc1fd6af7538e7a0704c85d62696a601dadf0174a5b0b380685e9f2', 'd34a3a312e57f9c2f3aba335729320ee3dd52ddf09b0c81b59d65746d910dac7', 100, false],
  ['numeric-tables-inflammatory-pathways', 'PMC2838834_005_00.png', 'PubTabNet_Examples.jsonl', '858ad438bdc1fd6af7538e7a0704c85d62696a601dadf0174a5b0b380685e9f2', 'bc562e84633962e9d0dcdbdecf0169980b42df376d350007520a788c43a57b80', 248, false],
  ['numeric-tables-program-implementation', 'PMC4172848_007_00.png', 'PubTabNet_Examples.jsonl', '858ad438bdc1fd6af7538e7a0704c85d62696a601dadf0174a5b0b380685e9f2', 'd15370b68ac5922badb07117a85e681047efc3d09c4a7d88d30c4e6fda5dd961', 121, false],
  ['numeric-tables-synthetic-financial', 'image_000011_1634629328.535577.png', 'fintabnet-synthetic_data.jsonl', '0bb137d1cec48a1362b53c99151e5cede110b861a4a5cef9ff2625798d64770e', '317d8d94d524b4bf0edfdf4b4714a1dc4c2693b0b2bea328d5a76aaef7ad96f4', 209, true],
  ['numeric-tables-synthetic-marketing', 'image_000002_1634629424.103172.png', 'marketing-synthetic_data.jsonl', '71eb642c91cbef72fee8fe3ef1b458f698dca4a0bc8455abf2f2f7d8c89dbce4', '0a6de4c65dc6fb58c6d73594f1426803dfe8db589d7a8c7445cbc79bbe682079', 168, true]
] as const

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const pinnedRead = async (path: string, expectedHash?: string) => {
  const bytes = new Uint8Array(await Bun.file(resolve(PROJECT_ROOT, path)).arrayBuffer())
  if (expectedHash && hash(bytes) !== expectedHash) throw new AppValidationError(`Source hash mismatch: ${path}`)
  return bytes
}
const dimensions = async (bytes: Uint8Array) => {
  const image = new Bun.Image(bytes)
  const metadata = await image.metadata()
  if (!(await image.png().bytes()).length) throw new AppValidationError('Empty decoded PNG')
  return { width: metadata.width, height: metadata.height }
}
const output = async (path: string, text: string, write: boolean) => {
  if (write) await Bun.write(resolve(PROJECT_ROOT, path), text)
  else if (utf8(await pinnedRead(path)) !== text) throw new AppValidationError(`Prepared artifact differs from deterministic source conversion: ${path}`)
}
const original = async (path: string, url: string, revision: string, selector?: string) => ({
  path, sha256: hash(await pinnedRead(path)), url, revision, ...(selector ? { selector } : {})
})

/** Local preparation only: no network, OCR engines, provider imports, dispatch or result generation. */
export const prepareCodeAndTableBundles = async (write = false) => {
  const codeCases = []
  for (const [id, language, font, sourceName, project, imageHash, sourceHash] of codePins) {
    const index = sourceName.split('.')[0]
    const inputName = `${font}_${index}.png`
    const input = `${codeRoot}/images/${inputName}`
    const source = `${codeRoot}/source/${sourceName}`
    const reference = `${codeRoot}/references/${id}.txt`
    const inputBytes = await pinnedRead(input, imageHash)
    const text = serializeCodeReference(utf8(await pinnedRead(source, sourceHash)))
    await output(reference, text, write)
    assertCodeReferenceMatchesSource(utf8(await pinnedRead(source)), utf8(await pinnedRead(reference)))
    codeCases.push({ id, category: 'technical-code', language: 'en', programmingLanguage: language,
      input, reference, originalReferences: [await original(source, codeArchive, 'Zenodo 3743394, revision 4', `replication/dataset/screenshots/text/${language}/ground-truth/${sourceName}`)],
      sourceURL: codeArchive, sourceRevision: 'Zenodo 3743394, published archive MD5 48c44b34e47ee02b0fec281f86393e48',
      sourceImageSelector: `replication/dataset/screenshots/images/${language}/png/${inputName}`,
      inputSha256: imageHash, referenceSha256: hash(text), ...await dimensions(inputBytes), pageCount: 1,
      chars: text.length, words: text.trim().split(/\s+/).length, format: 'png', scope: 'region-crop', synthetic: true,
      sourceFamily: 'MSR-2020-rendered-code-screenshots', project,
      rights: { annotationLicense: 'CC-BY-4.0', imageLicense: 'upstream-code-license-review-pending', redistributable: false,
        notice: 'Local research preparation only. Package license does not resolve each original project license.', evidence: `${codeRoot}/source/zenodo-record-3743394.json` },
      attribution: 'Abdulkarim Malkadi, Mohammad Alahmadi and Sonia Haiduc (MSR 2020 replication package); original project named separately.',
      serializationPolicy: 'All visible source fragment characters and source indentation preserved; LF line endings and exactly one final LF. Editor chrome/caret excluded. No inferred missing braces. Strict punctuation recognition and indentation require separate later scores.',
      review: { status: 'source-image-reviewed', method: 'Manual comparison of every visible code line with original package source snippet; full PNG decode and pinned byte hashes.',
        boundaries: ['15.cs', '26.cs', '32.java'].includes(sourceName) ? 'Intentional visible fragment; no completion of omitted enclosing code.' : 'Exact visible snippet as supplied.',
        modelExecution: 'not-run', sourceErrorsFound: [] } })
  }
  const codeBundle = { schemaVersion: 1, kind: 'ocr-canonical-input-bundle', category: 'technical-code', language: 'en', status: 'prepared-not-run', caseCount: 5, cases: codeCases }
  await output(`${codeRoot}/bundle.json`, json(codeBundle), write)

  await pinnedRead(`${tableRoot}/source/samples.zip`, '0885b558e9eb7ef2bc1cc8dc6256a8bcf5387e8d8be5180794cf476b55fffa2f')
  const tableCases = []
  for (const [id, filename, sourceName, sourceHash, imageHash, expectedCells, synthetic] of tablePins) {
    const source = `${tableRoot}/source/${sourceName}`
    const records = utf8(await pinnedRead(source, sourceHash)).trim().split('\n').map(line => JSON.parse(line) as TableSourceRecord)
    const matching = records.filter(record => record.filename === filename)
    if (matching.length !== 1) throw new AppValidationError(`Expected one exact table filename: ${filename}`)
    const record = matching[0]!
    const canonical = canonicalizeTable(record)
    if (canonical.cells.length !== expectedCells) throw new AppValidationError(`Unexpected table cell count: ${filename}`)
    const reference = `${tableRoot}/references/${id}.txt`
    const structuredReference = `${tableRoot}/references/${id}.json`
    const text = serializeTableReference(canonical)
    await output(reference, text, write)
    await output(structuredReference, json(canonical), write)
    assertTableReferenceMatchesSource(record, await Bun.file(resolve(PROJECT_ROOT, structuredReference)).json(), utf8(await pinnedRead(reference)))
    const input = `${tableRoot}/images/${filename}`
    const inputBytes = await pinnedRead(input, imageHash)
    const subset = id.endsWith('financial') ? 'fintabnet' : 'marketing'
    const archiveSelector = `samples/${subset}/images/${id.endsWith('financial') ? 'train' : 'val'}/${filename}`
    const sourceURL = synthetic ? synthArchive : `${pubBase}/examples/${filename}`
    const annotationURL = synthetic ? synthArchive : `${pubBase}/examples/PubTabNet_Examples.jsonl`
    const selector = `${synthetic ? `samples/${subset}/synthetic_data.jsonl; ` : ''}filename == ${filename}`
    const article = filename.split('_')[0]!
    tableCases.push({ id, category: 'numeric-tables', language: 'en', input, reference, structuredReference,
      originalReferences: [await original(source, annotationURL, synthetic ? synthRevision : pubRevision, selector)],
      sourceURL, sourceRevision: synthetic ? `samples.zip SHA-256 0885b558e9eb7ef2bc1cc8dc6256a8bcf5387e8d8be5180794cf476b55fffa2f; documentation ${synthRevision}` : pubRevision,
      sourceImageSelector: synthetic ? archiveSelector : filename,
      inputSha256: imageHash, referenceSha256: hash(text), structuredReferenceSha256: hash(json(canonical)), ...await dimensions(inputBytes), pageCount: 1,
      chars: text.length, words: text.trim().split(/\s+/).length, format: 'png', scope: 'region-crop', synthetic,
      sourceFamily: synthetic ? 'SynthTabNet' : 'PubTabNet',
      cellCount: canonical.cells.length, emptyCellCount: canonical.cells.filter(cell => !cell.text).length,
      mergedCellCount: canonical.cells.filter(cell => cell.rowSpan > 1 || cell.columnSpan > 1).length,
      rights: { annotationLicense: 'CDLA-Permissive-1.0', imageLicense: synthetic ? 'CDLA-Permissive-1.0' : 'CC-BY-2.0', redistributable: true,
        notice: synthetic ? 'IBM-generated sample dataset; retain CDLA notice and source attribution.' : 'Article-specific PMC copyright/license block verified; retain article and PubTabNet attribution.',
        evidence: synthetic ? `${tableRoot}/source/synthtabnet-LICENSE.md` : `${tableRoot}/source/${article}-article.html`,
        source: synthetic ? `https://github.com/IBM/SynthTabNet/blob/${synthRevision}/LICENSE.md` : `https://pmc.ncbi.nlm.nih.gov/articles/${article}/` },
      attribution: synthetic ? 'IBM Research, SynthTabNet sample release.' : `IBM Research, PubTabNet example release; original article ${article}, BioMed Central and credited authors (CC BY 2.0).`,
      serializationPolicy: 'Structured reference preserves original cell tokens, bounding boxes, blanks, row/column anchors and spans. Plain text is a derived TSV reading view in row-major order, each anchor text once; span continuations remain empty. Formatting tags removed, their text retained; signs/decimals/percentages remain exact. Grid tabs are serialization, not printed characters. Later evaluate recognition, numeric fidelity and structure separately; real/synthetic cohorts remain separate.',
      review: { status: 'source-image-reviewed', method: 'Manual image/cell-text comparison, exact filename selection, structure/cell count and span consistency; complete PNG decode and pinned byte hashes.',
        sourceErrorsFound: [], representationNotes: id.endsWith('marketing') ? ['Markup-only whitespace in zero-area source cell 1 is preserved in rawTokens and emits no visible text.'] : [], modelExecution: 'not-run' } })
  }
  const tableBundle = { schemaVersion: 1, kind: 'ocr-canonical-input-bundle', category: 'numeric-tables', language: 'en', status: 'prepared-not-run', caseCount: 5, cases: tableCases }
  await output(`${tableRoot}/bundle.json`, json(tableBundle), write)
  return { modelExecution: 'not-run', categories: [codeBundle, tableBundle].map(bundle => ({ category: bundle.category, cases: bundle.cases.map(item => ({ id: item.id, chars: item.chars, width: item.width, height: item.height })) })) }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.length !== 1 || !['--prepare', '--validate'].includes(args[0]!)) throw new AppUsageError('Usage: bun src/tools/ocr-preparation/prepare-code-tables.ts --prepare|--validate (local files only; never runs OCR)')
  writeCommandPayload((json(await prepareCodeAndTableBundles(args[0] === '--prepare'))) + '\n')
}
