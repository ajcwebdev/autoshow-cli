import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLEAN_TYPOGRAPHY_SOURCE_PINS,
  normalizeOcrDuplicateText,
  serializeOmniDocBenchPage,
  validateCleanTypographyBundle,
  validateCleanTypographyBundleFile
} from '~/tools/ocr-clean-typography-admission'
import type { CleanTypographySourcePin, CleanTypographyValidationOptions } from '~/tools/ocr-clean-typography-admission'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const hash = (bytes: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

interface FixtureBlock { category_type: string, ignore: unknown, order: number | null, text: string, merge_list?: unknown[] }
interface FixturePage {
  page_info: { image_path: string, page_attribute: { language: string } }
  layout_dets: FixtureBlock[]
}
interface FixtureCase {
  id: string, input: string, reference: string, originalReference: string, sourceRecord: string | null,
  sourceImageName: string, inputSha256: string, referenceSha256: string, annotationSha256: string,
  width: number, height: number, format: string, pageCount: number, chars: number, words: number,
  sourceURL: string, sourceRevision: string, annotationURL: string, annotationFile: string, attribution: string,
  rights: { license: string, notice: string, redistributable: boolean }, originalImage?: { path: string, sha256: string }
}
interface FixtureBundle {
  schemaVersion: number, kind: string, category: string, language: string, caseCount: number, cases: FixtureCase[]
}

const page = (image = 'slide.png'): FixturePage => ({
  page_info: { image_path: image, page_attribute: { language: 'english' } },
  layout_dets: [
    { category_type: 'text_block', ignore: false, order: 2, text: '- First item\n\\t• Second item  ', merge_list: [{ text: '- First item' }] },
    { category_type: 'title', ignore: false, order: 1, text: 'A printed heading' }
  ]
})

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-ocr-admission-'))
  directories.push(root)
  await Promise.all(['cases', 'source', 'existing'].map(path => mkdir(join(root, path))))
  await Bun.write(join(root, 'source/notice.txt'), 'Synthetic independently authored fixture; test use only.')
  const pins: CleanTypographySourcePin[] = CLEAN_TYPOGRAPHY_SOURCE_PINS.map(pin => ({ ...pin }))
  const pages: FixturePage[] = pins.slice(1).map((pin, i) => ({
    page_info: { image_path: pin.imageName, page_attribute: { language: 'english' } },
    layout_dets: [
      { category_type: 'title', ignore: false, order: 1, text: `Fixture heading ${i + 1}` },
      { category_type: 'text_block', ignore: false, order: 2, text: `Independently authored document number ${i + 1}.` }
    ]
  }))
  const annotationBytes = JSON.stringify(pages)
  await Bun.write(join(root, 'source/pages.json'), annotationBytes)
  const cases: FixtureCase[] = []
  for (const [index, pin] of pins.entries()) {
    const input = `cases/${index}.png`
    const image = await new Bun.Image(redDotPng).resize(index + 1, 1).png().bytes()
    await Bun.write(join(root, input), image)
    const text = index === 0 ? 'Official gold fixture prose.\n' : `Fixture heading ${index}\n\nIndependently authored document number ${index}.\n`
    const reference = `cases/${index}.txt`
    await Bun.write(join(root, reference), text)
    const originalReference = index === 0 ? 'source/gold.txt' : `source/${index}.json`
    await Bun.write(join(root, originalReference), index === 0 ? text : JSON.stringify(pages[index - 1]))
    pin.width = index + 1
    pin.height = 1
    pin.inputSha256 = hash(image)
    pin.annotationSha256 = hash(index === 0 ? text : annotationBytes)
    if (index === 0) pin.originalImageSha256 = hash(image)
    cases.push({ id: pin.id, input, reference, originalReference, sourceRecord: index === 0 ? null : originalReference,
      sourceImageName: pin.imageName, inputSha256: pin.inputSha256, referenceSha256: hash(text), annotationSha256: pin.annotationSha256,
      width: pin.width, height: pin.height, format: 'png', pageCount: 1, chars: text.length, words: text.trim().split(/\s+/).length,
      sourceURL: pin.sourceURL, sourceRevision: pin.revision, annotationURL: pin.annotationURL,
      annotationFile: index === 0 ? 'source/gold.txt' : 'source/pages.json', attribution: 'Independent test fixture author',
      rights: { license: 'Test fixture', notice: 'source/notice.txt', redistributable: true },
      ...(index === 0 ? { originalImage: { path: input, sha256: hash(image) } } : {}) })
  }
  const existingReferences = Array.from({ length: 9 }, (_, i) => `existing/${i}.txt`)
  await Promise.all(existingReferences.map((path, i) => Bun.write(join(root, path), `--- Page 1 ---\nExisting unrelated corpus item ${i}.\n`)))
  const bundle: FixtureBundle = { schemaVersion: 1, kind: 'ocr-canonical-input-bundle', category: 'clean-typography', language: 'en', caseCount: 5, cases }
  const options: CleanTypographyValidationOptions = { projectRoot: root, trustedSources: pins, existingReferences, existingImages: [] }
  const changePage = async (index: number, changed: FixturePage) => {
    pages[index - 1] = changed
    const updated = JSON.stringify(pages)
    await Bun.write(join(root, 'source/pages.json'), updated)
    for (const i of [1, 2, 3, 4]) { cases[i]!.annotationSha256 = hash(updated); pins[i]!.annotationSha256 = hash(updated) }
    await Bun.write(join(root, cases[index]!.sourceRecord!), JSON.stringify(changed))
  }
  return { root, pins, pages, bundle, options, changePage }
}

