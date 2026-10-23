import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import * as v from 'valibot'
import { PROJECT_ROOT } from '~/utils/project-root'
import sourceCatalog from '../../docs/benchmarks/ocr/source-catalog.json'

export const DEFAULT_CLEAN_TYPOGRAPHY_BUNDLE = 'input/examples/document/ocr-clean-typography/bundle.json'
const sourceRoot = 'input/examples/document/ocr-clean-typography'
const odbRevision = 'aa1ee96d106dbe53d0ae59474d75c6e6d9b53fec'
const tessRevision = '232ff181c66516116ec0e84c4963f70de15050fd'
const odbBase = `https://huggingface.co/datasets/opendatalab/OmniDocBench/resolve/${odbRevision}`
const tessBase = `https://raw.githubusercontent.com/tesseract-ocr/test/${tessRevision}`
const odbHash = 'a45cd84b04ad8b793e775089640e6b681209abea33ead54c1828ddca35fae496'

export interface CleanTypographySourcePin {
  id: string
  kind: 'tesseract' | 'omnidocbench'
  imageName: string
  revision: string
  annotationSha256: string
  inputSha256: string
  width: number
  height: number
  sourceURL: string
  annotationURL: string
  originalImageSha256?: string
}

const slidePin = (id: string, imageName: string, inputSha256: string): CleanTypographySourcePin => ({
  id, kind: 'omnidocbench', imageName, revision: odbRevision,
  annotationSha256: odbHash, inputSha256, width: 2000, height: 1500,
  sourceURL: `${odbBase}/images/${encodeURIComponent(imageName)}`, annotationURL: `${odbBase}/OmniDocBench.json`
})

export const CLEAN_TYPOGRAPHY_SOURCE_PINS: readonly CleanTypographySourcePin[] = [
  {
    id: 'clean-typography-phototest', kind: 'tesseract', imageName: 'phototest.tif', revision: tessRevision,
    annotationSha256: '76ef157baeb6ab275b7d90f310477a8060d5822aea2b2e05d480f459b016a6ed',
    inputSha256: '6a6ea46b3db1fea659fbefb88fbd3a3cbeeee944e407a8c10072fb3ca527eaa7',
    originalImageSha256: 'd2241a1eb6d6cd2eb6544b8e228c2862c852b7467d16ed636caa32179b780692',
    width: 640, height: 480,
    sourceURL: `${tessBase}/testing/phototest.tif`, annotationURL: `${tessBase}/testing/phototest.gold.txt`
  },
  slidePin('clean-typography-suitcase', 'PPT_english-studies-s6-on-the-road-resource-3_page_005.png', '2ca511bc6e9a707b810bbbc894d9432f8ffe167a4ef7dd633915104e01172670'),
  slidePin('clean-typography-good-talk', 'PPT_BaharMartonosi_page_005.png', 'c872bf793a3c235d9f095ee999087456060718ed3b0606f1a4f2f67116df21b9'),
  slidePin('clean-typography-federal-assistance', 'PPT_LEP power point presentation-English-FINAL-10-31-07_page_006.png', '133153852e3b6d51235302c7d0fe9d0b9ea054d58cfb2d482dac2f7f01916b4e'),
  slidePin('clean-typography-language-teaching', 'PPT_Keuk Chan Narith_page_005.png', 'b8c2f9f11279a16a9769aa341d88e29b2abea62c2e135d1258db0138fc963ecb')
]

export const EXISTING_OCR_REFERENCE_PATHS = sourceCatalog.existingReferenceIDs
  .map(id => `docs/benchmarks/ocr/${id}/consensus-extraction.txt`)

