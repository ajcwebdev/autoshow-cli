import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { validatePreparedOcrInputs } from '~/tools/ocr-preparation/validate-prepared-ocr-inputs'

const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
const hash = (value: Uint8Array | ArrayBuffer | string) => new Bun.CryptoHasher('sha256').update(value instanceof ArrayBuffer ? new Uint8Array(value) : value).digest('hex')
interface FixtureCase {
  id: string, category: string, language: string, input: string, reference: string,
  inputSha256: string, referenceSha256: string, width: number, height: number,
  pageCount: number, chars: number, status: string,
  originalReferences: Array<{ path: string, sha256: string, url: string, revision: string }>
}
const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}
const pngChunk = (type: string, content: Uint8Array) => {
  const body = Buffer.concat([Buffer.from(type), content])
  const size = Buffer.alloc(4); size.writeUInt32BE(content.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([size, body, crc])
}
/** Independently generated 2×2 RGBA fixture; no production fixture download or image helper. */
const png = (red: number, comment?: string) => {
  const header = Buffer.alloc(13); header.writeUInt32BE(2, 0); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6
  const scanline = Buffer.from([0, red, 40, 80, 255, red, 40, 80, 255])
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), pngChunk('IHDR', header),
    ...(comment ? [pngChunk('tEXt', Buffer.from(`Comment\0${comment}`))] : []),
    pngChunk('IDAT', deflateSync(Buffer.concat([scanline, scanline]))), pngChunk('IEND', new Uint8Array())])
}
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'prepared-ocr-contracts-')); roots.push(root)
  const cases: FixtureCase[] = []
  for (const [index, category] of ['technical-code', 'numeric-tables'].entries()) {
    const id = `${category}-fixture`
    const input = `fixtures/${id}.png`, reference = `fixtures/${id}.txt`, original = `fixtures/${id}.gold.txt`
    const inputBytes = png(70 + index * 80), gold = index ? 'Assets\t−12.50%\n' : 'if (count == 7) return;\n'
    await Bun.write(join(root, input), inputBytes); await Bun.write(join(root, reference), gold); await Bun.write(join(root, original), gold)
    cases.push({ id, category, language: 'en', input, reference, inputSha256: hash(inputBytes), referenceSha256: hash(gold),
      width: 2, height: 2, pageCount: 1, chars: gold.length, status: 'prepared-not-run',
      originalReferences: [{ path: original, sha256: hash(gold), url: `https://example.org/${id}.gold`, revision: 'fixture-v1' }] })
  }
  const descriptors = cases.map(entry => ({ category: entry.category, path: `fixtures/${entry.category}.bundle.json` }))
  const index = { schemaVersion: 1, status: 'prepared-not-run', executionAuthorized: false, newReadyCount: 2,
    bundles: descriptors, cases: cases.map(entry => ({ ...entry })), blockedCandidates: [] as Array<{ id: string }> }
  const save = async () => {
    for (const entry of cases) await Bun.write(join(root, `fixtures/${entry.category}.bundle.json`), JSON.stringify({ schemaVersion: 1, category: entry.category,
      language: 'en', status: 'prepared-not-run', caseCount: 1, cases: [entry] }))
  }
  await save()
  const validate = () => validatePreparedOcrInputs({ projectRoot: root, index, expectedCategoryCounts: { 'technical-code': 1, 'numeric-tables': 1 }, existingReferences: [], existingImages: [] })
  return { root, cases, index, save, validate }
}

