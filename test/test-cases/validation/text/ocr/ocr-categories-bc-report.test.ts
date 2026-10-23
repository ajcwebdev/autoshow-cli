import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { bcExactCharacterDistance, buildBcOcrReports, inspectBcOcrReports, scoreBcOcrFidelity } from '~/tools/ocr-categories-bc-report'
import type { BcOcrReportOptions } from '~/tools/ocr-categories-bc-report'
import { normalizeHistoricalReference } from '~/tools/ocr-preparation/prepare-historical-newspapers'
import { redDotPng } from '../../../../test-utils/media-fixtures'
import { charLevenshteinDistance } from '../../../../../.codex/skills/consensus/scripts/ocr/ocr_consensus_lib'

const localRoot = 'input/examples/document/ocr-categories-bc-run'
const secret = 'PRIVATE_REFERENCE_AND_PROVIDER_TEXT_MUST_NOT_BE_PUBLISHED'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

const fixture = async (fixtureOptions: { mistralZeroBased?: boolean } = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-bc-report-')); roots.push(root)
  const write = async (path: string, value: unknown) => {
    const serialized = typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)
    await mkdir(dirname(join(root, path)), { recursive: true })
    await Bun.write(join(root, path), serialized)
    return serialized
  }
  const targets = [{ provider: 'tesseract', model: 'tesseract' }, fixtureOptions.mistralZeroBased ? { provider: 'mistral', model: 'mistral-ocr-4-1' } : { provider: 'deepinfra', model: 'fixture/model' }, { provider: 'openai', model: 'partial-model' }]
  const cases = [], pages = [], receipts = [], slotPaths: string[] = []
  for (const [index, id] of ['technical-code-fixture', 'historical-print-fixture', 'bc-rerun-fixture'].entries()) {
    const pageCount = index === 2 ? 2 : 1
    const category = index === 1 ? 'historical-print' as const : 'technical-code' as const
    const input = `${localRoot}/inputs/${id}.png`, reference = `${localRoot}/references/${id}.txt`
    const texts = Array.from({ length: pageCount }, (_, page) => `${secret} ${page + 1}\nif (x == "A") {\n\treturn value;\n}\n`)
    const referenceText = index === 2 ? texts.map((text, i) => `--- Page ${i + 1} ---\n${text}`).join('\n\n') : texts[0]!
    await write(input, redDotPng); await write(reference, referenceText)
    const entry = { id, category, input, inputSha256: hash(redDotPng), reference, referenceSha256: hash(referenceText),
      referenceKind: index === 2 ? 'existing-consensus' as const : 'publisher-canonical' as const,
      sourceURL: 'https://example.org/image', annotationURL: 'https://example.org/annotation', sourceRevision: 'pinned-fixture-v1',
      runDir: `docs/benchmarks/text/ocr/${id}`, pages: [] as string[],
      ...(index === 1 ? { normalizedReference: `${reference}.normalized`, normalizedReferenceSha256: hash(normalizeHistoricalReference(referenceText)) } : {}) }
    if (entry.normalizedReference) await write(entry.normalizedReference, normalizeHistoricalReference(referenceText))
    cases.push(entry)
    for (let number = 1; number <= pageCount; number++) {
      const page = { id: `${id}-page-${String(number).padStart(2, '0')}`, caseId: id, pageNumber: number,
        input: `${localRoot}/pages/${id}-${number}.png`, inputSha256: hash(redDotPng), width: 1, height: 1 }
      pages.push(page); entry.pages.push(page.id); await write(page.input, redDotPng)
      for (const target of targets) {
        const directory = `${localRoot}/slots/${page.id}/${`${target.provider}-${target.model}`.replace(/[^a-zA-Z0-9_.-]/g, '-')}`
        slotPaths.push(directory)
        const status = target.provider === 'openai' && number === pageCount ? 'failed' : 'succeeded'
        let manifestSha256: string | null = null
        if (status === 'succeeded') {
          const result = { text: `Page 1\n${texts[number - 1]}`, pages: [{ pageNumber: fixtureOptions.mistralZeroBased && target.provider === 'mistral' ? 0 : 1, method: 'ocr', text: texts[number - 1] }], totalPages: 1 }
          const manifest = { command: 'extract', scope: 'single', items: [{ extractRoute: 'document', metadata: { source: { filePath: page.input } }, providers: [{ service: target.provider,
            model: target.model, artifactDir: '.', status, options: { apiKey: secret }, metadata: { processingTime: 125, rawResponse: secret }, result }] }] }
          manifestSha256 = hash(String(await write(`${directory}/manifest.json`, manifest)))
          await write(`${directory}/result.json`, result)
          await write(`${directory}/extraction.txt`, `Page 1\n${texts[number - 1]}`)
        } else await write(`${directory}/failure.txt`, `Bearer ${secret} raw failure`)
        await write(`${directory}/dispatch.json`, { caseId: page.id, documentCaseId: id, provider: target.provider, model: target.model,
          inputSha256: page.inputSha256, referenceSha256: entry.referenceSha256, directory, status, startedAt: '2026-10-23T06:00:00Z', manifestSha256 })
        if (target.provider !== 'tesseract') receipts.push({ id: `${page.id}-${target.provider}`, invocationId: `${page.id}-${target.provider}`, caseId: page.id, documentCaseId: id,
          provider: target.provider, model: target.model, inputSha256: page.inputSha256, reservedCents: 3.968, chargedCents: status === 'succeeded' ? 0.25 : 3.968,
          status: status === 'succeeded' ? 'settled' : 'ambiguous', httpStatus: status === 'succeeded' ? 200 : 503, createdAt: '2026-10-23T06:00:01Z' })
      }
    }
  }
  const plan = { schemaVersion: 1, kind: 'ocr-categories-bc-execution-plan', approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30' }, cases, pages, targets }
  const planBytes = await write(`${localRoot}/execution-plan.json`, plan)
  const ledger = { schemaVersion: 1, kind: 'ocr-categories-bc-spending-ledger', budgetCents: 3000, planSha256: hash(String(planBytes)), receipts }
  await write(`${localRoot}/spending-ledger.json`, ledger)
  const commands: string[][] = []
  const options: BcOcrReportOptions = { projectRoot: root, runConsensus: async argv => {
    commands.push([...argv])
    if (argv[1] !== 'build-report') return
    const manifest = await Bun.file(join(argv[2]!, 'manifest.json')).json()
    const providers = manifest.items[0].providers.filter((p: { status: string }) => p.status === 'succeeded').map((p: { service: string, model: string }) => ({ providerKey: `${p.service}/${p.model}` }))
    await Bun.write(argv[argv.indexOf('--json-out') + 1]!, JSON.stringify({ providerGroups: { local: { providers } }, metricRankings: { local: { price: providers } }, notes: [] }))
    await Bun.write(argv[argv.indexOf('--markdown-out') + 1]!, '# Fixture report\n')
  } }
  return { root, write, cases, pages, targets, slotPaths, receipts, plan, ledger, options, commands }
}