const nonempty = v.pipe(v.string(), v.trim(), v.nonEmpty())
const sha256 = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const positiveInteger = v.pipe(v.number(), v.integer(), v.minValue(1))
const caseSchema = v.object({
  id: nonempty, input: nonempty, reference: nonempty, originalReference: nonempty,
  sourceRecord: v.nullable(nonempty), sourceImageName: nonempty,
  inputSha256: sha256, referenceSha256: sha256, annotationSha256: sha256,
  width: positiveInteger, height: positiveInteger, format: v.literal('png'), pageCount: v.literal(1),
  chars: positiveInteger, words: positiveInteger,
  sourceURL: v.pipe(v.string(), v.url()), sourceRevision: nonempty,
  annotationURL: v.pipe(v.string(), v.url()), annotationFile: nonempty,
  attribution: nonempty,
  rights: v.object({ license: nonempty, notice: nonempty, redistributable: v.boolean() }),
  originalImage: v.optional(v.object({ path: nonempty, sha256 }))
})
const bundleSchema = v.object({
  schemaVersion: v.literal(1), kind: v.literal('ocr-canonical-input-bundle'),
  category: v.literal('clean-typography'), language: v.literal('en'), caseCount: v.literal(5),
  cases: v.pipe(v.array(caseSchema), v.length(5))
})
const pageSchema = v.object({
  page_info: v.object({
    image_path: nonempty,
    page_attribute: v.object({ language: v.literal('english') })
  }),
  layout_dets: v.array(v.unknown())
})

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const selectPage = (annotations: unknown, imageName: string): unknown => {
  if (!Array.isArray(annotations)) throw new Error('OmniDocBench annotations must be a page array')
  const matches = annotations.filter((entry: unknown) =>
    object(entry) && object(entry['page_info']) && entry['page_info']['image_path'] === imageName)
  if (matches.length !== 1) throw new Error(`Expected exactly one OmniDocBench page for ${imageName}; found ${matches.length}`)
  return matches[0]
}

/** Serialize publisher text only. A repeated parent block remains repeated; merge_list is never traversed. */
export const serializeOmniDocBenchPage = (annotations: unknown, imageName: string): string => {
  const page = v.parse(pageSchema, selectPage(annotations, imageName))
  const blocks: Array<{ order: number, text: string }> = []
  const orders = new Set<number>()
  for (const value of page.layout_dets) {
    if (!object(value) || typeof value['ignore'] !== 'boolean') throw new Error('Every top-level block needs a boolean ignore flag')
    if (value['ignore'] || !['title', 'text_block'].includes(String(value['category_type']))) continue
    const order = value['order']
    const text = value['text']
    if (typeof order !== 'number' || !Number.isSafeInteger(order) || order < 1) throw new Error('Text block needs a positive reading order')
    if (orders.has(order)) throw new Error(`Duplicate text block order: ${order}`)
    if (typeof text !== 'string' || !text.trim()) throw new Error('Text block must have nonempty text')
    orders.add(order)
    blocks.push({ order, text })
  }
  if (!blocks.length) throw new Error('No nonignored title or text blocks')
  return blocks.sort((a, b) => a.order - b.order).map(block => block.text.replaceAll('\\t', '\t')
    .split('\n').map(line => line.replace(/[ \t]+$/, '')).join('\n').replace(/\n+$/, '')).join('\n\n') + '\n'
}

