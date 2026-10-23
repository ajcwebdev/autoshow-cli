import { AppValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { inflateRawSync } from 'node:zlib'
import * as v from 'valibot'
import { PROJECT_ROOT } from '~/utils/project-root'

export const TEXT_OCR_ANNOTATION_SHA256 = '5bac8303c5999a3ddf630efde8ac9743b4461be6022b193a1075df90fbd2ce0c'
export const TEXT_OCR_ANNOTATION_URL = 'https://dl.fbaipublicfiles.com/textvqa/data/textocr/TextOCR_0.1_train.json'
export const TEXT_OCR_IMAGE_ARCHIVE_URL = 'https://dl.fbaipublicfiles.com/textvqa/images/train_val_images.zip'
export const TEXT_OCR_SOURCE_VERSION = 'v0.1; annotation S3 version nOSHBYLvXX4J7TUWv5Esml0IYeU3I3az'

export const ADVERTISEMENT_SOURCE_PINS = [
  { id: 'advertisement-three-masons', imageId: '2b0f2beecc86ce4b', width: 736, height: 1024, words: 23,
    inputSha256: '171f62787fdef84699faa33c8e130d0a4c686ae941b21cc9c6430c926d2a68cc' },
  { id: 'advertisement-newtown-cruise', imageId: '5dfd863134653dba', width: 1024, height: 717, words: 62,
    inputSha256: 'ae1ef2bb042e78485472eacdfe832750a9decea85adccc5256f7ca4f3e38be17' },
  { id: 'advertisement-legend-1900', imageId: 'cb0ec1fffcd2916f', width: 751, height: 1024, words: 34,
    inputSha256: '5b036ec742f71d9b1dc6de39c9c2bc3d78d4529eeaecd47f7440e9bfc0a74f70' },
  { id: 'advertisement-metrolink', imageId: 'a6335527c9db9349', width: 1024, height: 575, words: 57,
    inputSha256: '9a83f1d662c7c689200f3fe0af818390ca35f914cdd04c5c9905a8d90b66e862' },
  { id: 'advertisement-nyc-skate', imageId: '6ddc9d4db49a3197', width: 1024, height: 1024, words: 65,
    inputSha256: 'ac33cf3faed79e0ba2afc38d7530fe985e815429dcfd4288f6c29bfd03635392' }
] as const

const finite = v.pipe(v.number(), v.finite())
const positiveInteger = v.pipe(finite, v.integer(), v.minValue(1))
const nonempty = v.pipe(v.string(), v.nonEmpty())
const imageSchema = v.object({ id: nonempty, width: positiveInteger, height: positiveInteger,
  set: v.literal('train'), file_name: nonempty })
const annotationSchema = v.object({ id: nonempty, image_id: nonempty, utf8_string: nonempty,
  bbox: v.pipe(v.array(finite), v.length(4)), points: v.array(finite), area: v.pipe(finite, v.minValue(0)) })

export interface TextOcrRecord {
  image: v.InferOutput<typeof imageSchema>
  annotationIds: string[]
  annotations: v.InferOutput<typeof annotationSchema>[]
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Select only the exact source page. No OCR, inferred words, or inferred reading order. */
export const selectTextOcrRecord = (source: unknown, imageId: string): TextOcrRecord => {
  if (!/^[0-9a-f]{16}$/.test(imageId)) throw new AppValidationError('Expected an exact Open Images ID')
  if (!isObject(source) || !isObject(source['imgs']) || !isObject(source['anns']) || !isObject(source['imgToAnns'])) {
    throw new AppValidationError('TextOCR source needs imgs, anns and imgToAnns maps')
  }
  const image = v.parse(imageSchema, source['imgs'][imageId])
  if (image.id !== imageId || image.file_name !== `train/${imageId}.jpg`) throw new AppValidationError('Image selector mismatch')
  const annotationIds = v.parse(v.pipe(v.array(nonempty), v.minLength(1)), source['imgToAnns'][imageId])
  if (new Set(annotationIds).size !== annotationIds.length) throw new AppValidationError('Duplicate source annotation ID')
  const sourceAnnotations = source['anns']
  const annotations = annotationIds.map(id => {
    const annotation = v.parse(annotationSchema, sourceAnnotations[id])
    if (annotation.id !== id || annotation.image_id !== imageId || !id.startsWith(`${imageId}_`)) {
      throw new AppValidationError('Word/image pair mismatch')
    }
    if (annotation.utf8_string.trim() !== annotation.utf8_string || /[\r\n]/.test(annotation.utf8_string)) {
      throw new AppValidationError('Word annotation contains boundary whitespace')
    }
    if (annotation.points.length < 6 || annotation.points.length % 2 !== 0) throw new AppValidationError('Invalid word polygon')
    for (let i = 0; i < annotation.points.length; i += 2) {
      const x = annotation.points[i]!
      const y = annotation.points[i + 1]!
      if (x < 0 || y < 0 || x > image.width || y > image.height) throw new AppValidationError('Word polygon escapes image')
    }
    const [x, y, width, height] = annotation.bbox as [number, number, number, number]
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > image.width + 0.02 || y + height > image.height + 0.02) {
      throw new AppValidationError('Word bounding box escapes image')
    }
    const polygonXs = annotation.points.filter((_, i) => i % 2 === 0)
    const polygonYs = annotation.points.filter((_, i) => i % 2 === 1)
    if (Math.abs(Math.min(...polygonXs) - x) > 0.02 || Math.abs(Math.max(...polygonXs) - x - width) > 0.02 ||
        Math.abs(Math.min(...polygonYs) - y) > 0.02 || Math.abs(Math.max(...polygonYs) - y - height) > 0.02) {
      throw new AppValidationError('Word polygon and bounding box disagree')
    }
    return annotation
  })
  return { image, annotationIds, annotations }
}

/** Require an explicitly reviewed complete permutation; JSON map order is never a text reference. */
export const serializeTextOcrReference = (record: TextOcrRecord, reviewedLines: readonly (readonly string[])[]): string => {
  const eligible = new Map(record.annotations.filter(annotation => annotation.utf8_string !== '.')
    .map(annotation => [annotation.id, annotation.utf8_string]))
  if (!eligible.size || !reviewedLines.length) throw new AppValidationError('No reviewed nonignored word order')
  const seen = new Set<string>()
  const lines = reviewedLines.map(line => {
    if (!line.length) throw new AppValidationError('Empty reading-order line')
    return line.map(id => {
      const text = eligible.get(id)
      if (text === undefined) throw new AppValidationError('Reading order includes unknown or ignored word')
      if (seen.has(id)) throw new AppValidationError('Reading order repeats word')
      seen.add(id)
      return text
    }).join(' ')
  })
  if (seen.size !== eligible.size) throw new AppValidationError('Reading order omits annotated word')
  return `${lines.join('\n')}\n`
}

export const makeTextOcrStructuredReference = (record: TextOcrRecord, reviewedLines: readonly (readonly string[])[]) => {
  serializeTextOcrReference(record, reviewedLines)
  return {
    schemaVersion: 1, sourceFamily: 'TextOCR-v0.1', imageId: record.image.id,
    width: record.image.width, height: record.image.height, canonicalUnit: 'word-region',
    canonicalReadingOrder: null,
    regions: record.annotations.map(annotation => ({ id: annotation.id, text: annotation.utf8_string,
      polygon: annotation.points, bbox: annotation.bbox, ignore: annotation.utf8_string === '.' })),
    reviewedReadingOrder: { provenance: 'Agent visual review of exact input image, 2026-10-22',
      kind: 'derived-convention', notDatasetGoldOrder: true, lines: reviewedLines },
    evaluationScope: 'Dataset annotated word polygons; full original image is the model input. Incidental unannotated marks are outside canonical region evaluation.'
  }
}

const ROOT = 'input/examples/document/ocr-advertisements'
const PHOTO_METADATA_URL = 'https://storage.googleapis.com/openimages/2018_04/train/train-images-boxable-with-rotation.csv'
const PHOTO_METADATA_SHA256 = 'a0c1c9216dee6b3cd4a26b893f629636244a2f30d3e18bbe1460445d78063827'
const range = (first: number, last: number): number[] => Array.from({ length: last - first + 1 }, (_, index) => first + index)

/** Reviewed against each exact image. These are a derived convention, not TextOCR publisher order. */
const reviewedWordNumbers: Readonly<Record<string, readonly (readonly number[])[]>> = {
  '2b0f2beecc86ce4b': [[1, 2, 3], [4, 5, 23], [6], [7], [8], range(9, 14), [15], [16, 17], [18, 19], [20, 21, 22]],
  '5dfd863134653dba': [[1, 2, 3], [4], range(5, 11), [12, 13, 14], range(33, 36), [37], range(38, 40), range(41, 44), range(45, 47), range(48, 50), range(51, 53), range(54, 57), range(58, 60), [61, 62], range(15, 19), range(26, 32), range(20, 25)],
  'cb0ec1fffcd2916f': [[5, 1, 2, 3, 4], range(6, 10), [11, 12], [13, 14, 15], [16, 17], [18], [19], [20], [21], range(22, 31), [32, 33, 34]],
  'a6335527c9db9349': [[1, 2, 3, 4], range(6, 9), range(10, 14), range(15, 20), range(21, 25), range(26, 32), range(33, 37), range(38, 42), range(45, 51), range(52, 57), [44], [43], [5]],
  '6ddc9d4db49a3197': [[1, 2, 3], [4], [5], [6], range(7, 13), range(14, 22), range(23, 28), range(29, 35), range(36, 40), range(41, 47), [48], range(49, 59), [60, 61, 62], [63, 64], [65]]
}

export const assertAdvertisementReference = (
  record: TextOcrRecord,
  actualText: string,
  actualStructure: unknown,
  reviewedLines: readonly (readonly string[])[]
): void => {
  if (actualText !== serializeTextOcrReference(record, reviewedLines)) throw new AppValidationError('Advertisement text differs from canonical source and reviewed order')
  if (!isDeepStrictEqual(actualStructure, makeTextOcrStructuredReference(record, reviewedLines))) {
    throw new AppValidationError('Advertisement region mapping or reviewed order differs from its independent source')
  }
}

const hash = (bytes: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const decode = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
const sha256 = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const originalReferenceSchema = v.object({ path: nonempty, sha256, url: nonempty, revision: nonempty, selector: nonempty })
const preparedCaseSchema = v.object({
  id: nonempty, category: v.literal('advertisements'), language: v.literal('en'), status: v.literal('prepared-not-run'),
  input: nonempty, reference: nonempty, structuredReference: nonempty, sourceRecord: nonempty,
  inputSha256: sha256, referenceSha256: sha256, structuredReferenceSha256: sha256, sourceRecordSha256: sha256,
  originalReferences: v.pipe(v.array(originalReferenceSchema), v.length(3)),
  width: positiveInteger, height: positiveInteger, pageCount: v.literal(1), words: positiveInteger, chars: positiveInteger,
  ignoredWordRegions: v.literal(0), scope: v.literal('full-page'), evaluationScope: v.literal('dataset-annotated-word-regions'),
  synthetic: v.literal(false), sourceFamily: v.literal('TextOCR-v0.1 / Open Images'),
  sourceURL: v.literal(TEXT_OCR_IMAGE_ARCHIVE_URL), sourceRevision: v.literal('S3 version ncyQEgyLZWkblorpGNAyzWbH_ssT6yG0'),
  sourceImageName: nonempty, annotationURL: v.literal(TEXT_OCR_ANNOTATION_URL), annotationRevision: v.literal(TEXT_OCR_SOURCE_VERSION),
  execution: v.object({ status: v.literal('not-run'), modelInvocations: v.literal(0), providerSpendUSD: v.literal(0) })
})
const preparedBundleSchema = v.object({
  schemaVersion: v.literal(1), category: v.literal('advertisements'), language: v.literal('en'), status: v.literal('prepared-not-run'),
  caseCount: v.literal(5), cases: v.pipe(v.array(preparedCaseSchema), v.length(5)),
  execution: v.object({ modelInvocations: v.literal(0), providerSpendUSD: v.literal(0), prohibitedUntilUserRequestsRun: v.literal(true) })
})

/** Read-only admission of already acquired local bytes. No network, writes, or model execution. */
export const validateAdvertisementPreparation = async () => {
  const read = async (path: string): Promise<Uint8Array> => new Uint8Array(await Bun.file(resolve(PROJECT_ROOT, path)).arrayBuffer())
  const bundle = v.parse(preparedBundleSchema, JSON.parse(decode(await read(`${ROOT}/bundle.json`))) as unknown)
  const annotations = await read(`${ROOT}/source/TextOCR_0.1_train.json`)
  if (hash(annotations) !== TEXT_OCR_ANNOTATION_SHA256) throw new AppValidationError('Unreviewed official TextOCR annotation bytes')
  const source: unknown = JSON.parse(decode(annotations))
  const photoMetadata = await read(`${ROOT}/source/open-images-selected-original-rows.csv`)
  if (hash(photoMetadata) !== PHOTO_METADATA_SHA256) throw new AppValidationError('Unreviewed Open Images photograph attribution bytes')
  let words = 0
  for (const pin of ADVERTISEMENT_SOURCE_PINS) {
    const matches = bundle.cases.filter(entry => entry.id === pin.id)
    if (matches.length !== 1) throw new AppValidationError(`Missing or duplicated advertisement case: ${pin.id}`)
    const entry = matches[0]!
    const folder = `${ROOT}/cases/${pin.id}`
    if (entry.input !== `${folder}/input.jpg` || entry.reference !== `${folder}/canonical-reference.txt` ||
        entry.structuredReference !== `${folder}/structured-reference.json` || entry.sourceRecord !== `${folder}/original.annotation.json`) {
      throw new AppValidationError(`Unexpected advertisement artifact path: ${pin.id}`)
    }
    if (entry.width !== pin.width || entry.height !== pin.height || entry.words !== pin.words ||
        entry.inputSha256 !== pin.inputSha256 || entry.sourceImageName !== `train_images/${pin.imageId}.jpg`) {
      throw new AppValidationError(`Advertisement source pin mismatch: ${pin.id}`)
    }
    const record = selectTextOcrRecord(source, pin.imageId)
    if (record.image.width !== pin.width || record.image.height !== pin.height || record.annotations.length !== pin.words ||
        record.annotations.some(annotation => annotation.utf8_string === '.')) throw new AppValidationError(`Unexpected source word coverage: ${pin.id}`)
    const selectedBytes = await read(entry.sourceRecord)
    if (hash(selectedBytes) !== entry.sourceRecordSha256 || !isDeepStrictEqual(JSON.parse(decode(selectedBytes)) as unknown, record)) {
      throw new AppValidationError(`Selected advertisement annotations differ from official source: ${pin.id}`)
    }
    const canonicalBytes = await read(entry.reference)
    const structuredBytes = await read(entry.structuredReference)
    const canonicalText = decode(canonicalBytes)
    const reviewedLines = reviewedWordNumbers[pin.imageId]!.map(line => line.map(word => `${pin.imageId}_${word}`))
    assertAdvertisementReference(record, canonicalText, JSON.parse(decode(structuredBytes)) as unknown, reviewedLines)
    if (hash(canonicalBytes) !== entry.referenceSha256 || hash(structuredBytes) !== entry.structuredReferenceSha256 || canonicalText.length !== entry.chars) {
      throw new AppValidationError(`Advertisement reference hash or character count mismatch: ${pin.id}`)
    }
    const inputBytes = await read(entry.input)
    const originalBytes = await read(`${ROOT}/source/${pin.imageId}.jpg`)
    if (hash(inputBytes) !== pin.inputSha256 || hash(originalBytes) !== pin.inputSha256) throw new AppValidationError(`Unreviewed advertisement image bytes: ${pin.id}`)
    const image = new Bun.Image(inputBytes)
    const dimensions = await image.metadata()
    if (dimensions.width !== pin.width || dimensions.height !== pin.height || !(await image.png().bytes()).length) {
      throw new AppValidationError(`Advertisement image decode or dimensions mismatch: ${pin.id}`)
    }
    const expectedOriginals = [
      { path: `${ROOT}/source/TextOCR_0.1_train.json`, url: TEXT_OCR_ANNOTATION_URL, bytes: annotations,
        selector: `imgs[${pin.imageId}]; imgToAnns[${pin.imageId}] -> anns[annotationId]`, revision: TEXT_OCR_SOURCE_VERSION },
      { path: `${ROOT}/source/open-images-selected-original-rows.csv`, url: PHOTO_METADATA_URL, bytes: photoMetadata,
        selector: `ImageID=${pin.imageId}`, revision: 'GCS generation 1526567626302755; etag a4ac0bcedb5c2df4d1b1230dc6b41b8f' },
      { path: `${ROOT}/source/${pin.imageId}.zip-member.bin`, url: TEXT_OCR_IMAGE_ARCHIVE_URL, bytes: await read(`${ROOT}/source/${pin.imageId}.zip-member.bin`),
        selector: `train_images/${pin.imageId}.jpg`, revision: 'S3 version ncyQEgyLZWkblorpGNAyzWbH_ssT6yG0; etag "79ddfdcdb3f40b3466b9c0dc2f0cda25-68"' }
    ]
    for (const expected of expectedOriginals) {
      const originals = entry.originalReferences.filter(original => original.path === expected.path)
      if (originals.length !== 1 || originals[0]!.url !== expected.url || originals[0]!.sha256 !== hash(expected.bytes) ||
          originals[0]!.selector !== expected.selector || originals[0]!.revision !== expected.revision) {
        throw new AppValidationError(`Advertisement original-source evidence mismatch: ${pin.id}`)
      }
    }
    const zip = Buffer.from(expectedOriginals[2]!.bytes)
    if (zip.length < 30 || zip.readUInt32LE(0) !== 0x04034b50 || zip.readUInt16LE(8) !== 8) throw new AppValidationError(`Invalid original ZIP record: ${pin.id}`)
    const nameEnd = 30 + zip.readUInt16LE(26)
    const dataStart = nameEnd + zip.readUInt16LE(28)
    if (zip.subarray(30, nameEnd).toString() !== entry.sourceImageName || dataStart + zip.readUInt32LE(18) !== zip.length ||
        hash(inflateRawSync(zip.subarray(dataStart))) !== pin.inputSha256) throw new AppValidationError(`Original ZIP member differs from image: ${pin.id}`)
    words += pin.words
  }
  return { category: 'advertisements', cases: bundle.cases.length, canonicalWordRegions: words, status: 'prepared-not-run', modelInvocations: 0, providerSpendUSD: 0 }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args.length !== 1 || args[0] !== '--validate') {
    writeCommandPayload(('Usage: bun src/tools/ocr-preparation/prepare-advertisements.ts --validate (read-only local validation; no model execution)') + '\n', 'stderr')
    process.exitCode = 1
  } else writeCommandPayload((JSON.stringify(await validateAdvertisementPreparation())) + '\n')
}
