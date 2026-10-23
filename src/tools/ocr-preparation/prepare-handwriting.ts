import { AppValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { isDeepStrictEqual } from 'node:util'
import { resolve } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'

export interface LocReviewedAsset {
  Asset: string
  AssetId: string
  AssetStatus: string
  DownloadUrl: string
  Transcription: string
  [key: string]: string
}
export interface WhiteboardRecord {
  id: string
  file_name: string
  category: string
  transcription: string
  description?: string
}

/** RFC 4180 fields, including embedded line endings and escaped double quotes. */
export const parseLocCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closed = false
  const pushRow = () => { row.push(field); if (row.some(cell => cell.length)) rows.push(row); row = []; field = ''; closed = false }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true }
      } else field += char
    } else if (char === '"') {
      if (field || closed) throw new AppValidationError('Unexpected quote in LOC CSV field')
      quoted = true
    } else if (char === ',') { row.push(field); field = ''; closed = false }
    else if (char === '\r' || char === '\n') { if (char === '\r' && text[i + 1] === '\n') i++; pushRow() }
    else { if (closed) throw new AppValidationError('Trailing characters after quoted LOC CSV field'); field += char }
  }
  if (quoted) throw new AppValidationError('Unclosed LOC CSV quoted field')
  if (field.length || row.length || closed) pushRow()
  return rows
}

export const selectReviewedLocAsset = (csv: string, asset: string, assetId: string): LocReviewedAsset => {
  const rows = parseLocCsv(csv.replace(/^\uFEFF/, ''))
  const header = rows.shift()
  if (!header || new Set(header).size !== header.length || !['Asset', 'AssetId', 'AssetStatus', 'DownloadUrl', 'Transcription'].every(key => header.includes(key))) throw new AppValidationError('Missing or duplicate LOC CSV columns')
  const assetColumn = header.indexOf('Asset')
  const matches = rows.filter(row => row[assetColumn] === asset)
  if (matches.length !== 1 || matches[0]!.length !== header.length) throw new AppValidationError('Expected exactly one complete LOC asset row')
  const record = Object.fromEntries(header.map((key, i) => [key, matches[0]![i]!])) as LocReviewedAsset
  if (record.AssetId !== assetId || record.AssetStatus !== 'completed' || !record.Transcription.trim() || !/^https?:\/\/tile\.loc\.gov\//.test(record.DownloadUrl)) throw new AppValidationError('LOC asset identity, review status or transcription is invalid')
  return record
}

const lineText = (text: string): string => text.replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n').replace(/\n*$/, '\n')

export const canonicalizeLocHandwriting = (record: LocReviewedAsset) => {
  if (!record.Transcription.trim() || record.AssetStatus !== 'completed') throw new AppValidationError('A completed LOC transcription is required')
  const original = record.Transcription
  const deleted = [...original.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]!)
  if (deleted.length && (record.Asset !== 'mss35634001-41' || JSON.stringify(deleted) !== JSON.stringify(['there', 'from']))) throw new AppValidationError('Unreviewed LOC editorial notation')
  const diplomatic = lineText(original.replace(/\[([^\]]+)\]/g, '$1'))
  const reading = lineText(original.replace(/\[([^\]]+)\]/g, '').replace(/ +(?= )/g, ''))
  return { text: diplomatic, readingText: reading, structure: { kind: 'reviewed-manuscript', asset: record.Asset,
    includesPrintedHeadings: record.Asset === 'mss35634001-41', deletedWordsRetained: deleted, originalEditorialNotation: deleted.map(word => `[${word}]`) } }
}

export const selectWhiteboardRecord = (jsonl: string, id: string): WhiteboardRecord => {
  const rows = jsonl.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as WhiteboardRecord)
  const matches = rows.filter(row => row.id === id)
  if (matches.length !== 1 || matches[0]!.file_name !== `${id}.webp` || typeof matches[0]!.transcription !== 'string' || !matches[0]!.transcription.trim()) throw new AppValidationError('Wrong or ambiguous Whiteboards image/transcription pair')
  return matches[0]!
}