describe('B/C saved-page OCR report assembly', () => {
  test('normalizes Mistral zero-based single-page indices to approved document pages while preserving original bytes', async () => {
    const f = await fixture({ mistralZeroBased: true }), entry = f.cases[2]!
    const original = f.slotPaths.find(path => path.includes(`${entry.id}-page-01/mistral-`))!
    const before = await Bun.file(join(f.root, `${original}/result.json`)).bytes()
    expect((await Bun.file(join(f.root, `${original}/result.json`)).json()).pages[0].pageNumber).toBe(0)
    await buildBcOcrReports(f.options)
    const combined = await Bun.file(join(f.root, `${localRoot}/benchmark-runs/${entry.id}/providers/mistral-mistral-ocr-4-1/result.json`)).json()
    expect(combined.pages.map((page: { pageNumber: number }) => page.pageNumber)).toEqual([1, 2])
    expect(await Bun.file(join(f.root, `${original}/result.json`)).bytes()).toEqual(before)
    expect((await Bun.file(join(f.root, `${entry.runDir}/case-metadata.json`)).json()).coverage.successfulModels).toBe(2)
  })
  test('rejects zero-based or out-of-range indices from other providers even when artifacts are consistently rehashed', async () => {
    for (const provider of ['tesseract', 'deepinfra', 'openai']) for (const index of [0, 2]) {
      const f = await fixture()
      const directory = f.slotPaths.find(path => path.includes(`${f.cases[2]!.id}-page-01/${provider}-`))!
      const manifest = await Bun.file(join(f.root, `${directory}/manifest.json`)).json()
      manifest.items[0].providers[0].result.pages[0].pageNumber = index
      await f.write(`${directory}/result.json`, manifest.items[0].providers[0].result)
      const manifestBytes = await f.write(`${directory}/manifest.json`, manifest)
      const journal = await Bun.file(join(f.root, `${directory}/dispatch.json`)).json()
      await f.write(`${directory}/dispatch.json`, { ...journal, manifestSha256: hash(String(manifestBytes)) })
      await expect(buildBcOcrReports(f.options)).rejects.toThrow('exactly one nonempty page')
      expect(f.commands).toHaveLength(0)
    }
  })
  test('read-only inspection separates successful pages, full-document coverage and uncertain reservations', async () => {
    const f = await fixture()
    const before = await Bun.file(join(f.root, `${localRoot}/execution-plan.json`)).text()
    const result = await inspectBcOcrReports(f.options)
    expect(result.cases).toHaveLength(3)
    expect(result.cases[2]).toMatchObject({ successfulModels: 2, successfulPageSlots: 5, expectedPageSlots: 6, failedModels: 1, pendingModels: 0 })
    expect(result.spending).toMatchObject({ reviewedUsageCents: 1.25, heldReservationCents: 11.904, accountedCents: 13.154 })
    expect(f.commands).toHaveLength(0)
    expect(await Bun.file(join(f.root, `${localRoot}/execution-plan.json`)).text()).toBe(before)
  })
  test('build preserves private evidence, publishes no source content and excludes incomplete documents from full scores', async () => {
    const f = await fixture()
    const saved = await Bun.file(join(f.root, `${f.slotPaths[0]}/manifest.json`)).text()
    await buildBcOcrReports(f.options)
    expect(f.commands).toHaveLength(6)
    const entry = f.cases[2]!
    const published = await Bun.file(join(f.root, `${entry.runDir}/manifest.json`)).text()
    const manifest = JSON.parse(published)
    expect(published).not.toContain(secret)
    expect(manifest.reference).toBeUndefined()
    expect(manifest.source.reference.kind).toBe('existing-consensus')
    expect(manifest.items[0].providers).toHaveLength(3)
    expect(manifest.items[0].providers.every((p: Record<string, unknown>) => !('result' in p))).toBe(true)
    expect(manifest.items[0].providers.find((p: { service: string }) => p.service === 'openai').status).toBe('failed')
    expect(await Bun.file(join(f.root, `${localRoot}/benchmark-runs/${entry.id}/providers/openai-partial-model/result.json`)).exists()).toBe(false)
    const combined = await Bun.file(join(f.root, `${localRoot}/benchmark-runs/${entry.id}/providers/deepinfra-fixture%2Fmodel/result.json`)).json()
    expect(combined.pages.map((page: { pageNumber: number }) => page.pageNumber)).toEqual([1, 2])
    expect(combined.pages[0].text).toContain(secret)
    expect(await Bun.file(join(f.root, `${f.slotPaths[0]}/manifest.json`)).text()).toBe(saved)
    const fidelity = await Bun.file(join(f.root, `${entry.runDir}/fidelity-metrics.json`)).text()
    expect(fidelity).not.toContain(secret)
    expect(JSON.parse(fidelity).providers).toHaveLength(2)
    expect(JSON.parse(fidelity).providers.every((p: { strictTextExact: boolean }) => p.strictTextExact)).toBe(true)
    const publisher = await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).json()
    expect(publisher.reference.kind).toBe('publisher-canonical')
    const report = await Bun.file(join(f.root, `${entry.runDir}/provider-comparison-report.json`)).json()
    expect(report.coverage.failedModels).toBe(1)
    expect(report.notes.join(' ')).toContain('not invoice-reconciled')
  })
  test('a second local build archives the previous assembly instead of destroying saved results', async () => {
    const f = await fixture()
    await buildBcOcrReports(f.options)
    const path = `${localRoot}/benchmark-runs/${f.cases[0]!.id}/marker.bin`
    await f.write(path, 'preserve previous derived assembly')
    await buildBcOcrReports(f.options)
    const backups = Array.from(new Bun.Glob(`${localRoot}/prior-assemblies/**/marker.bin`).scanSync({ cwd: f.root }))
    expect(backups).toHaveLength(1)
    expect(await Bun.file(join(f.root, backups[0]!)).text()).toBe('preserve previous derived assembly')
  })
  test('changed input/reference bytes and changed plan authorization fail before public writes', async () => {
    for (const kind of ['input', 'reference', 'plan'] as const) {
      const f = await fixture()
      if (kind === 'plan') await f.write(`${localRoot}/execution-plan.json`, { ...f.plan, extra: 'unauthorized change' })
      else await f.write(f.cases[0]![kind], 'changed')
      await expect(buildBcOcrReports(f.options)).rejects.toThrow(kind === 'plan' ? 'spending-ledger authorization' : 'hash changed')
      expect(f.commands).toHaveLength(0)
    }
  })
  test('incomplete journals defer builds and malformed success artifacts cannot become OCR scores', async () => {
    const f = await fixture(), path = `${f.slotPaths[0]}/dispatch.json`
    const journal = await Bun.file(join(f.root, path)).json()
    await f.write(path, { ...journal, status: 'dispatch-started', manifestSha256: null })
    await expect(buildBcOcrReports(f.options)).rejects.toThrow('not journal-pinned')
    expect(f.commands).toHaveLength(0)
    const clean = await fixture(), resultPath = `${clean.slotPaths[0]}/result.json`
    await clean.write(resultPath, { pages: [] })
    await expect(buildBcOcrReports(clean.options)).rejects.toThrow('inline and sidecar')
    expect(clean.commands).toHaveLength(0)
  })
  test('a successful hosted page requires usage admitted during that invocation', async () => {
    const f = await fixture()
    for (const receipt of f.ledger.receipts) receipt.createdAt = '2026-10-22T00:00:00Z'
    await f.write(`${localRoot}/spending-ledger.json`, f.ledger)
    await expect(buildBcOcrReports(f.options)).rejects.toThrow('current-attempt receipt')
    expect(f.commands).toHaveLength(0)
  })
  test('symlink-escaping references are rejected even with an otherwise matching approved digest', async () => {
    const f = await fixture(), outside = await mkdtemp(join(tmpdir(), 'autoshow-bc-outside-')); roots.push(outside)
    const reference = f.cases[0]!.reference
    await Bun.write(join(outside, 'text.txt'), await Bun.file(join(f.root, reference)).text())
    await rm(join(f.root, reference)); await symlink(join(outside, 'text.txt'), join(f.root, reference))
    await expect(buildBcOcrReports(f.options)).rejects.toThrow('escapes project root')
    expect(f.commands).toHaveLength(0)
  })
  test('real local consensus generation scores full documents and exposes separate fidelity without publishing raw text', async () => {
    const f = await fixture()
    await mkdir(join(f.root, 'src/cli/commands/setup-and-utilities'), { recursive: true })
    await symlink(resolve('src/cli/commands/setup-and-utilities/models'), join(f.root, 'src/cli/commands/setup-and-utilities/models'), 'dir')
    const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`
    const bin = join(f.root, 'bin'); await mkdir(bin)
    await Bun.write(join(bin, 'bun'), `#!/bin/sh\nAUTOSHOW_PROJECT_ROOT=${shellQuote(f.root)} exec ${shellQuote(process.execPath)} "$@"\n`)
    await chmod(join(bin, 'bun'), 0o755)
    await buildBcOcrReports({ projectRoot: f.root, runConsensus: async argv => {
      const child = Bun.spawn([process.execPath, 'scripts/run.ts', ...argv], { cwd: resolve('.codex/skills/consensus'), env: { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`, AUTOSHOW_PROJECT_ROOT: f.root }, stdout: 'pipe', stderr: 'pipe' })
      const [, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      if (code !== 0) throw new Error(`Local skill fixture failed: ${stderr}`)
    } })
    const entry = f.cases[2]!
    const report = await Bun.file(join(f.root, `${entry.runDir}/provider-comparison-report.json`)).json()
    expect(report.providerGroups.local.providers).toHaveLength(1)
    expect(report.providerGroups.thirdPartyService.providers).toHaveLength(1)
    expect(report.providerGroups.thirdPartyService.providers[0].metrics.wer).toBe(0)
    expect(report.providerGroups.thirdPartyService.providers[0].costCents).toBe(0.5)
    expect(report.referenceProvenance.independentOfProviders).toBe(false)
    expect(JSON.stringify(report)).not.toContain(secret)
    const publisher = await Bun.file(join(f.root, `${f.cases[0]!.runDir}/provider-comparison-report.json`)).json()
    expect(publisher.referenceProvenance.independentOfProviders).toBe(true)
    expect(await Bun.file(join(f.root, `${entry.runDir}/page-metrics.json`)).exists()).toBe(true)
  })
})

describe('B/C fidelity diagnostics', () => {
  const gold = 'if (args[0] == "--") {\n\treturn value;\n}\n'
  for (const [name, candidate] of [
    ['operator', gold.replace('==', '=')],
    ['quote', gold.replace('"--"', "'--'")],
    ['identifier', gold.replace('value', 'va1ue')],
    ['case', gold.replace('args', 'Args')]
  ]) test(`detects consequential code ${name} mutations that prose normalization can conceal`, () => {
    const score = scoreBcOcrFidelity(gold, candidate!, 'technical-code')
    expect(score.strictTextExact).toBe(false)
    expect('codeTokensExact' in score && score.codeTokensExact).toBe(false)
    expect('codeTokenErrorRate' in score && score.codeTokenErrorRate).toBeGreaterThan(0)
    expect(score.strictCharacterErrorRate).toBeGreaterThan(0)
  })
  test('separates whitespace/indentation changes from case-sensitive code token recognition', () => {
    const score = scoreBcOcrFidelity(gold, gold.replace('\t', '    '), 'technical-code')
    expect('codeTokensExact' in score && score.codeTokensExact).toBe(true)
    expect('indentationExact' in score && score.indentationExact).toBe(false)
    expect(score.strictTextExact).toBe(false)
    expect(scoreBcOcrFidelity(gold, gold.replaceAll('\n', '\r\n'), 'technical-code').strictTextExact).toBe(true)
  })
  test('historical diplomatic errors remain distinct from declared reading normalization', () => {
    const score = scoreBcOcrFidelity('A ſmall ﬁre—“warm”.\n', 'A small fire-"warm".\n', 'historical-print')
    expect(score.strictCharacterErrorRate).toBeGreaterThan(0)
    expect('readingNormalizedCharacterErrorRate' in score && score.readingNormalizedCharacterErrorRate).toBe(0)
    expect(scoreBcOcrFidelity('A ſmall ﬁre.\n', 'A invented ſmall ﬁre.\n', 'historical-print').strictCharacterErrorRate).toBeGreaterThan(0)
  })
})

describe('exact Unicode supplemental character distance', () => {
  test('matches the existing exact implementation on randomized Unicode code-point sequences', () => {
    const alphabet = ['a', 'B', ' ', '\t', '\n', 'é', 'e', '\u0301', '😀', '𐐀', 'ſ', 'ﬁ', '\ud800', '\udc00']
    let state = 0x5b39e712
    const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x1_0000_0000 }
    const sample = () => Array.from({ length: Math.floor(random() * 65) }, () => alphabet[Math.floor(random() * alphabet.length)]!).join('')
    for (let index = 0; index < 300; index++) {
      const left = sample(), right = sample()
      const expected = charLevenshteinDistance(left, right)
      expect(bcExactCharacterDistance(left, right)).toBe(expected)
      expect(bcExactCharacterDistance(right, left)).toBe(expected)
    }
  })
  test('retains exact distance through common Unicode prefix/suffix trimming and empty residuals', () => {
    const prefix = '😀prefixé\n'.repeat(1000), suffix = '𐐀suffix\t'.repeat(1000)
    for (const [left, right] of [['', ''], ['a', ''], ['', 'abc'], ['😀', 'é'], ['a😀b', 'a𐐀b'], ['e\u0301', 'é'], ['keep', 'keep extra']]) {
      expect(bcExactCharacterDistance(prefix + left + suffix, prefix + right + suffix)).toBe(charLevenshteinDistance(left!, right!))
    }
  })
  test('expands the band for distant edits and falls back to full exact rows for dissimilar strings', () => {
    const cases = [
      ['A' + 'abcd'.repeat(120) + 'Z', 'B' + 'abXX'.repeat(120) + 'Y'],
      ['a'.repeat(100), 'b'.repeat(100)],
      ['ab'.repeat(70), '😀ab'.repeat(70)],
      ['X' + 'mid'.repeat(80) + 'Y', 'Z' + 'mid'.repeat(80) + 'W'],
      ['abc', 'Z'.repeat(100) + 'abc' + 'Y'.repeat(100)]
    ]
    for (const [left, right] of cases) expect(bcExactCharacterDistance(left!, right!)).toBe(charLevenshteinDistance(left!, right!))
  })
})