describe('prepared OCR admission is local and cannot authorize or dispatch models', () => {
  test('accepts independent source pairs and reports readiness without changing bytes', async () => {
    const f = await fixture()
    const before = hash(await Bun.file(join(f.root, f.cases[0]!.input)).arrayBuffer())
    expect(await f.validate()).toMatchObject({ readyCount: 2, categoryCounts: { 'technical-code': 1, 'numeric-tables': 1 }, executionAuthorized: false, modelCalls: 0 })
    expect(hash(await Bun.file(join(f.root, f.cases[0]!.input)).arrayBuffer())).toBe(before)
  })
  test('rejects execution authorization before touching any fixture artifacts', async () => {
    const f = await fixture(); f.index.executionAuthorized = true
    await rm(join(f.root, 'fixtures'), { recursive: true })
    await expect(f.validate()).rejects.toThrow('executionAuthorized false')
  })
  for (const kind of ['input', 'reference', 'original']) test(`rejects deliberately corrupted ${kind} bytes`, async () => {
    const f = await fixture(), c = f.cases[0]!
    const path = kind === 'original' ? c.originalReferences[0]!.path : kind === 'input' ? c.input : c.reference
    await Bun.write(join(f.root, path), 'corrupted bytes')
    await expect(f.validate()).rejects.toThrow('hash mismatch')
  })
  test('rejects a correctly hashed invalid image artifact', async () => {
    const f = await fixture(), c = f.cases[0]!, invalid = png(70).subarray(0, 33)
    await Bun.write(join(f.root, c.input), invalid); c.inputSha256 = hash(invalid); f.index.cases[0]!.inputSha256 = c.inputSha256; await f.save()
    await expect(f.validate()).rejects.toThrow('cannot fully decode')
  })
  test('rejects dimensions inconsistent with decoded pixels', async () => {
    const f = await fixture(); f.cases[0]!.width = 3; await f.save()
    await expect(f.validate()).rejects.toThrow('dimensions mismatch')
  })
  test('rejects duplicate case IDs', async () => {
    const f = await fixture(); f.cases[1]!.id = f.cases[0]!.id; await f.save()
    await expect(f.validate()).rejects.toThrow('Duplicate case ID')
  })
  test('rejects lexical duplicates even when punctuation, case and line wrapping differ', async () => {
    const f = await fixture(), c = f.cases[1]!, duplicate = 'IF count 7\nRETURN!\n'
    await Bun.write(join(f.root, c.reference), duplicate); c.referenceSha256 = hash(duplicate); c.chars = duplicate.length; await f.save()
    await expect(f.validate()).rejects.toThrow('Duplicate normalized reference')
  })
  test('rejects duplicate pixels despite different PNG metadata and encoded hashes', async () => {
    const f = await fixture(), c = f.cases[1]!, duplicate = png(70, 'alternate metadata')
    expect(hash(duplicate)).not.toBe(f.cases[0]!.inputSha256)
    await Bun.write(join(f.root, c.input), duplicate); c.inputSha256 = hash(duplicate); await f.save()
    await expect(f.validate()).rejects.toThrow('Duplicate image pixels/bytes')
  })
  test('compares new references and images with explicitly supplied existing baselines', async () => {
    const f = await fixture()
    await expect(validatePreparedOcrInputs({ projectRoot: f.root, index: f.index, expectedCategoryCounts: { 'technical-code': 1, 'numeric-tables': 1 }, existingReferences: [f.cases[0]!.reference], existingImages: [] })).rejects.toThrow('Duplicate normalized reference')
    await expect(validatePreparedOcrInputs({ projectRoot: f.root, index: f.index, expectedCategoryCounts: { 'technical-code': 1, 'numeric-tables': 1 }, existingReferences: [], existingImages: [f.cases[0]!.input] })).rejects.toThrow('Duplicate image pixels/bytes')
  })
  test('rejects non-English case metadata', async () => {
    const f = await fixture(); f.cases[0]!.language = 'fr'; await f.save()
    await expect(f.validate()).rejects.toThrow('English bundle')
  })
  test('blocked candidates are listed separately and never counted as ready', async () => {
    const f = await fixture(); f.index.blockedCandidates.push({ id: f.cases[0]!.id })
    await expect(f.validate()).rejects.toThrow('Blocked candidate duplicated or counted as ready')
    f.index.blockedCandidates = [{ id: 'needs-reference-review' }]
    await expect(f.validate()).rejects.toThrow('Unknown blocked candidate')
    const path = join(f.root, f.index.bundles[0]!.path)
    const bundle = await Bun.file(path).json()
    bundle.cases.push({ ...f.cases[0], id: 'needs-reference-review', status: 'blocked-reference-review' })
    bundle.caseCount = 2
    await Bun.write(path, JSON.stringify(bundle))
    expect(await f.validate()).toMatchObject({ readyCount: 2, blockedIds: ['needs-reference-review'] })
  })
  test('rejects blocked cases used to satisfy a five-ready-input quota', async () => {
    const f = await fixture(); f.cases[0]!.status = 'blocked-reference-review'; await f.save()
    await expect(f.validate()).rejects.toThrow('Ready category count mismatch')
  })
  test('rejects a stale flattened metadata entry', async () => {
    const f = await fixture(); f.index.cases[0]!.referenceSha256 = '0'.repeat(64)
    await expect(f.validate()).rejects.toThrow('Flat index metadata mismatch')
  })
  test('rejects stale bundle pins and altered provenance in the flat index', async () => {
    const f = await fixture()
    Object.assign(f.index.bundles[0]!, { sha256: '0'.repeat(64) })
    await expect(f.validate()).rejects.toThrow('Bundle hash mismatch')
    Object.assign(f.index.bundles[0]!, { sha256: hash(await Bun.file(join(f.root, f.index.bundles[0]!.path)).arrayBuffer()) })
    f.index.cases[0]!.originalReferences[0]!.url = 'https://example.org/wrong-source'
    await expect(f.validate()).rejects.toThrow('Flat index metadata mismatch (originalReferences)')
  })
  test('rejects relative traversal and symlinks escaping the project root', async () => {
    const f = await fixture(); f.cases[0]!.originalReferences[0]!.path = '../outside.gold'; await f.save()
    await expect(f.validate()).rejects.toThrow('repository-relative')
    const outside = await mkdtemp(join(tmpdir(), 'ocr-outside-contracts-')); roots.push(outside)
    await Bun.write(join(outside, 'gold.txt'), 'outside')
    await symlink(join(outside, 'gold.txt'), join(f.root, 'fixtures', 'escape.gold'))
    f.cases[0]!.originalReferences[0]!.path = 'fixtures/escape.gold'; await f.save()
    await expect(f.validate()).rejects.toThrow('escapes project root')
  })
  test('CLI rejects --run without entering admission or dispatch', async () => {
    const command = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/ocr-preparation/validate-prepared-ocr-inputs.ts', '--run'], { stdout: 'pipe', stderr: 'pipe' })
    const [code, stderr] = await Promise.all([command.exited, new Response(command.stderr).text()])
    expect(code).not.toBe(0); expect(stderr).toContain('read-only; OCR execution is unavailable')
  })
})
