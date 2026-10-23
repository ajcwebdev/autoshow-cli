import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { PROJECT_ROOT } from '~/utils/project-root'
import sourceCatalog from '../../../docs/benchmarks/ocr/source-catalog.json'

export const DEFAULT_PREPARED_OCR_INDEX = 'docs/benchmarks/ocr/prepared-inputs-plan.json'
export const PREPARED_OCR_CATEGORY_COUNTS: Readonly<Record<string, number>> = {
  'technical-code': 5, 'historical-print': 5, advertisements: 5,
  'numeric-tables': 5, handwriting: 5, newspapers: 5
}
const oldReferences = sourceCatalog.existingReferenceIDs
  .map(id => `docs/benchmarks/ocr/${id}/consensus-extraction.txt`)
const sha256 = (bytes: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Expected object: ${label}`)
  return value as Record<string, unknown>
}
const nonempty = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Expected nonempty string: ${label}`)
  return value
}
const list = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`Expected array: ${label}`)
  return value
}
const positive = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`Expected positive integer: ${label}`)
  return value
}
const digest = (value: unknown, label: string): string => {
  const text = nonempty(value, label)
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`Expected SHA-256: ${label}`)
  return text
}
const text = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
export const normalizePreparedOcrDuplicateText = (source: string): string => source
  .replace(/^--- Page \d+ ---\s*$/gm, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export interface PreparedOcrValidationOptions {
  projectRoot?: string
  indexPath?: string
  index?: unknown
  /** Only fixture tests should override production category/count expectations. */
  expectedCategoryCounts?: Readonly<Record<string, number>>
  /** Defaults to nine legacy references plus five canonical clean-typography references. */
  existingReferences?: readonly string[]
  /** Defaults to five clean-typography images and the locally retained original easy image. */
  existingImages?: readonly string[]
}

/** Read-only admission. Never imports providers, runs OCR, downloads, writes or authorizes execution. */
export const validatePreparedOcrInputs = async (options: PreparedOcrValidationOptions = {}) => {
  const projectRoot = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const readCache = new Map<string, Uint8Array>()
  const read = async (path: string) => {
    if (isAbsolute(path) || /[:\\\0]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Expected repository-relative artifact path: ${path}`)
    const cached = readCache.get(path)
    if (cached) return cached
    let actual: string
    try { actual = await realpath(resolve(projectRoot, path)) } catch { throw new Error(`Missing local artifact: ${path}`) }
    const rel = relative(projectRoot, actual)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Artifact escapes project root: ${path}`)
    const bytes = new Uint8Array(await Bun.file(actual).arrayBuffer())
    readCache.set(path, bytes)
    return bytes
  }
  const readJson = async (path: string) => JSON.parse(text(await read(path))) as unknown
  const index = record(options.index ?? await readJson(options.indexPath ?? DEFAULT_PREPARED_OCR_INDEX), 'prepared index')
  if (index['schemaVersion'] !== 1 || index['status'] !== 'prepared-not-run') throw new Error('Index must be schemaVersion 1 and prepared-not-run')
  if (index['executionAuthorized'] !== false) throw new Error('Prepared index must explicitly keep executionAuthorized false')
  const expectedCounts = options.expectedCategoryCounts ?? PREPARED_OCR_CATEGORY_COUNTS
  const expectedTotal = Object.values(expectedCounts).reduce((sum, count) => sum + positive(count, 'expected category count'), 0)
  if (index['newReadyCount'] !== expectedTotal) throw new Error(`Index newReadyCount must equal ${expectedTotal}`)
  const normalized = new Map<string, string>()
  const imageBytes = new Map<string, string>()
  const decodedImages = new Map<string, string>()
  const rememberText = (value: string, label: string) => {
    const normalizedText = normalizePreparedOcrDuplicateText(value)
    if (!normalizedText) throw new Error(`Empty lexical reference: ${label}`)
    const prior = normalized.get(normalizedText)
    if (prior) throw new Error(`Duplicate normalized reference: ${label}; already ${prior}`)
    normalized.set(normalizedText, label)
  }
  const decode = async (bytes: Uint8Array, label: string) => {
    try {
      const image = new Bun.Image(bytes)
      const metadata = await image.metadata()
      const decoded = await image.png().bytes()
      if (!decoded.length) throw new Error('empty decoded PNG')
      return { width: metadata.width, height: metadata.height, fingerprint: sha256(decoded) }
    } catch { throw new Error(`Input image cannot fully decode: ${label}`) }
  }
  const rememberImage = async (path: string, label: string) => {
    const bytes = await read(path)
    const encoded = sha256(bytes)
    const image = await decode(bytes, label)
    const prior = imageBytes.get(encoded) ?? decodedImages.get(image.fingerprint)
    if (prior) throw new Error(`Duplicate image pixels/bytes: ${label}; already ${prior}`)
    imageBytes.set(encoded, label); decodedImages.set(image.fingerprint, label)
    return { ...image, sha256: encoded }
  }
  let cleanCases: Array<Record<string, unknown>> = []
  if (options.existingReferences === undefined || options.existingImages === undefined) {
    const bundle = record(await readJson('input/examples/document/ocr-clean-typography/bundle.json'), 'existing clean typography bundle')
    cleanCases = list(bundle['cases'], 'existing clean cases').map(value => record(value, 'existing clean case'))
  }
  const baselineReferences = options.existingReferences ?? [...oldReferences, ...cleanCases.map(item => nonempty(item['reference'], 'baseline reference'))]
  const baselineImages = options.existingImages ?? [...cleanCases.map(item => nonempty(item['input'], 'baseline input')), 'input/examples/document/ocr-clean-typography/source/existing-01-test-picture.jpg']
  for (const path of baselineReferences) rememberText(text(await read(path)), `existing:${path}`)
  for (const path of baselineImages) await rememberImage(path, `existing:${path}`)

  const seenCategories = new Set<string>()
  const allIds = new Set<string>()
  const ready = new Map<string, Record<string, unknown>>()
  const blocked = new Map<string, Record<string, unknown>>()
  const categoryCounts: Record<string, number> = {}
  for (const item of list(index['bundles'], 'bundle descriptors')) {
    const descriptor = record(item, 'bundle descriptor')
    const category = nonempty(descriptor['category'], 'descriptor category')
    if (!(category in expectedCounts) || seenCategories.has(category)) throw new Error(`Unsupported or duplicate category: ${category}`)
    seenCategories.add(category)
    const bundlePath = nonempty(descriptor['path'], 'bundle path')
    const bundleBytes = await read(bundlePath)
    if (descriptor['sha256'] !== undefined && sha256(bundleBytes) !== digest(descriptor['sha256'], 'bundle hash')) throw new Error(`Bundle hash mismatch: ${category}`)
    const bundle = record(JSON.parse(text(bundleBytes)) as unknown, 'category bundle')
    if (bundle['schemaVersion'] !== 1 || bundle['category'] !== category || bundle['language'] !== 'en' || bundle['status'] !== 'prepared-not-run') throw new Error(`Invalid category bundle metadata: ${category}`)
    const cases = list(bundle['cases'], `${category} cases`)
    if (bundle['caseCount'] !== undefined && bundle['caseCount'] !== cases.length) throw new Error(`Bundle caseCount mismatch: ${category}`)
    categoryCounts[category] = 0
    for (const value of cases) {
      const entry = record(value, 'prepared case')
      const id = nonempty(entry['id'], 'case ID')
      if (allIds.has(id)) throw new Error(`Duplicate case ID: ${id}`)
      allIds.add(id)
      if (entry['category'] !== category || entry['language'] !== 'en') throw new Error(`Case category/language must match English bundle: ${id}`)
      const status = entry['status'] ?? bundle['status']
      const isReady = status === 'prepared-not-run'
      if (!isReady && (typeof status !== 'string' || !status.startsWith('blocked-'))) throw new Error(`Invalid case preparation status: ${id}`)
      if (entry['pageCount'] !== 1) throw new Error(`Prepared case must contain exactly one page: ${id}`)
      const input = nonempty(entry['input'], 'case input')
      const bytes = await read(input)
      if (sha256(bytes) !== digest(entry['inputSha256'], `${id} input hash`)) throw new Error(`Input hash mismatch: ${id}`)
      const image = isReady ? await rememberImage(input, id) : await decode(bytes, id)
      if (image.width !== positive(entry['width'], 'case width') || image.height !== positive(entry['height'], 'case height')) throw new Error(`Image dimensions mismatch: ${id}`)
      const originals = list(entry['originalReferences'], `${id} originalReferences`)
      if (!originals.length) throw new Error(`Original reference provenance missing: ${id}`)
      for (const originalValue of originals) {
        const original = record(originalValue, 'original reference')
        const path = nonempty(original['path'], 'original reference path')
        const url = new URL(nonempty(original['url'], 'original reference URL'))
        if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`Invalid original reference URL: ${id}`)
        if (sha256(await read(path)) !== digest(original['sha256'], 'original reference hash')) throw new Error(`Original reference hash mismatch: ${id}`)
      }
      if (!isReady) { blocked.set(id, entry); continue }
      const reference = nonempty(entry['reference'], 'canonical reference path')
      const referenceBytes = await read(reference)
      if (sha256(referenceBytes) !== digest(entry['referenceSha256'], 'canonical reference hash')) throw new Error(`Canonical reference hash mismatch: ${id}`)
      const referenceText = text(referenceBytes)
      rememberText(referenceText, id)
      if (entry['chars'] !== undefined && entry['chars'] !== referenceText.length) throw new Error(`Reference character count mismatch: ${id}`)
      if (entry['structuredReference'] !== undefined) {
        const path = nonempty(entry['structuredReference'], 'structured reference path')
        const structured = await read(path)
        record(JSON.parse(text(structured)) as unknown, 'structured reference JSON')
        if (entry['structuredReferenceSha256'] !== undefined && sha256(structured) !== digest(entry['structuredReferenceSha256'], 'structured reference hash')) throw new Error(`Structured reference hash mismatch: ${id}`)
      }
      if (entry['normalizedReference'] !== undefined) nonempty(text(await read(nonempty(entry['normalizedReference'], 'normalized reference path'))), 'normalized reference text')
      ready.set(id, entry); categoryCounts[category] = (categoryCounts[category] ?? 0) + 1
    }
    if (categoryCounts[category] !== expectedCounts[category]) throw new Error(`Ready category count mismatch: ${category}`)
    if (bundle['readyCaseCount'] !== undefined && bundle['readyCaseCount'] !== categoryCounts[category]) throw new Error(`Bundle readyCaseCount mismatch: ${category}`)
  }
  if (seenCategories.size !== Object.keys(expectedCounts).length || ready.size !== expectedTotal) throw new Error('Missing category or incorrect ready total')
  const indexCases = list(index['cases'], 'flat index cases')
  if (indexCases.length !== ready.size) throw new Error('Flat index must contain every ready case exactly once')
  const flatIds = new Set<string>()
  for (const value of indexCases) {
    const item = record(value, 'flat index case')
    const id = nonempty(item['id'], 'flat case ID')
    const actual = ready.get(id)
    if (!actual || flatIds.has(id)) throw new Error(`Flat index has duplicate, blocked or unknown case: ${id}`)
    flatIds.add(id)
    for (const field of ['category', 'input', 'reference', 'inputSha256', 'referenceSha256']) if (!isDeepStrictEqual(item[field], actual[field])) throw new Error(`Flat index metadata mismatch (${field}): ${id}`)
    for (const field of Object.keys(item)) {
      const expected = field === 'status' ? actual[field] ?? 'prepared-not-run' : actual[field]
      if (!isDeepStrictEqual(item[field], expected)) throw new Error(`Flat index metadata mismatch (${field}): ${id}`)
    }
  }
  const blockedIds = new Set<string>()
  for (const value of list(index['blockedCandidates'], 'blocked candidates')) {
    const item = record(value, 'blocked candidate')
    const id = nonempty(item['id'], 'blocked candidate ID')
    if (blockedIds.has(id) || ready.has(id)) throw new Error(`Blocked candidate duplicated or counted as ready: ${id}`)
    blockedIds.add(id)
  }
  for (const id of blocked.keys()) if (!blockedIds.has(id)) throw new Error(`Blocked bundle candidate missing from index: ${id}`)
  for (const id of blockedIds) if (!blocked.has(id)) throw new Error(`Unknown blocked candidate in index: ${id}`)
  return { status: 'prepared-not-run', executionAuthorized: false, readyCount: ready.size, categoryCounts,
    caseIds: [...ready.keys()], blockedIds: [...blockedIds], baselineReferenceCount: baselineReferences.length,
    baselineImageCount: baselineImages.length, modelCalls: 0 }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--validate')) throw new Error('Usage: bun src/tools/ocr-preparation/validate-prepared-ocr-inputs.ts [--validate] (read-only; OCR execution is unavailable)')
  console.log(JSON.stringify(await validatePreparedOcrInputs(), null, 2))
}