describe('clean typography publisher-reference serialization', () => {
  test('uses exact image selector and publisher order, decodes escaped tabs and strips trailing whitespace', () => {
    expect(serializeOmniDocBenchPage([page('other.png'), page()], 'slide.png'))
      .toBe('A printed heading\n\n- First item\n\t• Second item\n')
  })
  test('preserves first-line indentation and Unicode spaces while trimming only ASCII horizontal endings and terminal LFs', () => {
    const record = page()
    record.layout_dets[1]!.text = '  \tIndented heading\u00a0  \t\n\n'
    record.layout_dets[0]!.text = '\\t• Leading tab retained\u00a0\u2003\t \n\n'
    expect(serializeOmniDocBenchPage([record], 'slide.png'))
      .toBe('  \tIndented heading\u00a0\n\n\t• Leading tab retained\u00a0\u2003\n')
  })
  test('rejects missing and ambiguous page selectors', () => {
    expect(() => serializeOmniDocBenchPage([page()], 'wrong.png')).toThrow('found 0')
    expect(() => serializeOmniDocBenchPage([page(), page()], 'slide.png')).toThrow('found 2')
  })
  test('requires explicit English language metadata', () => {
    const record = page(); record.page_info.page_attribute.language = 'french'
    expect(() => serializeOmniDocBenchPage([record], 'slide.png')).toThrow()
  })
  test('rejects truthy string ignore flags and absent boolean flags', () => {
    for (const flag of ['false', 'true', undefined, null]) {
      const record = page(); record.layout_dets[0]!.ignore = flag
      expect(() => serializeOmniDocBenchPage([record], 'slide.png')).toThrow('boolean ignore')
    }
  })
  test('rejects duplicate orders, missing orders and empty visible text', () => {
    const duplicate = page(); duplicate.layout_dets[0]!.order = 1
    expect(() => serializeOmniDocBenchPage([duplicate], 'slide.png')).toThrow('Duplicate')
    const unordered = page(); unordered.layout_dets[0]!.order = null
    expect(() => serializeOmniDocBenchPage([unordered], 'slide.png')).toThrow('reading order')
    const empty = page(); empty.layout_dets[0]!.text = ' \n '
    expect(() => serializeOmniDocBenchPage([empty], 'slide.png')).toThrow('nonempty')
  })
  test('omits ignored blocks and duplicated merge children while preserving legitimate repeated parent text', () => {
    const record = page()
    record.layout_dets[0]!.text = 'Repeated printed line.'
    record.layout_dets[0]!.merge_list = Array.from({ length: 4 }, () => ({ text: 'Repeated printed line.' }))
    record.layout_dets.push({ category_type: 'text_block', ignore: false, order: 3, text: 'Repeated printed line.' })
    record.layout_dets.push({ category_type: 'text_block', ignore: true, order: 4, text: 'Ignored artifact.' })
    expect(serializeOmniDocBenchPage([record], 'slide.png')).toBe('A printed heading\n\nRepeated printed line.\n\nRepeated printed line.\n')
  })
})