export const normalizeOcrDuplicateText = (text: string): string => text
  .replace(/^--- Page \d+ ---\s*$/gm, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const hash = (bytes: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const decodeText = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes)

export interface CleanTypographyValidationOptions {
  projectRoot?: string
  /** Supply independent, explicit fixture pins when unit testing; CLI always uses the production pins. */
  trustedSources?: readonly CleanTypographySourcePin[]
  existingReferences?: readonly string[]
  /** Only locally acquired source images can be compared; this validator never downloads originals. */
  existingImages?: readonly string[]
}

/** Read-only local admission. This checks source integrity and references, not OCR provider quality. */
export const validateCleanTypographyBundle = async (bundle: unknown, options: CleanTypographyValidationOptions = {}) => {
  const parsed = v.parse(bundleSchema, bundle)
  const projectRoot = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const boundedPath = async (path: string): Promise<string> => {
    if (isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error(`Expected a repository-relative path: ${path}`)
    }
    let actual: string
    try { actual = await realpath(resolve(projectRoot, path)) } catch { throw new Error(`Missing local artifact: ${path}`) }
    const rel = relative(projectRoot, actual)
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Artifact escapes project root: ${path}`)
    return actual
  }
  const cache = new Map<string, Uint8Array>()
  const read = async (path: string): Promise<Uint8Array> => {
    const cached = cache.get(path)
    if (cached) return cached
    const bytes = new Uint8Array(await Bun.file(await boundedPath(path)).arrayBuffer())
    cache.set(path, bytes)
    return bytes
  }
  const sources = options.trustedSources ?? CLEAN_TYPOGRAPHY_SOURCE_PINS
  const pins = new Map(sources.map(pin => [pin.id, pin]))
  if (sources.length !== 5 || pins.size !== 5) throw new Error('Exactly five distinct trusted source IDs are required')
  if (new Set(parsed.cases.map(entry => entry.id)).size !== 5) throw new Error('Duplicate case ID')
  const existingReferences = options.existingReferences ?? EXISTING_OCR_REFERENCE_PATHS
  const normalizedTexts = new Map<string, string>()
  for (const path of existingReferences) {
    const normalized = normalizeOcrDuplicateText(decodeText(await read(path)))
    if (!normalized) throw new Error(`Empty existing reference: ${path}`)
    normalizedTexts.set(normalized, path)
  }
  const imageHashes = new Map<string, string>()
  const decodedImageHashes = new Map<string, string>()
  const decodeImage = async (bytes: Uint8Array, label: string) => {
    try {
      const image = new Bun.Image(bytes)
      const metadata = await image.metadata()
      // metadata() only probes the header; encoding forces the complete image to decode.
      const decoded = await image.png().bytes()
      if (!decoded.length) throw new Error('empty decoded image')
      return { ...metadata, decodedHash: hash(decoded) }
    } catch { throw new Error(`Image cannot fully decode: ${label}`) }
  }
  const existingImages = options.existingImages ?? [`${sourceRoot}/source/existing-01-test-picture.jpg`]
  for (const path of existingImages) {
    const bytes = await read(path)
    imageHashes.set(hash(bytes), path)
    decodedImageHashes.set((await decodeImage(bytes, path)).decodedHash, path)
  }
  const annotationCache = new Map<string, unknown>()
  const cases = []
  for (const entry of parsed.cases) {
    const pin = pins.get(entry.id)
    if (!pin) throw new Error(`Unrecognized case ID: ${entry.id}`)
    if (entry.sourceImageName !== pin.imageName || entry.sourceRevision !== pin.revision || entry.sourceURL !== pin.sourceURL || entry.annotationURL !== pin.annotationURL) {
      throw new Error(`Source identity differs from trusted pin: ${entry.id}`)
    }
    if (entry.annotationSha256 !== pin.annotationSha256 || entry.inputSha256 !== pin.inputSha256) throw new Error(`Source hashes differ from trusted pin: ${entry.id}`)
    if (entry.width !== pin.width || entry.height !== pin.height) throw new Error(`Dimensions differ from trusted pin: ${entry.id}`)
    await boundedPath(entry.rights.notice)
    const input = await read(entry.input)
    const reference = await read(entry.reference)
    const annotations = await read(entry.annotationFile)
    if (hash(input) !== entry.inputSha256) throw new Error(`Input hash mismatch: ${entry.id}`)
    if (hash(reference) !== entry.referenceSha256) throw new Error(`Reference hash mismatch: ${entry.id}`)
    if (hash(annotations) !== pin.annotationSha256) throw new Error(`Pinned annotation hash mismatch: ${entry.id}`)
    const image = await decodeImage(input, entry.id)
    if (image.format !== 'png' || image.width !== entry.width || image.height !== entry.height) throw new Error(`Decoded PNG dimensions/format mismatch: ${entry.id}`)
    if (imageHashes.has(entry.inputSha256) || decodedImageHashes.has(image.decodedHash)) throw new Error(`Duplicate image: ${entry.id}`)
    imageHashes.set(entry.inputSha256, entry.id)
    decodedImageHashes.set(image.decodedHash, entry.id)
    let canonical: Uint8Array
    if (pin.kind === 'tesseract') {
      if (entry.sourceRecord !== null) throw new Error(`Tesseract gold does not use a page record: ${entry.id}`)
      canonical = await read(entry.originalReference)
      if (hash(canonical) !== pin.annotationSha256 || !Buffer.from(canonical).equals(Buffer.from(annotations))) throw new Error(`Tesseract original gold differs: ${entry.id}`)
      if (pin.originalImageSha256) {
        if (!entry.originalImage || entry.originalImage.sha256 !== pin.originalImageSha256 || hash(await read(entry.originalImage.path)) !== pin.originalImageSha256) {
          throw new Error(`Tesseract original image differs: ${entry.id}`)
        }
      }
    } else {
      if (entry.sourceRecord === null || entry.originalReference !== entry.sourceRecord) throw new Error(`Missing extracted page record: ${entry.id}`)
      if (!annotationCache.has(entry.annotationFile)) annotationCache.set(entry.annotationFile, JSON.parse(decodeText(annotations)) as unknown)
      const pages = annotationCache.get(entry.annotationFile)
      const selected = selectPage(pages, entry.sourceImageName)
      const extracted = JSON.parse(decodeText(await read(entry.sourceRecord))) as unknown
      if (!isDeepStrictEqual(extracted, selected)) throw new Error(`Extracted record does not match pinned annotation page: ${entry.id}`)
      canonical = new TextEncoder().encode(serializeOmniDocBenchPage(pages, entry.sourceImageName))
    }
    if (!Buffer.from(canonical).equals(Buffer.from(reference))) throw new Error(`Canonical reference does not reproduce from its source: ${entry.id}`)
    const text = decodeText(reference)
    if (!text.trim() || text.length !== entry.chars || text.trim().split(/\s+/).length !== entry.words) throw new Error(`Reference character/word counts mismatch: ${entry.id}`)
    const normalized = normalizeOcrDuplicateText(text)
    const duplicate = normalizedTexts.get(normalized)
    if (!normalized || duplicate) throw new Error(`Duplicate or empty normalized reference: ${entry.id}${duplicate ? ` matches ${duplicate}` : ''}`)
    normalizedTexts.set(normalized, entry.id)
    cases.push({ id: entry.id, input: entry.input, reference: entry.reference, width: image.width, height: image.height, chars: text.length, words: entry.words })
  }
  return { schemaVersion: 1, status: 'admitted', mode: 'local-read-only-no-cost', caseCount: cases.length,
    existingReferencesCompared: existingReferences.length, existingImagesCompared: existingImages.length,
    totalChars: cases.reduce((sum, entry) => sum + entry.chars, 0), totalWords: cases.reduce((sum, entry) => sum + entry.words, 0), cases }
}

export const validateCleanTypographyBundleFile = async (bundlePath = DEFAULT_CLEAN_TYPOGRAPHY_BUNDLE, options: CleanTypographyValidationOptions = {}) => {
  if (isAbsolute(bundlePath) || /[:\\\x00]/.test(bundlePath) || bundlePath.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Bundle path must be repository-relative')
  const projectRoot = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const path = await realpath(resolve(projectRoot, bundlePath))
  const rel = relative(projectRoot, path)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('Bundle path escapes project root')
  return validateCleanTypographyBundle(await Bun.file(path).json() as unknown, options)
}

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2)
    if (args.length === 1 && args[0] === '--help') {
      console.log(`Usage: bun src/tools/ocr-clean-typography-admission.ts [--bundle REPOSITORY_RELATIVE_PATH]\nDefaults to ${DEFAULT_CLEAN_TYPOGRAPHY_BUNDLE}. Validates local pinned image/reference pairs, full PNG decoding and duplicates. Read-only and no-cost: no downloads, writes or provider calls.`)
    } else {
      if (args.length !== 0 && (args.length !== 2 || args[0] !== '--bundle' || !args[1] || args[1].startsWith('--'))) throw new Error('Usage: ocr-clean-typography-admission.ts [--bundle REPOSITORY_RELATIVE_PATH]')
      console.log(JSON.stringify(await validateCleanTypographyBundleFile(args[1]), null, 2))
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