/** Drawing characters are structure; labels originate only in the author's transcription. */
export const canonicalizeWhiteboard = (record: WhiteboardRecord) => {
  if (record.file_name !== `${record.id}.webp` || !record.transcription.trim()) throw new AppValidationError('Wrong Whiteboards pair')
  if (record.id === '01' && record.category === 'prose') return { text: lineText(record.transcription), structure: { kind: 'prose', literalArrowInHeading: true } }
  const lines = record.transcription.replace(/\r\n?/g, '\n').split('\n')
  if (record.id === '07' && record.category === 'table') {
    const headings = lines.filter(line => line.trim() && !line.includes('|') && !/^[-+ ]+$/.test(line)).map(line => line.trim())
    const cells = lines.filter(line => line.includes('|')).map(line => line.split('|').map(cell => cell.trim()))
    if (headings.length !== 2 || cells.length !== 4 || cells.some(row => row.length !== 2 || row.some(cell => !cell))) throw new AppValidationError('Whiteboard table requires two headings and a complete 4-by-2 grid')
    return { text: `${headings.join('\n\n')}\n\n${cells.map(row => row.join('\t')).join('\n')}\n`,
      structure: { kind: 'table', headings, rows: 4, columns: 2, cells, readingOrder: 'row-major; drawing separators excluded' } }
  }
  if (record.id === '08' && record.category === 'flowchart') {
    const plain = lines.map(line => line.trim()).filter(line => line && /[a-z]/i.test(line) && !line.includes('│'))
    const labels = [...record.transcription.matchAll(/│([^│\n]*)│/g)].map(match => match[1]!.trim())
    if (plain.length !== 4 || plain[3] !== 'Y             N' || labels.length !== 2 || labels.some(label => !label)) throw new AppValidationError('Whiteboard flowchart does not match its reviewed two-branch structure')
    const [title, heading, question] = plain
    return { text: `${title}\n\n${heading}\n\n${question}\n\nY\tN\n${labels.join('\t')}\n`,
      structure: { kind: 'flowchart', title, heading, nodes: [{ id: 'question', text: question, shape: 'unboxed' }, { id: 'yes', text: labels[0], shape: 'rectangle' }, { id: 'no', text: labels[1], shape: 'rectangle' }],
        edges: [{ from: 'question', to: 'yes', label: 'Y' }, { from: 'question', to: 'no', label: 'N' }], readingOrder: 'top to bottom, then left to right; box and arrow drawing characters excluded from lexical text' } }
  }
  throw new AppValidationError('Unreviewed Whiteboards record/category')
}

export const assertHandwritingReference = (actual: string, expected: string, actualStructure: unknown, expectedStructure: unknown): void => {
  if (actual !== expected) throw new AppValidationError('Handwriting lexical reference differs from its independent source')
  if (!isDeepStrictEqual(actualStructure, expectedStructure)) throw new AppValidationError('Handwriting structure, cell association or branch topology differs')
}

