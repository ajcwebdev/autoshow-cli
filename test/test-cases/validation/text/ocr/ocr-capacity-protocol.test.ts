import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { createCapacityProtocolFetchGuard } from '~/tools/ocr-capacity-spending-guard'
import { assertCapacityGeometry, assertCapacityReferenceCoverage, capacityHash, inspectOcrCapacityProtocol,
  prepareOcrCapacityProtocol, validateOcrCapacityProtocol, type CapacityExecutionPlan, type CapacityMapping } from '~/tools/ocr-preparation/prepare-capacity-protocol'
import { buildHostedOcrJsonPrompt, HOSTED_OCR_PAGES_JSON_SCHEMA } from '~/cli/commands/text/ocr/ocr-utils/hosted-ocr-json'
import { runGeminiOcr } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { decodePngRgba8 } from '~/utils/lossless-png'

// Independent native expectations: https://ai.google.dev/api/generate-content,
// https://ai.google.dev/gemini-api/docs/thinking and /docs/models/gemini-3.8-flash
// (checked 2026-10-26). GenerateContent accepts inline PNG; LOW is supported,
// minimal is unsupported. The repository deliberately caps single-image OCR at
// 8192, below the model's native 65536. These mocked tests prove dispatch and
// artifact integrity only, not image recognition or transcription correctness.
const dirs: string[] = []
const originalFetch = globalThis.fetch
const originalKey = process.env['GEMINI_API_KEY']
afterEach(async () => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env['GEMINI_API_KEY']; else process.env['GEMINI_API_KEY'] = originalKey
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})
const encodePng = (): Uint8Array => {
  const chunk = (name: string, bytes: Uint8Array) => {
    const out = Buffer.alloc(bytes.length + 12)
    out.writeUInt32BE(bytes.length); out.write(name, 4); out.set(bytes, 8)
    out.writeUInt32BE(Bun.hash.crc32(out.subarray(4, bytes.length + 8)), bytes.length + 8)
    return out
  }
  const header = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0])
  const pixels = Buffer.from([0, 255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
}
type Fixture = { root: string, mappingPath: string, mapping: CapacityMapping, plan: CapacityExecutionPlan, planPath: string, planSha256: string }
const readJson = async <T>(path: string): Promise<T> => JSON.parse(await Bun.file(path).text()) as T
const saveJson = async (path: string, value: unknown) => { await Bun.write(path, JSON.stringify(value, null, 2) + '\n') }
const fixture = async (): Promise<Fixture> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-capacity-')); dirs.push(root)
  const source = 'HEADER\nLEFT\nRIGHT\n', png = encodePng()
  const registry = JSON.stringify({ gemini: { models: { 'gemini-3.8-flash': { costPerMInputTokensCents: 150, costPerMOutputTokensCents: 750 } } } })
  const protectedText = 'independent source; not a provider response\n'
  await Promise.all([Bun.write(join(root, 'input/source.png'), png), Bun.write(join(root, 'input/reference.txt'), source),
    Bun.write(join(root, 'input/registry.json'), registry), Bun.write(join(root, 'input/protected.txt'), protectedText)])
  const span = (id: string, start: number, end: number) => ({ id, start, end, sha256: capacityHash(source.slice(start, end)) })
  const mapping: CapacityMapping = { schemaVersion: 1, kind: 'ocr-capacity-region-mapping', protocolId: 'synthetic-capacity-v2', sourceCaseId: 'synthetic-source',
    sourceImage: { path: 'input/source.png', sha256: capacityHash(png), width: 2, height: 2 },
    sourceReference: { path: 'input/reference.txt', sha256: capacityHash(source), kind: 'publisher-canonical', independentOfProviders: true,
      sourceUrl: 'https://example.invalid/publisher', sourceRevision: 'fixed-test-revision' },
    protectedArtifacts: [{ path: 'input/protected.txt', sha256: capacityHash(protectedText) }], maximumHorizontalGutterOverlap: 0,
    regions: [{ id: 'header', x: 0, y: 0, width: 2, height: 1, spans: [span('header', 0, 7)], readingOrder: 'Header' },
      { id: 'left', x: 0, y: 1, width: 1, height: 1, spans: [span('left', 7, 12)], readingOrder: 'Left' },
      { id: 'right', x: 1, y: 1, width: 1, height: 1, spans: [span('right', 12, source.length)], readingOrder: 'Right' }],
    target: { provider: 'gemini', model: 'gemini-3.8-flash', reasoningEffort: 'low', maxOutputTokens: 8192,
      inputTokenAllowance: 64000, attemptsPerRegion: 3, globalConcurrency: 1,
      pricing: { inputCentsPerMillion: 150, outputCentsPerMillion: 750, registry: { path: 'input/registry.json', sha256: capacityHash(registry) },
        sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing', checkedAt: '2026-10-26' } },
    rights: { imageLicense: 'synthetic fixture', referenceLicense: 'synthetic fixture', attribution: 'test fixture' },
    review: { scope: 'synthetic fixture only', independentFinalReview: false } }
  const mappingPath = 'input/capacity/mapping.json'; await saveJson(join(root, mappingPath), mapping)
  const prepared = await prepareOcrCapacityProtocol({ projectRoot: root, mappingPath })
  return { root, mappingPath, mapping, plan: await readJson(join(root, prepared.planPath)), planPath: prepared.planPath, planSha256: prepared.planSha256 }
}
// Test-only synthetic approval. Production preparation always emits status:required.
const approve = async (f: Fixture) => {
  const review = { schemaVersion: 1, kind: 'ocr-capacity-reference-review', status: 'accepted', planSha256: f.planSha256,
    regionIds: f.plan.regions.map(r => r.id), completeSourceMapping: true, reviewedGeometry: true,
    referenceSpansAssignedOnce: true, providerOutputUsedAsReference: false, reviewer: 'synthetic test reviewer' }
  await saveJson(join(f.root, f.plan.referenceReview), review)
  const approval = { schemaVersion: 1, kind: 'ocr-capacity-exact-approval', status: 'approved', protocolId: f.plan.protocolId,
    planSha256: f.planSha256, target: 'gemini/gemini-3.8-flash', regionIds: f.plan.regions.map(r => r.id), attemptsPerRegion: 3,
    budgetCents: f.plan.spending.approvalBudgetCents, inputAllowanceAcknowledged: true, evidence: 'Synthetic approval for mocked transport only.',
    referenceReview: { path: f.plan.referenceReview, sha256: capacityHash(await Bun.file(join(f.root, f.plan.referenceReview)).bytes()) } }
  await saveJson(join(f.root, f.plan.approval), approval)
  return approval
}
const guard = async (f: Fixture, regionId = 'header', transport: (request: Request) => Promise<Response> = async () => response()) =>
  await createCapacityProtocolFetchGuard({ projectRoot: f.root, planPath: f.planPath, planSha256: f.planSha256, regionId, fetchImplementation: transport })
const nativeBody = async (f: Fixture, regionId = 'header') => ({ contents: [{ role: 'user', parts: [{ text: buildHostedOcrJsonPrompt(1) },
  { inlineData: { mimeType: 'image/png', data: Buffer.from(await Bun.file(join(f.root, f.plan.regions.find(r => r.id === regionId)!.input)).bytes()).toString('base64') } }] }],
  generationConfig: { responseMimeType: 'application/json', responseJsonSchema: HOSTED_OCR_PAGES_JSON_SCHEMA, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'LOW' } } })
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'
const send = async (fetcher: typeof fetch, body: unknown, url = endpoint) => await fetcher(url, { method: 'POST', body: JSON.stringify(body) })
const response = (text = '{"pages":[{"pageNumber":1,"text":"fixture"}]}', finish = 'STOP', input = 100, candidate = 10, thoughts = 2) =>
  Response.json({ candidates: [{ finishReason: finish, content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: input, candidatesTokenCount: candidate, thoughtsTokenCount: thoughts } })
type TestLedger = { approvalSha256: string | null, budgetCents: number, receipts: Record<string, unknown>[] }
const ledger = async (f: Fixture) => await readJson<TestLedger>(join(f.root, f.plan.ledger))

describe('offline capacity preparation and source coverage', () => {
  test('prepares exact colored pixel crops, preserves all reference spans and initializes no-spend approval', async () => {
    const f = await fixture(), checked = await validateOcrCapacityProtocol({ projectRoot: f.root, mappingPath: f.mappingPath })
    expect(checked).toMatchObject({ referenceWords: 3, regionCount: 3, providerCalls: 0, writes: 0, executionAuthorized: false, independentReviewComplete: false })
    expect(f.plan.spending).toMatchObject({ perAttemptReservedCents: 15.744, totalReservedCents: 141.696, approvalBudgetCents: 142, maximumRequests: 9 })
    const pixels = await Promise.all(f.plan.regions.map(async r => {
      const bytes = await Bun.file(join(f.root, r.input)).bytes()
      expect(await new Bun.Image(bytes, { autoOrient: false }).metadata()).toMatchObject({ width: r.width, height: r.height, format: 'png' })
      return [...decodePngRgba8(bytes).pixels]
    }))
    expect(pixels).toEqual([[255, 0, 0, 255, 0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]])
    expect(await ledger(f)).toMatchObject({ approvalSha256: null, receipts: [] })
    expect(await readJson(join(f.root, f.plan.approval))).toMatchObject({ status: 'required', inputAllowanceAcknowledged: false })
    expect(await prepareOcrCapacityProtocol({ projectRoot: f.root, mappingPath: f.mappingPath })).toMatchObject({ planSha256: f.planSha256 })
  })
  test('reconstructs source by offsets even when regional physical order differs', async () => {
    const f = await fixture(), source = await Bun.file(join(f.root, f.mapping.sourceReference.path)).text()
    const reversed = [...f.mapping.regions].reverse()
    assertCapacityReferenceCoverage(source, reversed)
    const rebuilt = reversed.flatMap(r => r.spans).sort((a, b) => a.start - b.start).map(s => source.slice(s.start, s.end)).join('')
    expect(rebuilt).toBe(source)
  })
  for (const alteration of ['gap', 'overlap', 'duplicate', 'hash', 'word-split', 'tail'] as const) test(`rejects ${alteration} reference mapping`, async () => {
    const f = await fixture(), regions = structuredClone(f.mapping.regions), source = await Bun.file(join(f.root, f.mapping.sourceReference.path)).text()
    const first = regions[0]!.spans[0]!, second = regions[1]!.spans[0]!
    if (alteration === 'gap') second.start++
    if (alteration === 'overlap') second.start--
    if (alteration === 'duplicate') second.id = first.id
    if (alteration === 'hash') first.sha256 = '0'.repeat(64)
    if (alteration === 'tail') regions.pop()
    if (alteration === 'word-split') { first.end = 3; second.start = 3; first.sha256 = capacityHash(source.slice(0, 3)); second.sha256 = capacityHash(source.slice(3, second.end)) }
    expect(() => assertCapacityReferenceCoverage(source, regions)).toThrow()
  })
  for (const alteration of ['hole', 'bounds', 'vertical-overlap', 'wide-overlap', 'duplicate'] as const) test(`rejects ${alteration} crop geometry`, async () => {
    const f = await fixture(), regions = structuredClone(f.mapping.regions)
    if (alteration === 'hole') regions.pop()
    if (alteration === 'bounds') regions[0]!.width = 3
    if (alteration === 'vertical-overlap') regions[0]!.height = 2
    if (alteration === 'wide-overlap') regions[1]!.width = 2
    if (alteration === 'duplicate') regions[1]!.id = regions[0]!.id
    expect(() => assertCapacityGeometry(2, 2, regions, 0)).toThrow()
  })
  test('accepts only bounded horizontal gutter overlap with complete image union', async () => {
    const f = await fixture(), regions = [structuredClone(f.mapping.regions[0]!), structuredClone(f.mapping.regions[1]!)]
    Object.assign(regions[0]!, { x: 0, y: 0, width: 6, height: 2 }); Object.assign(regions[1]!, { x: 4, y: 0, width: 6, height: 2 })
    expect(() => assertCapacityGeometry(10, 2, regions, 2)).not.toThrow()
    expect(() => assertCapacityGeometry(10, 2, regions, 1)).toThrow()
  })
  for (const target of ['image', 'reference', 'protected', 'registry', 'plan', 'crop', 'regional-reference'] as const) test(`detects changed ${target} and refuses to overwrite evidence`, async () => {
    const f = await fixture(), path = target === 'image' ? f.mapping.sourceImage.path : target === 'reference' ? f.mapping.sourceReference.path : target === 'protected' ? f.mapping.protectedArtifacts[0]!.path
      : target === 'registry' ? f.mapping.target.pricing.registry.path : target === 'plan' ? f.planPath : target === 'crop' ? f.plan.regions[0]!.input : f.plan.regions[0]!.reference
    await Bun.write(join(f.root, path), 'tampered original bytes')
    await expect(validateOcrCapacityProtocol({ projectRoot: f.root, mappingPath: f.mappingPath })).rejects.toThrow()
    await expect(prepareOcrCapacityProtocol({ projectRoot: f.root, mappingPath: f.mappingPath })).rejects.toThrow()
    expect(await Bun.file(join(f.root, path)).text()).toBe('tampered original bytes')
  })
  test('rejects source and output symlinks that escape the fixture project', async () => {
    const f = await fixture(), outside = await mkdtemp(join(tmpdir(), 'autoshow-capacity-outside-')); dirs.push(outside)
    await writeFile(join(outside, 'external.png'), await readFile(join(f.root, f.mapping.sourceImage.path)))
    await rm(join(f.root, f.mapping.sourceImage.path)); await symlink(join(outside, 'external.png'), join(f.root, f.mapping.sourceImage.path))
    await expect(validateOcrCapacityProtocol({ projectRoot: f.root, mappingPath: f.mappingPath })).rejects.toThrow('escapes project root')
    const g = await fixture(); await rm(join(g.root, dirname(g.plan.regions[0]!.input)), { recursive: true }); await symlink(outside, join(g.root, dirname(g.plan.regions[0]!.input)))
    await expect(prepareOcrCapacityProtocol({ projectRoot: g.root, mappingPath: g.mappingPath })).rejects.toThrow('not a real directory')
    expect(await Bun.file(join(outside, 'input.png')).exists()).toBe(false)
  })
})

describe('capacity guard authorization, native controls and cumulative receipts without provider calls', () => {
  test('pending approval blocks before transport and preserves the empty ledger', async () => {
    const f = await fixture(); let calls = 0
    await expect(guard(f, 'header', async () => { calls++; return response() })).rejects.toThrow()
    expect(calls).toBe(0); expect((await ledger(f)).receipts).toEqual([])
  })
  for (const change of ['plan', 'budget', 'regions', 'allowance', 'review-path', 'review-bytes', 'review-coverage'] as const) test(`rejects ${change} approval drift before transport`, async () => {
    const f = await fixture(), approval = await approve(f)
    if (change === 'plan') approval.planSha256 = '0'.repeat(64)
    if (change === 'budget') approval.budgetCents++
    if (change === 'regions') approval.regionIds.reverse()
    if (change === 'allowance') approval.inputAllowanceAcknowledged = false
    if (change === 'review-path') approval.referenceReview.path = 'input/unreviewed.json'
    if (change === 'review-bytes') await Bun.write(join(f.root, f.plan.referenceReview), '{}')
    if (change === 'review-coverage') {
      const review = await readJson<Record<string, unknown>>(join(f.root, f.plan.referenceReview)); review['referenceSpansAssignedOnce'] = false
      await saveJson(join(f.root, f.plan.referenceReview), review); approval.referenceReview.sha256 = capacityHash(await Bun.file(join(f.root, f.plan.referenceReview)).bytes())
    }
    await saveJson(join(f.root, f.plan.approval), approval)
    await expect(guard(f)).rejects.toThrow()
    expect((await ledger(f)).receipts).toEqual([])
  })
  test('accepts exact inline PNG and controls, settles thoughts plus candidate usage, and forbids repurchase', async () => {
    const f = await fixture(); await approve(f); let calls = 0
    const fetcher = await guard(f, 'header', async request => { calls++; expect(request.redirect).toBe('error'); return response() })
    expect((await inspectOcrCapacityProtocol({ projectRoot: f.root, mappingPath: f.mappingPath })).independentReviewComplete).toBe(true)
    await send(fetcher, await nativeBody(f))
    const saved = await ledger(f), receipt = saved.receipts[0]!
    expect(receipt).toMatchObject({ status: 'settled', reservedCents: 15.744, chargedCents: 0.024, artifactStatus: 'scorable', usage: { inputTokens: 100, outputTokens: 12 } })
    const evidence = receipt['response'] as { path: string, sha256: string }
    expect(capacityHash(await Bun.file(join(f.root, evidence.path)).bytes())).toBe(evidence.sha256)
    await expect(send(fetcher, await nativeBody(f))).rejects.toThrow('may not be repurchased')
    expect(calls).toBe(1)
  })
  for (const change of ['endpoint', 'query', 'extra-field', 'high', 'default-reset', 'output-cap', 'prompt', 'image', 'base64', 'extra-media'] as const) test(`rejects ${change} request before transport or reservation`, async () => {
    const f = await fixture(); await approve(f); let calls = 0
    const fetcher = await guard(f, 'header', async () => { calls++; return response() }), body = await nativeBody(f)
    let url = endpoint
    if (change === 'endpoint') url = 'https://api.x.ai/v1/chat/completions'
    if (change === 'query') url += '?alt=sse'
    if (change === 'extra-field') Object.assign(body, { systemInstruction: { parts: [{ text: 'gold answer' }] } })
    if (change === 'high') body.generationConfig.thinkingConfig.thinkingLevel = 'HIGH'
    if (change === 'default-reset') Object.assign(body.generationConfig, { thinkingConfig: undefined })
    if (change === 'output-cap') body.generationConfig.maxOutputTokens++
    if (change === 'prompt') body.contents[0]!.parts[0]!.text = 'Use provider output as gold'
    if (change === 'image') body.contents[0]!.parts[1]!.inlineData!.data = Buffer.from('different PNG').toString('base64')
    if (change === 'base64') body.contents[0]!.parts[1]!.inlineData!.data += '\n'
    if (change === 'extra-media') body.contents[0]!.parts.push(body.contents[0]!.parts[1]!)
    await expect(send(fetcher, body, url)).rejects.toThrow()
    expect(calls).toBe(0); expect((await ledger(f)).receipts).toEqual([])
  })
  for (const [name, text, finish, classification] of [
    ['empty valid JSON', '{"pages":[{"pageNumber":1,"text":""}]}', 'STOP', 'scorable'],
    ['malformed JSON', '{partial', 'STOP', 'schema-invalid'],
    ['extra JSON fields', '{"pages":[{"pageNumber":1,"text":"x","extra":true}]}', 'STOP', 'schema-invalid'],
    ['native truncation', '{"pages":[{"pageNumber":1,"text":"partial"}]}', 'MAX_TOKENS', 'native-incomplete']
  ] as const) test(`classifies ${name} independently of transport success`, async () => {
    const f = await fixture(); await approve(f)
    const fetcher = await guard(f, 'header', async () => response(text, finish))
    await send(fetcher, await nativeBody(f)); expect((await ledger(f)).receipts[0]).toMatchObject({ status: 'settled', artifactStatus: classification })
    if (classification !== 'schema-invalid') await expect(send(fetcher, await nativeBody(f))).rejects.toThrow('may not be repurchased')
  })
  for (const kind of ['transport', 'server-unknown', 'missing-usage'] as const) test(`retains full ${kind} hold and blocks all further dispatch`, async () => {
    const f = await fixture(); await approve(f)
    const fetcher = await guard(f, 'header', async () => { if (kind === 'transport') throw new Error('socket closed'); return Response.json(kind === 'server-unknown' ? { error: 'server unavailable' } : { candidates: [] }, { status: kind === 'server-unknown' ? 503 : 200 }) })
    try { await send(fetcher, await nativeBody(f)) } catch (error) { expect(kind).toBe('transport'); expect(String(error)).toContain('socket closed') }
    expect((await ledger(f)).receipts[0]).toMatchObject({ status: 'ambiguous', chargedCents: 15.744 })
    const other = await guard(f, 'left'); await expect(send(other, await nativeBody(f, 'left'))).rejects.toThrow('pending reconciliation')
  })
  for (const [input, candidate, thoughts] of [[64001, 10, 2], [100, 8190, 3]] as const) test(`usage breach ${input}/${candidate}+${thoughts} stops dispatch and retains reservation`, async () => {
    const f = await fixture(); await approve(f)
    const fetcher = await guard(f, 'header', async () => response(undefined, 'STOP', input, candidate, thoughts))
    await expect(send(fetcher, await nativeBody(f))).rejects.toThrow('exceeded the reviewed allowance')
    expect((await ledger(f)).receipts[0]).toMatchObject({ status: 'breach', chargedCents: 15.744 })
    await expect(send(fetcher, await nativeBody(f))).rejects.toThrow('pending reconciliation')
  })
  test('permits only three total schema attempts and hashes cumulative receipts', async () => {
    const f = await fixture(); await approve(f); let calls = 0
    const fetcher = await guard(f, 'header', async () => { calls++; return response('{invalid') })
    for (let i = 0; i < 3; i++) await send(fetcher, await nativeBody(f))
    await expect(send(fetcher, await nativeBody(f))).rejects.toThrow('attempt limit')
    const receipts = (await ledger(f)).receipts
    expect(receipts).toHaveLength(3); expect(receipts[1]!['previousSha256']).toBe(receipts[0]!['sha256']); expect(calls).toBe(3)
  })
  test('accounts for every region at the complete input/output reservation without resetting cumulative spend', async () => {
    const f = await fixture(); await approve(f); let calls = 0
    for (const region of f.plan.regions) {
      const fetcher = await guard(f, region.id, async () => { calls++; return response('{invalid', 'STOP', 64000, 8000, 192) })
      for (let attempt = 0; attempt < 3; attempt++) await send(fetcher, await nativeBody(f, region.id))
      await expect(send(fetcher, await nativeBody(f, region.id))).rejects.toThrow('attempt limit')
    }
    const saved = await ledger(f)
    expect(calls).toBe(9); expect(saved.receipts).toHaveLength(9)
    expect(Math.round(saved.receipts.reduce((sum, r) => sum + Number(r['chargedCents']), 0) * 1e6) / 1e6).toBe(141.696)
    expect(saved.budgetCents).toBe(142)
  })
  for (const kind of ['receipt', 'response', 'approval-revocation', 'review-revocation', 'ledger-budget'] as const) test(`rejects ${kind} tampering before a second mocked dispatch`, async () => {
    const f = await fixture(); await approve(f); let calls = 0
    const fetcher = await guard(f, 'header', async () => { calls++; return response('{invalid') })
    await send(fetcher, await nativeBody(f))
    const saved = await ledger(f)
    if (kind === 'receipt') { saved.receipts[0]!['chargedCents'] = 0; await saveJson(join(f.root, f.plan.ledger), saved) }
    if (kind === 'response') await Bun.write(join(f.root, (saved.receipts[0]!['response'] as { path: string }).path), '{}')
    if (kind === 'approval-revocation') await Bun.write(join(f.root, f.plan.approval), '{}')
    if (kind === 'review-revocation') await Bun.write(join(f.root, f.plan.referenceReview), '{}')
    if (kind === 'ledger-budget') { saved.budgetCents++; await saveJson(join(f.root, f.plan.ledger), saved) }
    await expect(send(fetcher, await nativeBody(f))).rejects.toThrow(); expect(calls).toBe(1)
  })
  for (const pin of ['publisher-reference', 'protected-runtime', 'other-region', 'mapping'] as const) test(`rechecks ${pin} pins after guard construction and before reservation`, async () => {
    const f = await fixture(); await approve(f); let calls = 0
    const fetcher = await guard(f, 'header', async () => { calls++; return response() }), body = await nativeBody(f)
    const path = pin === 'publisher-reference' ? f.mapping.sourceReference.path : pin === 'protected-runtime' ? f.mapping.protectedArtifacts[0]!.path
      : pin === 'other-region' ? f.plan.regions[1]!.input : f.mappingPath
    await Bun.write(join(f.root, path), 'changed after guard construction')
    await expect(send(fetcher, body)).rejects.toThrow('pinned source, reference or runtime scope changed')
    expect(calls).toBe(0); expect((await ledger(f)).receipts).toEqual([])
  })
  test('one in-flight reservation blocks another region and settles without losing the first receipt', async () => {
    const f = await fixture(); await approve(f)
    let finish!: () => void, started!: () => void
    const arrived = new Promise<void>(resolve => { started = resolve }), pending = new Promise<void>(resolve => { finish = resolve })
    const first = await guard(f, 'header', async () => { started(); await pending; return response() }), second = await guard(f, 'left')
    const inFlight = send(first, await nativeBody(f)); await arrived
    await expect(send(second, await nativeBody(f, 'left'))).rejects.toThrow('pending reconciliation')
    finish(); await inFlight
    expect((await ledger(f)).receipts).toHaveLength(1); expect((await ledger(f)).receipts[0]!['status']).toBe('settled')
  })
  for (const effort of ['low', undefined, 'default', 'minimal'] as const) test(`actual Gemini adapter ${effort ?? 'omitted'} effort dispatches only effective LOW; reset and unsupported controls reject`, async () => {
    const f = await fixture(); await approve(f); let calls = 0
    process.env['GEMINI_API_KEY'] = 'synthetic-no-provider-key'
    globalThis.fetch = await guard(f, 'header', async request => {
      calls++; expect(new URL(request.url).pathname).toBe('/v1beta/models/gemini-3.8-flash:generateContent')
      const body = await request.json() as { generationConfig: Record<string, unknown> }
      expect(body.generationConfig).toMatchObject({ maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'LOW' } })
      return response()
    })
    const result = runGeminiOcr(join(f.root, f.plan.regions[0]!.input), { slug: 'fixture', format: 'png', pageCount: 1, fileSize: 80 }, 'gemini-3.8-flash', effort ? { reasoningEffort: effort } : {})
    if (effort === 'low' || effort === undefined) { expect((await result).pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'fixture' }]); expect(calls).toBe(1) }
    else { await expect(result).rejects.toThrow(); expect(calls).toBe(0); expect((await ledger(f)).receipts).toEqual([]) }
  })
  test('actual Gemini schema retry uses only the pinned retry prompt and cumulative allowance', async () => {
    const f = await fixture(); await approve(f); let calls = 0
    process.env['GEMINI_API_KEY'] = 'synthetic-no-provider-key'
    globalThis.fetch = await guard(f, 'header', async request => {
      calls++
      const body = await request.json() as { contents: { parts: { text?: string }[] }[] }
      if (calls === 2) expect(body.contents[0]!.parts[0]!.text).toBe('Return only valid JSON for this single OCR page.\nUse exactly this shape: {"pages":[{"pageNumber":1,"text":"..."}]}.\nDo not include markdown, explanations, extra keys, or text outside the JSON object.')
      return calls === 1 ? response('{invalid') : response()
    })
    const result = await runGeminiOcr(join(f.root, f.plan.regions[0]!.input), { slug: 'fixture', format: 'png', pageCount: 1, fileSize: 80 }, 'gemini-3.8-flash', { reasoningEffort: 'low' })
    expect(result.pages).toHaveLength(1); expect(calls).toBe(2)
    expect((await ledger(f)).receipts.map(r => r['artifactStatus'])).toEqual(['schema-invalid', 'scorable'])
  })
})
