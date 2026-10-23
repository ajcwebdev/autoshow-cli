import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { buildEfgOcrReports, inspectEfgOcrReports, scoreEfgNumericFidelity, scoreEfgOcrFidelity, validateEfgOcrStructure } from '~/tools/ocr-categories-efg-report'
import { bcExactCharacterDistance, inspectBcOcrReports } from '~/tools/ocr-categories-bc-report'
import { canonicalizeTable, serializeTableReference } from '~/tools/ocr-preparation/prepare-code-tables'
import { normalizeHistoricalReference } from '~/tools/ocr-preparation/prepare-historical-newspapers'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const base = 'input/examples/document/ocr-categories-efg-run'
const secret = 'Privatefixture'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

const exampleTable = () => canonicalizeTable({ filename: 'fixture.png', html: { structure: { tokens: ['<table>', '<tr>', '<td>', '</td>', '<td>', '</td>', '</tr>', '</table>'] },
  cells: [{ tokens: [secret] }, { tokens: ['-$1,234.50'] }] } })

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-efg-report-')); roots.push(root)
  const write = async (path: string, value: unknown) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    const serialized = typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)
    await Bun.write(join(root, path), serialized)
    return serialized
  }
  const jpeg = await new Bun.Image(redDotPng).jpeg().bytes()
  const targets = [{ provider: 'tesseract', model: 'tesseract' }, { provider: 'openai', model: 'gpt-6-luna' }]
  const table = exampleTable()
  const specs = [
    { id: 'numeric-tables-fixture', category: 'numeric-tables', text: serializeTableReference(table), structure: table },
    { id: 'handwriting-manuscript-fixture', category: 'handwriting', text: `${secret} Deleted retained.\n`, reading: `${secret} retained.\n`,
      structure: { kind: 'reviewed-manuscript', asset: 'fixture-asset', includesPrintedHeadings: true, deletedWordsRetained: ['Deleted'], originalEditorialNotation: ['[Deleted]'] } },
    { id: 'handwriting-table-fixture', category: 'handwriting', text: `${secret}\n\nHeading\n\nOne\tTwo\n`,
      structure: { kind: 'table', headings: [secret, 'Heading'], rows: 1, columns: 2, cells: [['One', 'Two']], readingOrder: 'row-major; drawing separators excluded' } },
    { id: 'handwriting-flowchart-fixture', category: 'handwriting', text: `${secret}\n\nHeading\n\nQuestion?\n\nY\tN\nYes label\tNo label\n`,
      structure: { kind: 'flowchart', title: secret, heading: 'Heading', nodes: [{ id: 'question', text: 'Question?', shape: 'unboxed' },
        { id: 'yes', text: 'Yes label', shape: 'rectangle' }, { id: 'no', text: 'No label', shape: 'rectangle' }],
        edges: [{ from: 'question', to: 'yes', label: 'Y' }, { from: 'question', to: 'no', label: 'N' }], readingOrder: 'top to bottom, then left to right' } },
    { id: 'handwriting-prose-fixture', category: 'handwriting', text: `${secret} → Heading\n`, structure: { kind: 'prose', literalArrowInHeading: true } },
    { id: 'newspapers-fixture', category: 'newspapers', text: `${secret} ſhort ﬁeld “text”—1835.\n`,
      structure: { sourceId: 'G-fixture', sourceRevision: 'annotation-v2', imageSize: { width: 1, height: 1 }, readingOrder: ['supplied article region top-to-bottom'], errata: [] } },
    { id: 'efg-rerun-financial-fixture', category: 'numeric-tables', text: `${secret} baseline 10.50\n`, jpeg: true },
    { id: 'efg-rerun-newspaper-fixture', category: 'newspapers', text: `${secret} baseline historical text\n`, pdf: true }
  ]
  const cases = [], pages = [], receipts = []
  for (const spec of specs) {
    const input = `${base}/inputs/${spec.id}.${spec.jpeg ? 'jpg' : spec.pdf ? 'pdf' : 'png'}`
    const inputBytes = spec.jpeg ? jpeg : spec.pdf ? new TextEncoder().encode('%PDF-fixture-source-pin') : redDotPng
    const pageInput = spec.pdf ? `${base}/pages/${spec.id}.png` : input
    const pageBytes = spec.pdf ? redDotPng : inputBytes
    const reference = `${base}/references/${spec.id}.txt`, structuredReference = `${base}/references/${spec.id}.json`
    const referenceText = spec.id.startsWith('efg-rerun-') ? `--- Page 1 ---\n${spec.text}` : spec.text
    await write(input, inputBytes); if (spec.pdf) await write(pageInput, pageBytes)
    await write(reference, referenceText)
    const structureBytes = spec.structure ? JSON.stringify(spec.structure) : undefined
    if (structureBytes) await write(structuredReference, structureBytes)
    const normalizedReference = spec.category === 'newspapers' && spec.structure ? `${reference}.normalized` : undefined
    if (normalizedReference) await write(normalizedReference, normalizeHistoricalReference(referenceText))
    const readingReference = spec.reading ? `${reference}.reading` : undefined
    if (readingReference) await write(readingReference, spec.reading)
    const page = { id: `${spec.id}-page-01`, caseId: spec.id, pageNumber: 1, input: pageInput, inputSha256: hash(pageBytes), width: 1, height: 1 }
    const entry = { id: spec.id, category: spec.category, input, inputSha256: hash(inputBytes), reference, referenceSha256: hash(referenceText),
      referenceKind: spec.structure ? 'publisher-canonical' : 'existing-consensus', sourceURL: 'https://example.org/image-v1', sourceRevision: 'image-v1',
      annotationURL: 'https://example.org/annotation-v2', annotationRevision: 'annotation-v2', runDir: `docs/benchmarks/ocr/${spec.id}`, scope: spec.category === 'newspapers' ? 'region-crop' : 'full-page',
      sourceFamily: 'Independent fixture publisher', synthetic: spec.category === 'numeric-tables', serializationPolicy: 'Declared lexical order; TSV/drawing layout is a separate representation.',
      ...(structureBytes ? { structuredReference, structuredReferenceSha256: hash(structureBytes) } : {}),
      ...(normalizedReference ? { normalizedReference, normalizedReferenceSha256: hash(normalizeHistoricalReference(referenceText)) } : {}),
      ...(readingReference && spec.reading ? { readingReference, readingReferenceSha256: hash(spec.reading) } : {}), pages: [page] }
    cases.push(entry); pages.push(page)
    for (const target of targets) {
      const directory = `${base}/slots/${page.id}/${target.provider}-${target.model}`
      const body = target.provider === 'tesseract' && spec.id === 'handwriting-prose-fixture' ? '' : spec.text
      const result = { text: `Page 1\n${body}`, pages: [{ pageNumber: 1, method: 'ocr', text: body }], totalPages: 1 }
      const manifest = { command: 'extract', scope: 'single', items: [{ extractRoute: 'document', metadata: { source: { filePath: pageInput } }, providers: [{ service: target.provider,
        model: target.model, artifactDir: '.', status: 'succeeded', options: { apiKey: secret }, metadata: { processingTime: 90, rawResponse: secret }, result }] }] }
      const manifestBytes = await write(`${directory}/manifest.json`, manifest)
      await write(`${directory}/result.json`, result); await write(`${directory}/extraction.txt`, result.text)
      await write(`${directory}/dispatch.json`, { caseId: page.id, documentCaseId: spec.id, provider: target.provider, model: target.model,
        inputSha256: page.inputSha256, referenceSha256: entry.referenceSha256, directory, status: 'succeeded', startedAt: '2026-10-23T12:00:00Z', manifestSha256: hash(String(manifestBytes)) })
      if (target.provider !== 'tesseract') receipts.push({ id: `${spec.id}-${target.provider}`, invocationId: `${spec.id}-${target.provider}`, caseId: page.id, documentCaseId: spec.id,
        provider: target.provider, model: target.model, inputSha256: page.inputSha256, status: 'settled', reservedCents: 5, chargedCents: 0.25, httpStatus: 200, createdAt: '2026-10-23T12:00:01Z' })
    }
  }
  const plan = { schemaVersion: 1, kind: 'ocr-categories-efg-execution-plan', approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30 for categories 5–7' }, cases, pages, targets }
  const planBytes = await write(`${base}/execution-plan.json`, plan)
  const ledger = { schemaVersion: 1, kind: 'ocr-categories-efg-spending-ledger', budgetCents: 3000, planSha256: hash(String(planBytes)), receipts }
  await write(`${base}/spending-ledger.json`, ledger)
  await mkdir(join(root, 'src/cli/commands/setup-and-utilities'), { recursive: true })
  await symlink(resolve('src/cli/commands/setup-and-utilities/models'), join(root, 'src/cli/commands/setup-and-utilities/models'), 'dir')
  const quote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`
  const bin = join(root, 'bin'); await mkdir(bin)
  await Bun.write(join(bin, 'bun'), `#!/bin/sh\nAUTOSHOW_PROJECT_ROOT=${quote(root)} exec ${quote(process.execPath)} "$@"\n`)
  await chmod(join(bin, 'bun'), 0o755)
  const env = { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`, AUTOSHOW_PROJECT_ROOT: root }
  const options = { projectRoot: root, runConsensus: async (argv: readonly string[]) => {
    const child = Bun.spawn([process.execPath, 'scripts/run.ts', ...argv], { cwd: resolve('.codex/skills/consensus'), env, stdout: 'pipe', stderr: 'pipe' })
    const [, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    if (code !== 0) throw new Error(`Local skill fixture failed: ${stderr}`)
  } }
  return { root, write, plan, ledger, cases, options, env }
}

describe('EFG literal and structured-reference diagnostics', () => {
  test('retains signs, decimal punctuation, grouping, duplicates and negative parentheses without numeric-value equivalence', () => {
    const gold = '-$1,234.50 10% (23) 5 5'
    const exact = scoreEfgNumericFidelity(gold, gold)
    expect(exact).toMatchObject({ referenceLiteralNumberCount: 5, literalNumberSequenceExact: true, literalNumberSequenceErrorRate: 0, literalNumberMultisetCoverage: 1 })
    const changed = scoreEfgNumericFidelity(gold, '$1234.50 10 (23) 5')
    expect(changed).toMatchObject({ matchedLiteralNumberCount: 2, missingLiteralNumberCount: 3, referenceLiteralNumberCount: 5, literalNumberMultisetCoverage: 2 / 5 })
    expect(scoreEfgNumericFidelity('1 2 1', '1 1 2')).toMatchObject({ literalNumberSequenceExact: false, literalNumberMultisetCoverage: 1 })
    expect(scoreEfgNumericFidelity('No numbers', '42')).toMatchObject({ literalNumberSequenceErrorRate: null, literalNumberMultisetCoverage: null, unmatchedCandidateLiteralNumberCount: 1 })
    expect(JSON.stringify(changed)).not.toContain('1,234')
  })
  test('strict representation catches punctuation/TSV/arrow changes while historical normalization and deletion readings stay separate', () => {
    const typography = scoreEfgOcrFidelity('ﬁeld “text”—one\n', 'field "text"-one\n', 'newspapers', bcExactCharacterDistance)
    expect(typography.strictTextExact).toBe(false); expect(typography.strictCharacterErrorRate).toBeGreaterThan(0)
    expect(typography.readingNormalizedCharacterErrorRate).toBe(0)
    expect(scoreEfgOcrFidelity('A\t10\n', 'A | 10\n', 'numeric-tables', bcExactCharacterDistance).strictCharacterErrorRate).toBeGreaterThan(0)
    expect(scoreEfgOcrFidelity('Heading → Goal\n', 'Heading Goal\n', 'handwriting', bcExactCharacterDistance).punctuationSymbolCharacterErrorRate).toBe(1)
    const reading = scoreEfgOcrFidelity('Kept deleted text.\n', 'Kept text.\n', 'handwriting', bcExactCharacterDistance, 'Kept text.\n')
    expect(reading.strictCharacterErrorRate).toBeGreaterThan(0)
    expect(reading.publisherReadingCompanion?.characterErrorRate).toBe(0)
  })
  test('validates cell text/anchors privately and rejects wrong source serialization and branch mapping', () => {
    const table = exampleTable(), text = serializeTableReference(table)
    expect(validateEfgOcrStructure('numeric-tables', table, text)).toMatchObject({ referenceCellCount: 2, referenceRows: 1, referenceColumns: 2 })
    expect(JSON.stringify(validateEfgOcrStructure('numeric-tables', table, text))).not.toContain(secret)
    expect(() => validateEfgOcrStructure('numeric-tables', table, 'wrong')).toThrow('serialization changed')
    expect(() => validateEfgOcrStructure('numeric-tables', { ...table, cells: table.cells.map(c => ({ ...c, row: c.row + 1 })) }, text)).toThrow('serialization changed')
    expect(() => validateEfgOcrStructure('handwriting', { kind: 'flowchart', title: 'Title', heading: 'Heading', nodes: [{ id: 'question', text: 'Q', shape: 'unboxed' },
      { id: 'yes', text: 'A', shape: 'rectangle' }, { id: 'no', text: 'B', shape: 'rectangle' }], edges: [{ from: 'question', to: 'no', label: 'Y' }], readingOrder: 'derived' }, 'Title\n\nHeading\n\nQ\n\nY\tN\nA\tB\n')).toThrow('label/order serialization changed')
  })
})

describe('EFG fixed-profile report assembly', () => {
  test('inspect is read only, checks exact authorization, and cannot silently use the B/C profile', async () => {
    const f = await fixture(), before = await Bun.file(join(f.root, `${base}/execution-plan.json`)).text()
    expect((await inspectEfgOcrReports(f.options)).cases.every(c => c.successfulModels === 2)).toBe(true)
    expect(await Bun.file(join(f.root, `${base}/execution-plan.json`)).text()).toBe(before)
    expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).exists()).toBe(false)
    await expect(inspectBcOcrReports({ ...f.options, planPath: `${base}/execution-plan.json`, ledgerPath: `${base}/spending-ledger.json` })).rejects.toThrow('selected report profile')
  })
  test('real local reports preserve exhaustive lexical scores, disclose unmeasured structure, retain blank outputs, and publish no gold or provider text', async () => {
    const f = await fixture()
    const originalPath = `${base}/slots/${f.cases[0]!.id}-page-01/openai-gpt-6-luna/result.json`, before = await Bun.file(join(f.root, originalPath)).bytes()
    await buildEfgOcrReports(f.options)
    expect(await Bun.file(join(f.root, originalPath)).bytes()).toEqual(before)
    for (const entry of f.cases) {
      const report = await Bun.file(join(f.root, `${entry.runDir}/provider-comparison-report.json`)).json()
      expect(report.evaluation.primaryLexicalAccuracyAvailable).toBe(true)
      expect(report.evaluation.structureAccuracyAvailable).toBe(false)
      expect(report.evaluation.primaryRegionAccuracyAvailable).toBeUndefined()
      expect(report.providerGroups.thirdPartyService.providers[0].metrics.score).toBe(100)
      expect(report.providerGroups.thirdPartyService.providers[0].werBreakdown).toMatchObject({ substitutions: 0, deletions: 0, insertions: 0 })
      expect(report.metricRankings.thirdPartyService.price).toHaveLength(1)
      expect(report.metricRankings.thirdPartyService.speed).toHaveLength(1)
      if (entry.referenceKind === 'publisher-canonical') expect(report.referenceProvenance.sourceRevision).toBe('annotation-v2')
      else expect(report.referenceProvenance).toMatchObject({ kind: 'existing-consensus', independentOfProviders: false })
      for (const name of ['manifest.json', 'case-metadata.json', 'provider-comparison-report.json', 'provider-comparison-report.md', 'evaluation-diagnostics.json', 'page-metrics.json', 'outliers.json', 'selective-adjudication-pages.json', 'variant-comparison-summary.json', 'ocr-benchmark-summary.md']) {
        const value = await Bun.file(join(f.root, `${entry.runDir}/${name}`)).text()
        expect(value).not.toContain(secret); expect(value).not.toContain('apiKey'); expect(value).not.toContain('rawResponse')
        if (name.endsWith('.json')) expect(value).toContain('structureAccuracyAvailable')
      }
    }
    const manuscript = f.cases.find(c => c.id === 'handwriting-manuscript-fixture')!
    const manuscriptDiagnostic = await Bun.file(join(f.root, `${manuscript.runDir}/evaluation-diagnostics.json`)).json()
    expect(manuscriptDiagnostic.providers[0].strictCharacterErrorRate).toBe(0)
    expect(manuscriptDiagnostic.providers[0].publisherReadingCompanion.characterErrorRate).toBeGreaterThan(0)
    const flow = f.cases.find(c => c.id === 'handwriting-flowchart-fixture')!
    expect((await Bun.file(join(f.root, `${flow.runDir}/provider-comparison-report.json`)).json()).evaluation.structureAccuracyUnavailableReason).toContain('label-to-branch')
    const blank = f.cases.find(c => c.id === 'handwriting-prose-fixture')!
    const blankResult = await Bun.file(join(f.root, `${base}/benchmark-runs/${blank.id}/providers/tesseract-tesseract/result.json`)).json()
    expect(blankResult.text).toBe(''); expect(blankResult.pages[0].text).toBe('')
    const blankReport = await Bun.file(join(f.root, `${blank.runDir}/provider-comparison-report.json`)).json()
    expect(blankReport.providerGroups.local.providers[0].metrics).toMatchObject({ score: 0, wer: 1 })
    const jpg = f.cases.find(c => c.id === 'efg-rerun-financial-fixture')!, pdf = f.cases.find(c => c.id === 'efg-rerun-newspaper-fixture')!
    const jpgManifest = await Bun.file(join(f.root, `${jpg.runDir}/manifest.json`)).json(), pdfManifest = await Bun.file(join(f.root, `${pdf.runDir}/manifest.json`)).json()
    expect(jpgManifest.items[0].inputFamily).toBe('original-image'); expect(jpgManifest.items[0].metadata.step1.format).toBe('jpeg')
    expect(pdfManifest.items[0].inputFamily).toBe('pinned-rendered-pages'); expect(pdfManifest.items[0].metadata.step1.format).toBe('pdf-rendered-png')
  })
  test('changed structured or reading-reference bytes fail before any public report is written', async () => {
    for (const companion of ['structuredReference', 'readingReference'] as const) {
      const f = await fixture(), entry = f.cases.find(c => c[companion])!
      await f.write(entry[companion]!, 'changed private bytes')
      await expect(buildEfgOcrReports(f.options)).rejects.toThrow(companion === 'structuredReference' ? 'structured-reference hash changed' : 'reading-companion provenance/hash changed')
      expect(await Bun.file(join(f.root, `${entry.runDir}/manifest.json`)).exists()).toBe(false)
    }
  })
})
