import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  assertAdvertisementReference,
  makeTextOcrStructuredReference,
  selectTextOcrRecord,
  serializeTextOcrReference
} from '~/tools/ocr-preparation/prepare-advertisements'
import { PROJECT_ROOT } from '~/utils/project-root'

const imageId = '0123456789abcdef'
const word = (suffix: number, text: string, x: number) => ({
  id: `${imageId}_${suffix}`, image_id: imageId, utf8_string: text,
  bbox: [x, 1, 2, 2], points: [x, 1, x + 2, 1, x + 2, 3, x, 3], area: 4
})
const fixture = () => ({
  imgs: { [imageId]: { id: imageId, width: 20, height: 10, set: 'train', file_name: `train/${imageId}.jpg` } },
  imgToAnns: { [imageId]: [`${imageId}_2`, `${imageId}_1`, `${imageId}_3`] },
  anns: {
    [`${imageId}_2`]: word(2, '$12.50!', 5),
    [`${imageId}_1`]: word(1, "DON'T", 1),
    [`${imageId}_3`]: word(3, '.', 9)
  }
})
const lines = [[`${imageId}_1`, `${imageId}_2`]]

describe('TextOCR paired reference preparation, with no model execution', () => {
  test('preserves punctuation and exact region geometry while using explicit order rather than JSON order', () => {
    const record = selectTextOcrRecord(fixture(), imageId)
    expect(serializeTextOcrReference(record, lines)).toBe("DON'T $12.50!\n")
    const structured = makeTextOcrStructuredReference(record, lines)
    expect(structured.canonicalReadingOrder).toBeNull()
    expect(structured.reviewedReadingOrder.notDatasetGoldOrder).toBe(true)
    expect(structured.regions[0]!.text).toBe('$12.50!')
    expect(structured.regions[0]!.polygon).toEqual([5, 1, 7, 1, 7, 3, 5, 3])
    expect(structured.regions[2]!.ignore).toBe(true)
  })
  test('rejects wrong image filename and cross-image annotations', () => {
    const source = fixture()
    source.imgs[imageId]!.file_name = 'train/another-image.jpg'
    expect(() => selectTextOcrRecord(source, imageId)).toThrow('Image selector mismatch')
    source.imgs[imageId]!.file_name = `train/${imageId}.jpg`
    source.anns[`${imageId}_1`]!.image_id = 'fedcba9876543210'
    expect(() => selectTextOcrRecord(source, imageId)).toThrow('Word/image pair mismatch')
  })
  test('rejects duplicate source IDs and missing source records', () => {
    const source = fixture()
    source.imgToAnns[imageId]!.push(`${imageId}_1`)
    expect(() => selectTextOcrRecord(source, imageId)).toThrow('Duplicate source annotation ID')
    source.imgToAnns[imageId] = ['missing']
    expect(() => selectTextOcrRecord(source, imageId)).toThrow()
  })
  test('rejects out-of-image, malformed, and bbox-inconsistent geometry', () => {
    const source = fixture()
    source.anns[`${imageId}_1`]!.points[0] = -1
    expect(() => selectTextOcrRecord(source, imageId)).toThrow('Word polygon escapes image')
    source.anns[`${imageId}_1`] = word(1, 'word', 1)
    source.anns[`${imageId}_1`]!.points.pop()
    expect(() => selectTextOcrRecord(source, imageId)).toThrow('Invalid word polygon')
    source.anns[`${imageId}_1`] = word(1, 'word', 1)
    source.anns[`${imageId}_1`]!.bbox[2] = 3
    expect(() => selectTextOcrRecord(source, imageId)).toThrow('Word polygon and bounding box disagree')
  })
  test('rejects absent, omitted, repeated, unknown, and ignored word order entries', () => {
    const record = selectTextOcrRecord(fixture(), imageId)
    expect(() => serializeTextOcrReference(record, [])).toThrow('No reviewed')
    expect(() => serializeTextOcrReference(record, [[`${imageId}_1`]])).toThrow('omits')
    expect(() => serializeTextOcrReference(record, [[`${imageId}_1`, `${imageId}_1`]])).toThrow('repeats')
    expect(() => serializeTextOcrReference(record, [[`${imageId}_1`, 'unknown']])).toThrow('unknown or ignored')
    expect(() => serializeTextOcrReference(record, [[...lines[0]!, `${imageId}_3`]])).toThrow('unknown or ignored')
    expect(() => serializeTextOcrReference(record, [[]])).toThrow('Empty reading-order line')
  })
  test('requires finite coordinates and nonempty exact word text', () => {
    const source = fixture()
    source.anns[`${imageId}_1`]!.points[0] = Number.NaN
    expect(() => selectTextOcrRecord(source, imageId)).toThrow()
    source.anns[`${imageId}_1`] = word(1, ' word', 1)
    expect(() => selectTextOcrRecord(source, imageId)).toThrow('boundary whitespace')
    source.anns[`${imageId}_1`] = word(1, '', 1)
    expect(() => selectTextOcrRecord(source, imageId)).toThrow()
  })
  test('compares full canonical text, word geometry, ignore mapping and reviewed order against independent reconstruction', () => {
    const record = selectTextOcrRecord(fixture(), imageId)
    const text = serializeTextOcrReference(record, lines)
    const structure = makeTextOcrStructuredReference(record, lines)
    expect(() => assertAdvertisementReference(record, text, structure, lines)).not.toThrow()
    expect(() => assertAdvertisementReference(record, text.replace('$12.50!', '$1250'), structure, lines)).toThrow('text differs')
    const wrongGeometry = structuredClone(structure)
    wrongGeometry.regions[0]!.polygon[0] = 6
    expect(() => assertAdvertisementReference(record, text, wrongGeometry, lines)).toThrow('region mapping')
    const wrongIgnore = structuredClone(structure)
    wrongIgnore.regions[0]!.ignore = true
    expect(() => assertAdvertisementReference(record, text, wrongIgnore, lines)).toThrow('region mapping')
    const wrongOrder = structuredClone(structure)
    wrongOrder.reviewedReadingOrder.lines = [[`${imageId}_2`, `${imageId}_1`]]
    expect(() => assertAdvertisementReference(record, text, wrongOrder, lines)).toThrow('reviewed order')
  })
  test('CLI requires --validate and rejects execution flags before reading any ignored fixtures', () => {
    const script = resolve(PROJECT_ROOT, 'src/tools/ocr-preparation/prepare-advertisements.ts')
    for (const args of [[], ['--run'], ['--validate', '--run'], ['--provider', 'openai']]) {
      const result = Bun.spawnSync([process.execPath, script, ...args], { cwd: tmpdir(), stdout: 'pipe', stderr: 'pipe' })
      expect(result.exitCode).toBe(1)
      expect(new TextDecoder().decode(result.stderr)).toContain('Usage:')
      expect(new TextDecoder().decode(result.stdout)).toBe('')
    }
  })
})
