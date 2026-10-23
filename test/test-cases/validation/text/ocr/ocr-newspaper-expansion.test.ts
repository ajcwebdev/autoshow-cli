import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'
import {
  applyNewspaperReferenceErrata, NEWSPAPER_EXPANSION_PUBLIC_PLAN, NEWSPAPER_EXPANSION_ROOT,
  parseNewspaperExpansionMode, prepareNewspaperExpansion, serializeNewspaperWikisource, validateNewspaperExpansion,
  selectNewspaperReferenceSpan,
  type NewspaperExpansionSelection
} from '~/tools/ocr-preparation/prepare-newspaper-expansion'
import { decodePngRgba8 } from '~/utils/lossless-png'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const hash = (value: Uint8Array | string) => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const coloredPng = () => {
  const chunk = (type: string, data: Uint8Array) => {
    const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer)
    view.setUint32(0, data.length); bytes.set(Buffer.from(type), 4); bytes.set(data, 8)
    view.setUint32(data.length + 8, Bun.hash.crc32(bytes.subarray(4, data.length + 8))); return bytes
  }
  const header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0, 3); view.setUint32(4, 2); header[8] = 8; header[9] = 6
  const rows = Uint8Array.of(0, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
    0, 255, 255, 0, 255, 0, 255, 255, 255, 255, 0, 255, 255)
  return Buffer.concat([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', new Uint8Array())])
}
const tiff = async (png: Uint8Array, multiple = false) => {
  const process = Bun.spawn(['magick', 'png:-', ...(multiple ? ['-duplicate', '1'] : []), 'tiff:-'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  process.stdin.write(png); process.stdin.end()
  const [bytes, stderr, exitCode] = await Promise.all([new Response(process.stdout).arrayBuffer(), new Response(process.stderr).text(), process.exited])
  if (exitCode) throw new Error(stderr)
  return new Uint8Array(bytes)
}
const validated = (text: string) => `<noinclude><pagequality level="4" user="Reviewer" /></noinclude>${text}`
const fixture = async (kind: 'publisher-manual-text' | 'wikisource-validated' = 'publisher-manual-text') => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-newspaper-expansion-')); directories.push(root)
  const imagePath = `${NEWSPAPER_EXPANSION_ROOT}/originals/source.png`, referencePath = `${NEWSPAPER_EXPANSION_ROOT}/originals/source.txt`
  const original = kind === 'publisher-manual-text' ? 'THE NEWS\r\nLeft column.\r\nRight column.\r\n' : validated('{{center|THE NEWS}}\nLeft column.\nRight column.')
  await mkdir(dirname(resolve(root, imagePath)), { recursive: true })
  await writeFile(resolve(root, imagePath), redDotPng); await writeFile(resolve(root, referencePath), original)
  const metadata = await new Bun.Image(redDotPng).metadata()
  const selection: NewspaperExpansionSelection = { schemaVersion: 1, kind: 'ocr-newspaper-expansion-selection', language: 'en', cases: [{
    id: 'newspapers-expansion-test-page', sourceId: 'publisher-issue-page-1', language: 'en', scope: 'full-page', status: 'reviewed-ready',
    sourceImage: { path: imagePath, sha256: hash(redDotPng), url: 'https://publisher.example/image.png', revision: 'image-revision-1', identity: 'publisher/issue/page-1', width: metadata.width!, height: metadata.height! },
    sourceReference: { path: referencePath, sha256: hash(original), url: 'https://publisher.example/gold.txt', revision: 'gold-revision-1', identity: 'publisher/issue/page-1', kind, language: 'en', coverage: 'full-page' },
    review: { status: 'approved', checked: true, reviewer: 'fixture-reviewer', notes: ['Test fixture covers the declared complete input.'], readingOrder: ['heading', 'left column', 'right column'] },
    rights: { license: 'CC0' }, attribution: 'Local fixture; tests input integrity only.'
  }] }
  return { root, selection, entry: selection.cases[0]!, original, imagePath, referencePath }
}
const options = (f: Awaited<ReturnType<typeof fixture>>) => ({ projectRoot: f.root, selection: f.selection })
const casePath = (f: Awaited<ReturnType<typeof fixture>>, name: string) => resolve(f.root, NEWSPAPER_EXPANSION_ROOT, 'cases', f.entry.id, name)
const expectNotPrepared = async (root: string) => expect(await Bun.file(resolve(root, NEWSPAPER_EXPANSION_PUBLIC_PLAN)).exists()).toBe(false)

describe('Newspaper expansion gold conversion, with no OCR', () => {
  test('preserves printed SIC spelling, nested long-s and source catchwords', () => {
    const text = serializeNewspaperWikisource(validated('{{SIC|appal|appeal}} Burle{{ls}}que.\n<noinclude>{{continues|Burle{{ls}}que,}}</noinclude>'))
    expect(text).toBe('appal Burleſque.\n\nBurleſque,\n')
    expect(text).not.toContain('appeal')
  })
  test('removes reviewed font, letter-spacing, CSS and decorative controls while retaining all printed content', () => {
    const text = serializeNewspaperWikisource(validated('{{lsp|0.4em|TH|E}} {{fs|440%|NEWS}}\n{{Float right|NAME|offset=2em|gutter=1em}}{{Rule|60%|margin_tb=.5em}}\n{{block center/s|width=80%}}{{Plainlist/s|hanging-indent=2em}}\n* First notice.\n* Second notice.\n{{Plainlist/e}}{{block center/e}}'))
    expect(text).toContain('THE NEWS'); expect(text).toContain('NAME'); expect(text).toContain('First notice.\nSecond notice.')
    expect(text).not.toMatch(/440%|offset=|hanging-indent=|\{\{|\*/)
  })
  test('rejects unvalidated pages, unknown semantic templates/options and malformed markup', () => {
    for (const raw of ['<pagequality level="3"/>Text', validated('{{reconstruct|uncertain}}'), validated('{{nowrap|text|unreviewed=omit}}'), validated('{{center|unclosed'), validated('<ref>Unknown annotation</ref>'), validated('{|\n| Unreviewed table\n|}')]) {
      expect(() => serializeNewspaperWikisource(raw)).toThrow()
    }
  })
  test('plain lists omit source markup but printed asterisks outside lists remain in gold', () => {
    expect(serializeNewspaperWikisource(validated('* Printed star\n{{plainlist|\n* Listed name\n}}'))).toBe('* Printed star\n\nListed name\n')
  })
  test('retains Mc abbreviations and the first list item across noinclude source boundaries', () => {
    expect(serializeNewspaperWikisource('<noinclude><pagequality level="4"/>{{Plainlist/s}}</noinclude>* Captain {{Mc}}Donald.\n* Next name.\n{{Plainlist/e}}'))
      .toBe('Captain McDonald.\nNext name.\n')
  })
  test('admits only the exactly reviewed decorative Editorials frame and retains printed colons', () => {
    const frame = `<div style="border:2px solid black; padding:1px">\n{| style="border:3px double black; width:100%; border-collapse: collapse;"\n| style="width:20%; border-right:3px double black" |\n|{{center|{{x-larger|'''''::{{gap|3em}}Editorials{{gap|3em}}::'''''}}}}\n| style="width:20%; border-left:3px double black" |\n|}\n</div>`
    expect(serializeNewspaperWikisource(validated(frame))).toBe(':: Editorials ::\n')
    expect(() => serializeNewspaperWikisource(validated(frame.replace('width:20%; border-left', 'Meaningful data; border-left')))).toThrow('table markup')
    expect(() => serializeNewspaperWikisource(validated(frame.replace('Editorials', 'Unknown heading')))).toThrow('table markup')
  })
  test('applies documented unique errata without modernizing other source spelling', () => {
    expect(applyNewspaperReferenceErrata('shew an umbrella or sick on the line.', [{ source: 'umbrella or sick on the line.', corrected: 'umbrella or stick on the line.', basis: 'Printed stick verified visually.' }]))
      .toBe('shew an umbrella or stick on the line.')
  })
  test('rejects missing, repeated, identical or unreviewed erratum anchors', () => {
    for (const [text, source, corrected, basis] of [['other', 'missing', 'fix', 'review'], ['same same', 'same', 'fix', 'review'], ['same', 'same', 'same', 'review'], ['same', 'same', 'fix', '']]) {
      expect(() => applyNewspaperReferenceErrata(text!, [{ source: source!, corrected: corrected!, basis: basis! }])).toThrow('unique source anchor')
    }
  })
  test('selects the complete inclusive publisher-text span without changing punctuation or interior text', () => {
    const text = 'Outside header.\nStart of article.\nInterior source text.\nEnd of article.\nOutside footer.'
    expect(selectNewspaperReferenceSpan(text, { start: 'Start of article.', end: 'End of article.', basis: 'Exact printed article crop.' }))
      .toBe('Start of article.\nInterior source text.\nEnd of article.')
  })
  test('rejects missing, repeated, reversed or overlapping reference-span anchors', () => {
    for (const [text, start, end] of [['start middle end', 'missing', 'end'], ['start start end', 'start', 'end'], ['start end end', 'start', 'end'], ['end start', 'start', 'end'], ['start end', 'start', 'start'], ['start', 'start', 'art']]) {
      expect(() => selectNewspaperReferenceSpan(text!, { start: start!, end: end!, basis: 'review' })).toThrow()
    }
  })
})

describe('Newspaper expansion source admission and derived artifact integrity, without provider execution', () => {
  test('prepares exact manual gold, a separate normalized companion and pixel-identical PNG; publishes pending metadata only', async () => {
    const f = await fixture(), sourceBefore = await readFile(resolve(f.root, f.referencePath))
    const result = await prepareNewspaperExpansion(options(f))
    expect(result.readyCaseCount).toBe(1); expect(result.modelCalls).toBe(0); expect(result.executionAuthorized).toBe(false)
    expect(await readFile(casePath(f, 'canonical-reference.txt'))).toEqual(sourceBefore)
    expect(await readFile(resolve(f.root, f.referencePath))).toEqual(sourceBefore)
    expect(await Bun.file(casePath(f, 'normalized-reference.txt')).text()).toBe('THE NEWS Left column. Right column.\n')
    expect(decodePngRgba8(new Uint8Array(await readFile(casePath(f, 'input.png')))).pixelSha256).toBe(decodePngRgba8(redDotPng).pixelSha256)
    const publicPlan = await Bun.file(resolve(f.root, NEWSPAPER_EXPANSION_PUBLIC_PLAN)).json()
    expect(publicPlan.status).toBe('prepared-not-run'); expect(publicPlan.executionAuthorized).toBe(false)
    expect(publicPlan.cases[0].status).toBe('prepared-not-run'); expect(JSON.stringify(publicPlan)).not.toContain('Left column.')
    expect(await Bun.file(resolve(f.root, 'docs/benchmarks/ocr/combined-comparison-report.json')).exists()).toBe(false)
    expect((await validateNewspaperExpansion(options(f))).writes).toBe(0)
  })
  test('reconstructs Wikisource gold deterministically and detects altered canonical or normalized text', async () => {
    const f = await fixture('wikisource-validated'); await prepareNewspaperExpansion(options(f))
    expect(await Bun.file(casePath(f, 'canonical-reference.txt')).text()).toBe('THE NEWS\nLeft column.\nRight column.\n')
    await writeFile(casePath(f, 'canonical-reference.txt'), 'THE NEWS\nOmitted column.\n')
    await expect(validateNewspaperExpansion(options(f))).rejects.toThrow('Derived artifact differs')
    await prepareNewspaperExpansion(options(f)); await writeFile(casePath(f, 'normalized-reference.txt'), 'changed')
    await expect(validateNewspaperExpansion(options(f))).rejects.toThrow('Derived artifact differs')
  })
  test('preserves original manual bytes while recording and validating a reviewed gold erratum', async () => {
    const f = await fixture(); f.entry.referenceErrata = [{ source: 'Left column.', corrected: 'Left printed column.', basis: 'Explicit fixture review.' }]
    await prepareNewspaperExpansion(options(f))
    expect(await Bun.file(resolve(f.root, f.referencePath)).text()).toBe(f.original)
    expect(await Bun.file(casePath(f, 'canonical-reference.txt')).text()).toContain('Left printed column.')
    expect((await Bun.file(casePath(f, 'reference.json')).json()).errata).toEqual(f.entry.referenceErrata)
    f.entry.referenceErrata[0]!.basis = 'Changed review evidence.'
    await expect(validateNewspaperExpansion(options(f))).rejects.toThrow('Derived artifact differs')
  })
  test('prepares reviewed cropped Wikisource gold with private span provenance and public selector metadata only', async () => {
    const f = await fixture('wikisource-validated'); f.entry.scope = 'region-crop'; f.entry.sourceReference.coverage = 'region-crop'
    f.entry.imageCrop = { x: 0, y: 0, width: f.entry.sourceImage.width, height: f.entry.sourceImage.height }
    f.entry.referenceSpan = { start: 'Left column.', end: 'Right column.', basis: 'Fixture crop is exactly these two source paragraphs.' }
    await prepareNewspaperExpansion(options(f))
    expect(await Bun.file(casePath(f, 'canonical-reference.txt')).text()).toBe('Left column.\nRight column.')
    expect((await Bun.file(casePath(f, 'reference.json')).json()).referenceSpan).toEqual(f.entry.referenceSpan)
    const plan = await Bun.file(resolve(f.root, NEWSPAPER_EXPANSION_PUBLIC_PLAN)).json()
    expect(plan.cases[0].referenceSpanSelected).toBe(true); expect(plan.cases[0].referenceSpan).toBeUndefined()
    expect(JSON.stringify(plan)).not.toContain('Left column.')
    expect((await validateNewspaperExpansion(options(f))).writes).toBe(0)
    f.entry.referenceSpan.end = 'Missing source anchor.'
    await expect(validateNewspaperExpansion(options(f))).rejects.toThrow('unique start/end anchors')
  })
  test('rejects a selected reference span without an image crop or with full-page evaluation scope', async () => {
    const f = await fixture(); f.entry.referenceSpan = { start: 'Left column.', end: 'Right column.', basis: 'review' }
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('declared image crop')
    f.entry.imageCrop = { x: 0, y: 0, width: 1, height: 1 }
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('region-crop scope')
    await expectNotPrepared(f.root)
  })
  test('publication margin crop preserves every declared source pixel and records original bounds without resampling', async () => {
    const f = await fixture(), source = coloredPng(); await writeFile(resolve(f.root, f.imagePath), source)
    Object.assign(f.entry.sourceImage, { sha256: hash(source), width: 3, height: 2 })
    f.entry.imageCrop = { x: 1, y: 1, width: 2, height: 1, reason: 'Fixture publication region excludes a colored margin.' }
    await prepareNewspaperExpansion(options(f))
    const decoded = decodePngRgba8(new Uint8Array(await readFile(casePath(f, 'input.png'))))
    expect([decoded.width, decoded.height]).toEqual([2, 1])
    expect([...decoded.pixels]).toEqual([0, 255, 255, 255, 255, 0, 255, 255])
    expect(await readFile(resolve(f.root, f.imagePath))).toEqual(Buffer.from(source))
    const structure = await Bun.file(casePath(f, 'reference.json')).json()
    expect(structure.sourceImageSize).toEqual({ width: 3, height: 2 }); expect(structure.imageTransform.resampling).toBe(false)
    expect(structure.referenceCoverage.sourceBounds).toEqual({ x: 1, y: 1, width: 2, height: 1 })
    expect((await validateNewspaperExpansion(options(f))).writes).toBe(0)
    f.entry.imageCrop.x = 0
    await expect(validateNewspaperExpansion(options(f))).rejects.toThrow('Derived artifact differs')
  })
  test('decodes a native single-frame TIFF to pixel-identical PNG while retaining original bytes and format provenance', async () => {
    const f = await fixture(), source = await tiff(coloredPng())
    await writeFile(resolve(f.root, f.imagePath), source)
    Object.assign(f.entry.sourceImage, { sha256: hash(source), width: 3, height: 2 })
    await prepareNewspaperExpansion(options(f))
    const prepared = decodePngRgba8(new Uint8Array(await readFile(casePath(f, 'input.png'))))
    expect(prepared.pixelSha256).toBe(decodePngRgba8(coloredPng()).pixelSha256)
    expect(await readFile(resolve(f.root, f.imagePath))).toEqual(Buffer.from(source))
    expect((await Bun.file(casePath(f, 'reference.json')).json()).sourceImageFormat).toBe('tiff')
    expect((await validateNewspaperExpansion(options(f))).writes).toBe(0)
  })
  test('rejects multipage and truncated TIFF originals before output preparation', async () => {
    const f = await fixture()
    for (const source of [await tiff(coloredPng(), true), Uint8Array.of(73, 73, 42, 0, 8, 0, 0, 0)]) {
      await writeFile(resolve(f.root, f.imagePath), source); f.entry.sourceImage.sha256 = hash(source)
      await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('TIFF')
    }
    await expectNotPrepared(f.root)
  })
  test('rejects negative, empty and out-of-bounds publication crops before writing', async () => {
    const f = await fixture()
    for (const crop of [{ x: -1, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 0, height: 1 }, { x: 1, y: 0, width: 1, height: 1 }]) {
      await expect(prepareNewspaperExpansion({ projectRoot: f.root, selection: { ...f.selection, cases: [{ ...f.entry, imageCrop: crop }] } })).rejects.toThrow()
    }
    await expectNotPrepared(f.root)
  })
  test('keeps known-bad references blocked without asserting gold or invoking semantic conversion', async () => {
    const f = await fixture('wikisource-validated'); f.entry.status = 'blocked-reference-review'; f.entry.review.status = 'blocked'
    const raw = validated('{{reconstruct|uncertain text}}'); await writeFile(resolve(f.root, f.referencePath), raw); f.entry.sourceReference.sha256 = hash(raw)
    const result = await prepareNewspaperExpansion(options(f)); expect(result.readyCaseCount).toBe(0); expect(result.blockedCaseCount).toBe(1)
    expect(await Bun.file(casePath(f, 'canonical-reference.txt')).exists()).toBe(false)
    const plan = await Bun.file(resolve(f.root, NEWSPAPER_EXPANSION_PUBLIC_PLAN)).json()
    expect(plan.cases[0].reference).toBeNull(); expect(plan.cases[0].referenceSha256).toBeNull()
    expect((await validateNewspaperExpansion(options(f))).writes).toBe(0)
  })
  test('rejects stale scoring references when a previously ready case becomes blocked', async () => {
    const f = await fixture(); await prepareNewspaperExpansion(options(f)); f.entry.status = 'blocked-reference-review'; f.entry.review.status = 'blocked'
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('stale scoring references')
  })
  test('rejects source identity, scope, review and language mismatches before writing derived outputs', async () => {
    const f = await fixture(), entry = f.entry
    const variants = [
      { ...entry, sourceReference: { ...entry.sourceReference, identity: 'another-page' } },
      { ...entry, sourceReference: { ...entry.sourceReference, coverage: 'region-crop' } },
      { ...entry, review: { ...entry.review, status: 'blocked' } },
      { ...entry, review: { ...entry.review, checked: false } },
      { ...entry, language: 'fr' },
      { ...entry, sourceReference: { ...entry.sourceReference, language: 'de' } },
      { ...entry, status: 'complete' }
    ]
    for (const variant of variants) await expect(prepareNewspaperExpansion({ projectRoot: f.root, selection: { ...f.selection, cases: [variant] } })).rejects.toThrow()
    await expectNotPrepared(f.root)
  })
  test('rejects changed or truncated originals and source dimensions that disagree with decoded image data', async () => {
    const f = await fixture(); await writeFile(resolve(f.root, f.referencePath), 'truncated')
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('Pinned original')
    await writeFile(resolve(f.root, f.referencePath), f.original); f.entry.sourceImage.width++
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('dimensions or format')
    await expectNotPrepared(f.root)
  })
  test('rejects corrupt input artifacts even when their bytes match the declared checksum', async () => {
    const f = await fixture(); const corrupt = Buffer.from('not an image')
    await writeFile(resolve(f.root, f.imagePath), corrupt); f.entry.sourceImage.sha256 = hash(corrupt)
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow(); await expectNotPrepared(f.root)
  })
  test('detects changed PNG pixels and changed structured source coverage in saved derived artifacts', async () => {
    const f = await fixture(); await prepareNewspaperExpansion(options(f))
    await writeFile(casePath(f, 'input.png'), await new Bun.Image(redDotPng).resize(2, 2).png().bytes())
    await expect(validateNewspaperExpansion(options(f))).rejects.toThrow('Derived artifact differs')
    await prepareNewspaperExpansion(options(f)); const structure = await Bun.file(casePath(f, 'reference.json')).json()
    structure.referenceCoverage.bounds.width++
    await writeFile(casePath(f, 'reference.json'), JSON.stringify(structure))
    await expect(validateNewspaperExpansion(options(f))).rejects.toThrow('Derived artifact differs')
  })
  test('rejects duplicate IDs, source identities, image bytes and reference bytes', async () => {
    const f = await fixture(), second = structuredClone(f.entry)
    const duplicate = async () => await prepareNewspaperExpansion({ projectRoot: f.root, selection: { ...f.selection, cases: [f.entry, second] } })
    await expect(duplicate()).rejects.toThrow('Duplicate case ID')
    second.id = 'newspapers-expansion-second'; await expect(duplicate()).rejects.toThrow('Duplicate source ID')
    second.sourceId = 'different-source'; await expect(duplicate()).rejects.toThrow('Duplicate source image/reference identity')
    second.sourceImage.identity = 'page-2'; second.sourceReference.identity = 'page-2'
    await expect(duplicate()).rejects.toThrow('Duplicate source image bytes')
    const secondImage = await new Bun.Image(redDotPng).resize(2, 1).png().bytes()
    second.sourceImage.path = `${NEWSPAPER_EXPANSION_ROOT}/originals/second.png`; second.sourceImage.sha256 = hash(secondImage); second.sourceImage.width = 2; second.sourceImage.height = 1
    await writeFile(resolve(f.root, second.sourceImage.path), secondImage)
    await expect(duplicate()).rejects.toThrow('Duplicate original reference bytes'); await expectNotPrepared(f.root)
  })
  test('rejects nonportable source paths and symlink escapes before reading external source data', async () => {
    const f = await fixture(); f.entry.sourceImage.path = '../outside.png'
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('repository-relative')
    f.entry.sourceImage.path = `${NEWSPAPER_EXPANSION_ROOT}/originals/escape.png`
    await symlink(resolve(f.root, f.imagePath), resolve(f.root, f.entry.sourceImage.path))
    // A source symlink inside the root is allowed; escaping the root is rejected.
    await rm(resolve(f.root, f.entry.sourceImage.path)); await symlink(resolve(f.root, '..'), resolve(f.root, f.entry.sourceImage.path))
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('escapes project root'); await expectNotPrepared(f.root)
  })
  test('refuses output symlinks that could overwrite pinned original evidence', async () => {
    const f = await fixture(), original = await readFile(resolve(f.root, f.referencePath))
    await mkdir(dirname(casePath(f, 'canonical-reference.txt')), { recursive: true })
    await symlink(resolve(f.root, f.referencePath), casePath(f, 'canonical-reference.txt'))
    await expect(prepareNewspaperExpansion(options(f))).rejects.toThrow('Output file symlinks')
    expect(await readFile(resolve(f.root, f.referencePath))).toEqual(original)
  })
  test('CLI accepts only explicit local preparation or validation modes', () => {
    expect(parseNewspaperExpansionMode(['--validate'])).toBe('--validate'); expect(parseNewspaperExpansionMode(['--prepare-local'])).toBe('--prepare-local')
    for (const args of [[], ['--run'], ['--provider', 'openai'], ['--prepare-local', '--run']]) expect(() => parseNewspaperExpansionMode(args)).toThrow('no downloads, OCR or provider execution')
  })
})