const ROOT = 'input/examples/document/ocr-handwriting'
const WB_REVISION = '4b31e86e15743ffea20204a8f6992b0173ecbdf9'
const wbUrl = (file: string) => `https://huggingface.co/datasets/danielrosehill/Whiteboards/resolve/${WB_REVISION}/${file}`
const hash = (bytes: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const read = async (path: string) => new Uint8Array(await Bun.file(resolve(PROJECT_ROOT, path)).arrayBuffer())
const writeJson = (path: string, value: unknown) => Bun.write(resolve(PROJECT_ROOT, path), `${JSON.stringify(value, null, 2)}\n`)
const pins: Readonly<Record<string, string>> = {
  'source/ordinary-lives-in-george-washingtons-papers-the-revolutionary-war_2023-07-18.csv': '66cc36f09c22427b9242b1d01e67a5660494148c88d7821dc3a74405b5b4316f',
  'source/patton-war-diaries_2023-04-26.csv': '5615eaacec19c3e6121acd251f4c3fb24e0329b1952ca0aff617d85051d9c27c',
  'source/whiteboards-metadata.jsonl': 'e2a594a20234fa53fc6b59bb0b77db8de31ca64dea92e7cdf6a7d749ce7983c4',
  'source/whiteboards-README.md': '7f590d2899ddf73a5e45f18208d483a70f9f4b46b51a38a522f27ef11c865712',
  'cases/handwriting-washington-receipt/original.jpg': '6b7484c2f3e945168fb88fefb9c63ad4450169ce07e48c12f8bd9934a6666a56',
  'cases/handwriting-patton-travel/original.jpg': '632a4498e4805d9a8554ecf944c22b8787bffec85557e8ed31a8b19defcfc0be',
  'cases/handwriting-marker-prose/original.webp': '0f6a3997bb7652926dfd3df55b315bf961007712090bdb8ce77f81205f202830',
  'cases/handwriting-marker-table/original.webp': '6ee7e72820d02d6a373d0671d898bfded1c13ba5ca30e42ec65b3fca0cd5c8d5',
  'cases/handwriting-marker-flowchart/original.webp': '4cdca8f6e8fdb238859364570b27ca93f79fcc2cb25aa21d5b59de4f95685c25'
}
export const assertHandwritingSourceBytes = (path: string, bytes: Uint8Array): void => {
  if (!pins[path] || hash(bytes) !== pins[path]) throw new AppValidationError(`Unreviewed handwriting source bytes: ${path}`)
}
const specs = [
  { id: 'handwriting-washington-receipt', asset: 'mgw500029-5', assetId: '367462', csv: 'ordinary-lives-in-george-washingtons-papers-the-revolutionary-war_2023-07-18.csv', dataset: '2020446971', date: '2023-07-18', imageUrl: 'https://tile.loc.gov/storage-services/master/mss/mgw/mgw5/117/0500/0553.jpg', crop: [0, 0, 1989, 950], mask: [1230, 603, 1460, 783] },
  { id: 'handwriting-patton-travel', asset: 'mss35634001-41', assetId: '341465', csv: 'patton-war-diaries_2023-04-26.csv', dataset: '2021386762', date: '2023-04-26', imageUrl: 'https://tile.loc.gov/image-services/iiif/service:mss:mss35634:001:01:041/full/pct:50/0/default.jpg', crop: [90, 50, 780, 1270] },
  { id: 'handwriting-marker-prose', whiteboardId: '01' },
  { id: 'handwriting-marker-table', whiteboardId: '07' },
  { id: 'handwriting-marker-flowchart', whiteboardId: '08' }
] as const

const pinnedSources = async () => {
  for (const path of Object.keys(pins)) assertHandwritingSourceBytes(path, await read(`${ROOT}/${path}`))
}
const derive = async (spec: typeof specs[number]) => {
  if ('asset' in spec) {
    const record = selectReviewedLocAsset(new TextDecoder().decode(await read(`${ROOT}/source/${spec.csv}`)), spec.asset, spec.assetId)
    return { record, source: canonicalizeLocHandwriting(record) }
  }
  const record = selectWhiteboardRecord(new TextDecoder().decode(await read(`${ROOT}/source/whiteboards-metadata.jsonl`)), spec.whiteboardId)
  return { record, source: canonicalizeWhiteboard(record) }
}
const deriveInputImage = async (spec: typeof specs[number]): Promise<Uint8Array> => {
  const original = `${ROOT}/cases/${spec.id}/original.${'asset' in spec ? 'jpg' : 'webp'}`
  if (!('crop' in spec)) return new Bun.Image(await read(original)).png().bytes()
  const [x, y, width, height] = spec.crop
  const args = ['magick', resolve(PROJECT_ROOT, original), '-crop', `${width}x${height}+${x}+${y}`, '+repage']
  if ('mask' in spec) { const [left, top, right, bottom] = spec.mask; args.push('-fill', 'white', '-stroke', 'none', '-draw', `rectangle ${left},${top} ${right},${bottom}`) }
  args.push('-strip', 'PNG32:-')
  const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' })
  const [output, stderr, code] = await Promise.all([new Response(proc.stdout).arrayBuffer(), new Response(proc.stderr).text(), proc.exited])
  if (code !== 0) throw new AppValidationError(stderr)
  return new Uint8Array(output)
}

/** Deterministic cropping/masking and transcription serialization from already acquired bytes. */
export const prepareHandwritingLocally = async () => {
  await pinnedSources()
  const cases: Record<string, unknown>[] = []
  for (const spec of specs) {
    const base = `${ROOT}/cases/${spec.id}`, loc = 'asset' in spec
    const originalImage = `${base}/original.${loc ? 'jpg' : 'webp'}`, input = `${base}/input.png`
    const reference = `${base}/reference.txt`, structuredReference = `${base}/reference-structure.json`
    const { record, source } = await derive(spec)
    await Bun.write(resolve(PROJECT_ROOT, input), await deriveInputImage(spec))
    await writeJson(`${base}/source-record.json`, record)
    await Bun.write(resolve(PROJECT_ROOT, `${base}/publisher-reference.txt`), 'Transcription' in record ? record.Transcription : record.transcription)
    await Bun.write(resolve(PROJECT_ROOT, reference), source.text)
    await writeJson(structuredReference, source.structure)
    const readingReference = 'readingText' in source ? `${base}/reading-reference.txt` : undefined
    if (readingReference && 'readingText' in source) await Bun.write(resolve(PROJECT_ROOT, readingReference), source.readingText)
    const imageBytes = await read(input), metadata = await new Bun.Image(imageBytes).metadata()
    const imageUrl = loc ? spec.imageUrl : wbUrl(`data/${spec.whiteboardId}.webp`)
    const referenceUrl = loc ? `https://tile.loc.gov/storage-services/master/gdc/gdcdatasets/${spec.dataset}/${spec.dataset}.zip` : wbUrl('data/metadata.jsonl')
    const sourcePath = loc ? `${ROOT}/source/${spec.csv}` : `${ROOT}/source/whiteboards-metadata.jsonl`
    const rightsPath = loc ? `${ROOT}/source/README_${spec.csv.replace(/\.csv$/, '.txt')}` : `${ROOT}/source/whiteboards-README.md`
    const revision = loc ? `LOC dataset ${spec.dataset}, ${spec.date}` : WB_REVISION
    const originalReferences = await Promise.all([
      { path: originalImage, url: imageUrl, revision, selector: loc ? spec.asset : spec.whiteboardId },
      { path: sourcePath, url: referenceUrl, revision, selector: loc ? `Asset=${spec.asset}; AssetId=${spec.assetId}; AssetStatus=completed; Transcription` : `id=${spec.whiteboardId}; transcription` },
      { path: rightsPath, url: loc ? referenceUrl : wbUrl('README.md'), revision }
    ].map(async original => ({ ...original, sha256: hash(await read(original.path)) })))
    cases.push({ id: spec.id, category: 'handwriting', language: 'en', status: 'prepared-not-run', input, reference, structuredReference,
      readingReference, originalReferences, inputSha256: hash(imageBytes), referenceSha256: hash(source.text), structuredReferenceSha256: hash(await read(structuredReference)),
      width: metadata.width, height: metadata.height, pageCount: 1, chars: source.text.length, scope: loc ? 'region-crop' : 'full-page', synthetic: false,
      sourceFamily: loc ? 'Library-of-Congress-By-the-People' : 'Whiteboards-single-author', sourceURL: imageUrl, sourceRevision: revision,
      sourceSelector: loc ? { kind: 'loc', csv: sourcePath, asset: spec.asset, assetId: spec.assetId } : { kind: 'whiteboards', id: spec.whiteboardId },
      rights: loc ? { transcription: 'Public domain contributions per the dated dataset README', image: 'Separate LOC collection rights advisory; kept local, no image redistribution assumed', redistributable: false, evidence: rightsPath, advisoryUrl: `https://www.loc.gov/item/${spec.asset.replace(/-\d+$/, '')}/` }
        : { image: 'CC-BY-4.0', transcription: 'CC-BY-4.0', redistributable: true, evidence: rightsPath },
      attribution: loc ? 'Library of Congress, Manuscript Division; By the People contributors (reviewed completed transcription)' : 'Daniel Rosehill, Whiteboards, CC BY 4.0',
      serializationPolicy: loc ? 'LF and final newline; historical spellings and line breaks retained. Publisher square brackets denote deleted words: diplomatic target retains those words without invented brackets, reading companion omits them. Printed Patton form headings included in publisher title case although the image prints capitals; use case-insensitive lexical scoring, not an exact glyph-case claim. No invented continuation. Washington publisher order places date before addressee.'
        : 'Use the human transcription field only. Preserve literal prose arrow; convert table/flowchart drawings into separate structure with exact label text. Table uses row-major TSV; flowchart uses top-to-bottom then left-to-right labels. No description text or drawing characters become lexical labels.',
      imageDerivation: 'crop' in spec ? { originalImage, operation: 'ImageMagick crop +repage; strip metadata; PNG32', crop: { x: spec.crop[0], y: spec.crop[1], width: spec.crop[2], height: spec.crop[3] }, ...('mask' in spec ? { masks: [{ x: spec.mask[0], y: spec.mask[1], rightInclusive: spec.mask[2], bottomInclusive: spec.mask[3], fill: 'white', reason: 'Later archival circular stamp in blank ruled space; no receipt wording covered' }] } : {}), reason: loc && spec.asset === 'mgw500029-5' ? 'Remove bottom archival identifier, mask later stamp; preserve complete receipt body' : 'Keep target leaf and all text; exclude adjacent right leaf and binding' }
        : { originalImage, operation: 'Lossless WebP decode to PNG, no resize/crop/retouch' },
      review: { status: 'source-image-reviewed', method: 'Manual word/number and layout review of original image against independently published human transcription', modelExecution: 'not-run', limitations: loc ? 'Publisher spelling/case conventions are retained; manuscript order and deleted-word structure declared separately' : 'Three examples share one author, board and marker; structure diversity does not add writer diversity' } })
  }
  await writeJson(`${ROOT}/bundle.json`, { schemaVersion: 1, category: 'handwriting', language: 'en', status: 'prepared-not-run', caseCount: 5, readyCaseCount: 5, executionAuthorized: false, cases })
  return { ...await validateHandwritingPreparation(), operation: 'local-regeneration', writes: specs.length * 5 + specs.filter(spec => 'asset' in spec).length + 1 }
}

export const validateHandwritingPreparation = async () => {
  await pinnedSources()
  const bundle = await Bun.file(resolve(PROJECT_ROOT, `${ROOT}/bundle.json`)).json()
  if (bundle.cases.length !== specs.length) throw new AppValidationError('Handwriting bundle must contain exactly five reviewed cases')
  for (const spec of specs) {
    const matches = bundle.cases.filter((entry: { id: string }) => entry.id === spec.id)
    if (matches.length !== 1) throw new AppValidationError(`Missing or duplicated handwriting case: ${spec.id}`)
    const entry = matches[0], { source } = await derive(spec)
    const expectedSelector = 'asset' in spec ? { kind: 'loc', csv: `${ROOT}/source/${spec.csv}`, asset: spec.asset, assetId: spec.assetId } : { kind: 'whiteboards', id: spec.whiteboardId }
    if (!isDeepStrictEqual(entry.sourceSelector, expectedSelector)) throw new AppValidationError(`Wrong handwriting source selector: ${spec.id}`)
    assertHandwritingReference(await Bun.file(resolve(PROJECT_ROOT, entry.reference)).text(), source.text, await Bun.file(resolve(PROJECT_ROOT, entry.structuredReference)).json(), source.structure)
    if ('readingText' in source && await Bun.file(resolve(PROJECT_ROOT, entry.readingReference)).text() !== source.readingText) throw new AppValidationError(`Wrong deleted-word reading companion: ${spec.id}`)
    const actual = await new Bun.Image(await read(entry.input)).png().bytes()
    const expected = await new Bun.Image(await deriveInputImage(spec)).png().bytes()
    if (hash(actual) !== hash(expected)) throw new AppValidationError(`Wrong prepared handwriting image/crop/mask pixels: ${spec.id}`)
  }
  return { category: 'handwriting', cases: bundle.cases.length, imagesFullyDecoded: specs.length, status: 'prepared-not-run', modelInvocations: 0, writes: 0 }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && !['--validate', '--prepare-local'].includes(args[0]!))) { writeCommandPayload(('Usage: bun src/tools/ocr-preparation/prepare-handwriting.ts [--validate|--prepare-local] (local preparation only; no model execution)') + '\n', 'stderr'); process.exitCode = 1 }
  else writeCommandPayload((JSON.stringify(await (args[0] === '--prepare-local' ? prepareHandwritingLocally() : validateHandwritingPreparation()))) + '\n')
}