describe('clean typography local source admission', () => {
  test('admits five independently authored pairs, fully decodes PNGs and reproduces gold without changing files', async () => {
    const f = await fixture()
    const before = await Bun.file(join(f.root, 'source/pages.json')).text()
    await Bun.write(join(f.root, 'bundle.json'), JSON.stringify(f.bundle))
    const result = await validateCleanTypographyBundleFile('bundle.json', f.options)
    expect(result).toMatchObject({ status: 'admitted', mode: 'local-read-only-no-cost', caseCount: 5, existingReferencesCompared: 9, existingImagesCompared: 0 })
    expect(result.cases.map(entry => entry.width)).toEqual([1, 2, 3, 4, 5])
    expect(await Bun.file(join(f.root, 'source/pages.json')).text()).toBe(before)
  })
  test('rejects duplicate or unknown case IDs and incorrect case count', async () => {
    const f = await fixture()
    const duplicate = structuredClone(f.bundle); duplicate.cases[1]!.id = duplicate.cases[0]!.id
    await expect(validateCleanTypographyBundle(duplicate, f.options)).rejects.toThrow('Duplicate case ID')
    const unknown = structuredClone(f.bundle); unknown.cases[1]!.id = 'invented'
    await expect(validateCleanTypographyBundle(unknown, f.options)).rejects.toThrow('Unrecognized case ID')
    const short = structuredClone(f.bundle); short.cases.pop()
    await expect(validateCleanTypographyBundle(short, f.options)).rejects.toThrow()
  })
  test('rejects absolute, parent-traversing, URL and Windows paths before artifact reads', async () => {
    const f = await fixture()
    for (const path of ['/tmp/outside.png', '../outside.png', 'https://example.com/a.png', 'C:\\outside.png', 'cases/../0.png']) {
      const bundle = structuredClone(f.bundle); bundle.cases[0]!.input = path
      await expect(validateCleanTypographyBundle(bundle, f.options)).rejects.toThrow('repository-relative')
    }
  })
  test('rejects symlink escape despite a repository-relative spelling', async () => {
    const f = await fixture()
    const outside = await mkdtemp(join(tmpdir(), 'autoshow-ocr-outside-')); directories.push(outside)
    await Bun.write(join(outside, 'outside.png'), redDotPng)
    await symlink(join(outside, 'outside.png'), join(f.root, 'cases/escape.png'))
    f.bundle.cases[0]!.input = 'cases/escape.png'
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('escapes project root')
  })
  test('rejects a changed annotation pin and changed original full-annotation bytes', async () => {
    const f = await fixture()
    const changed = structuredClone(f.bundle); changed.cases[1]!.annotationSha256 = '0'.repeat(64)
    await expect(validateCleanTypographyBundle(changed, f.options)).rejects.toThrow('trusted pin')
    await Bun.write(join(f.root, 'source/pages.json'), '[]')
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Pinned annotation hash mismatch')
  })
  test('rejects an extracted annotation record from another image even when local reference hashes match', async () => {
    const f = await fixture()
    f.bundle.cases[1]!.sourceRecord = f.bundle.cases[2]!.sourceRecord
    f.bundle.cases[1]!.originalReference = f.bundle.cases[2]!.originalReference
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('does not match pinned annotation page')
  })
  test('rejects swapped source image names and revisions', async () => {
    const f = await fixture()
    const swapped = structuredClone(f.bundle); swapped.cases[1]!.sourceImageName = swapped.cases[2]!.sourceImageName
    await expect(validateCleanTypographyBundle(swapped, f.options)).rejects.toThrow('Source identity')
    const revision = structuredClone(f.bundle); revision.cases[1]!.sourceRevision = 'unreviewed'
    await expect(validateCleanTypographyBundle(revision, f.options)).rejects.toThrow('Source identity')
  })
  test('rejects corrupted image bytes using the recorded source hash', async () => {
    const f = await fixture()
    await Bun.write(join(f.root, f.bundle.cases[1]!.input), 'invalid image')
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Input hash mismatch')
  })
  test('rejects a header-only PNG even when its input hash has been explicitly approved', async () => {
    const f = await fixture()
    const entry = f.bundle.cases[1]!
    const bytes = new Uint8Array(await Bun.file(join(f.root, entry.input)).arrayBuffer()).subarray(0, 33)
    expect(await new Bun.Image(bytes).metadata()).toMatchObject({ width: 2, height: 1, format: 'png' })
    await Bun.write(join(f.root, entry.input), bytes)
    entry.inputSha256 = hash(bytes); f.pins[1]!.inputSha256 = hash(bytes)
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('cannot fully decode')
  })
  test('checks actual decoded dimensions after independently approved metadata changes', async () => {
    const f = await fixture()
    f.bundle.cases[1]!.width = 3; f.pins[1]!.width = 3
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Decoded PNG dimensions/format mismatch')
  })
  test('rejects corrupted reference hashes and self-consistently rehashed text differing from publisher gold', async () => {
    const f = await fixture(); const entry = f.bundle.cases[1]!
    await Bun.write(join(f.root, entry.reference), 'Unapproved replacement text.\n')
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Reference hash mismatch')
    entry.referenceSha256 = hash('Unapproved replacement text.\n')
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('does not reproduce from its source')
  })
  test('rejects an altered original Tesseract gold independently of the derived reference', async () => {
    const f = await fixture()
    await Bun.write(join(f.root, 'source/different-gold.txt'), 'Changed gold text.\n')
    f.bundle.cases[0]!.originalReference = 'source/different-gold.txt'
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Tesseract original gold differs')
  })
  test('rejects normalized textual duplicates against existing corpus including page labels', async () => {
    const f = await fixture()
    await Bun.write(join(f.root, 'existing/8.txt'), '--- Page 1 ---\nOFFICIAL, gold fixture prose!!!\n')
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Duplicate or empty normalized reference')
    expect(normalizeOcrDuplicateText('--- Page 1 ---\nMixed CASE!')).toBe('mixed case')
  })
  test('rejects normalized textual duplicates among new cases while references remain independently reproducible', async () => {
    const f = await fixture()
    const duplicate = structuredClone(f.pages[0]!)
    duplicate.page_info.image_path = f.pins[2]!.imageName
    await f.changePage(2, duplicate)
    const text = await Bun.file(join(f.root, f.bundle.cases[1]!.reference)).text()
    const entry = f.bundle.cases[2]!
    await Bun.write(join(f.root, entry.reference), text)
    entry.referenceSha256 = hash(text); entry.chars = text.length; entry.words = text.trim().split(/\s+/).length
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Duplicate or empty normalized reference')
  })
  test('rejects an image repeated from the existing local source-image collection', async () => {
    const f = await fixture()
    await expect(validateCleanTypographyBundle(f.bundle, { ...f.options, existingImages: [f.bundle.cases[1]!.input] })).rejects.toThrow('Duplicate image')
  })
  test('rejects two new PNGs with identical pixels despite distinct compression and approved byte hashes', async () => {
    const f = await fixture(); const entry = f.bundle.cases[1]!
    const compressed = await new Bun.Image(redDotPng).png({ compressionLevel: 0 }).bytes()
    expect(hash(compressed)).not.toBe(f.bundle.cases[0]!.inputSha256)
    await Bun.write(join(f.root, entry.input), compressed)
    entry.inputSha256 = hash(compressed); f.pins[1]!.inputSha256 = hash(compressed)
    entry.width = 1; f.pins[1]!.width = 1
    await expect(validateCleanTypographyBundle(f.bundle, f.options)).rejects.toThrow('Duplicate image')
  })
  test('CLI help is local/no-cost and execution flags are rejected before input validation', async () => {
    const tool = 'src/tools/ocr-clean-typography-admission.ts'
    const help = Bun.spawn([process.execPath, tool, '--help'], { stdout: 'pipe', stderr: 'pipe' })
    expect(await help.exited).toBe(0)
    expect(await new Response(help.stdout).text()).toContain('no downloads, writes or provider calls')
    const invalid = Bun.spawn([process.execPath, tool, '--run'], { stdout: 'pipe', stderr: 'pipe' })
    expect(await invalid.exited).toBe(1)
    expect(await new Response(invalid.stderr).text()).toContain('Usage:')
  })
})
