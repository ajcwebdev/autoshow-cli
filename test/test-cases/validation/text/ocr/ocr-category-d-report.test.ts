import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { buildCategoryDOcrReports, inspectCategoryDOcrReports, scoreAnnotatedTokenCoverage } from '~/tools/ocr-category-d-report'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const base = 'input/examples/document/ocr-category-d-run'
const secret = 'Privatefixture'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

const fixture = async (fixtureOptions: { blankLocal?: boolean } = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-advertisement-report-')); roots.push(root)
  const write = async (path: string, value: unknown) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    const serialized = typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)
    await Bun.write(join(root, path), serialized)
    return serialized
  }
  const jpeg = await new Bun.Image(redDotPng).jpeg().bytes()
  const targets = [{ provider: 'tesseract', model: 'tesseract' }, { provider: 'openai', model: 'gpt-6-luna' }, { provider: 'mistral', model: 'mistral-ocr-4-1' }]
  const cases = [], pages = [], receipts = []
  for (const [index, id] of ['advertisement-fixture', 'd-rerun-fixture'].entries()) {
    const input = `${base}/inputs/${id}.jpg`, reference = `${base}/references/${id}.txt`
    const referenceText = index === 0 ? `${secret} Sale Sale\n` : `${secret} baseline text.\n`
    await write(input, jpeg); await write(reference, referenceText)
    const structure = { schemaVersion: 1, canonicalUnit: 'word-region', width: 1, height: 1,
      regions: [secret, 'Sale', 'Sale'].map((text, i) => ({ id: `word-${i}`, text, ignore: false, polygon: [0, 0, 1, 0, 1, 1, 0, 1], bbox: [0, 0, 1, 1] })),
      reviewedReadingOrder: { notDatasetGoldOrder: true, lines: [['word-0', 'word-1', 'word-2']] } }
    const structuredReference = `${base}/references/${id}.json`, structureBytes = JSON.stringify(structure)
    if (index === 0) await write(structuredReference, structureBytes)
    const page = { id: `${id}-page-01`, caseId: id, pageNumber: 1, input, inputSha256: hash(jpeg), width: 1, height: 1 }
    const entry = { id, category: 'advertisements', input, inputSha256: hash(jpeg), reference, referenceSha256: hash(referenceText),
      referenceKind: index === 0 ? 'publisher-canonical' : 'existing-consensus', sourceURL: 'https://example.org/pinned-image',
      annotationURL: 'https://example.org/pinned-words', annotationRevision: 'annotation-fixture-v2', sourceRevision: 'image-fixture-v1', runDir: `docs/benchmarks/ocr/${id}`, pages: [page],
      ...(index === 0 ? { structuredReference, structuredReferenceSha256: hash(structureBytes), evaluationScope: 'dataset-annotated-word-regions' } : {}) }
    cases.push(entry); pages.push(page)
    for (const target of targets) {
      const directory = `${base}/slots/${page.id}/${target.provider}-${target.model}`
      const body = index === 1 ? referenceText.trim() : target.provider === 'tesseract' ? fixtureOptions.blankLocal ? '' : `sale ${secret} sale extra` : target.provider === 'openai' ? `${secret} Sale` : referenceText.trim()
      const result = { text: `Page 1\n${body}`, pages: [{ pageNumber: target.provider === 'mistral' ? 0 : 1, method: 'ocr', text: body }], totalPages: 1 }
      const manifest = { command: 'extract', scope: 'single', items: [{ extractRoute: 'document', metadata: { source: { filePath: input } }, providers: [{ service: target.provider,
        model: target.model, artifactDir: '.', status: 'succeeded', options: { apiKey: secret }, metadata: { processingTime: 110, rawResponse: secret }, result }] }] }
      const manifestBytes = await write(`${directory}/manifest.json`, manifest)
      await write(`${directory}/result.json`, result); await write(`${directory}/extraction.txt`, result.text)
      await write(`${directory}/dispatch.json`, { caseId: page.id, documentCaseId: id, provider: target.provider, model: target.model,
        inputSha256: page.inputSha256, referenceSha256: entry.referenceSha256, directory, status: 'succeeded', startedAt: '2026-10-23T12:00:00Z', manifestSha256: hash(String(manifestBytes)) })
      if (target.provider !== 'tesseract') receipts.push({ id: `${id}-${target.provider}`, invocationId: `${id}-${target.provider}`, caseId: page.id, documentCaseId: id,
        provider: target.provider, model: target.model, inputSha256: page.inputSha256, status: 'settled', reservedCents: 5, chargedCents: 0.25, httpStatus: 200, createdAt: '2026-10-23T12:00:01Z' })
    }
  }
  const plan = { schemaVersion: 1, kind: 'ocr-category-d-execution-plan', approval: { status: 'approved', budgetCents: 2500, evidence: 'User approved up to $25 for category 4' }, cases, pages, targets }
  const planBytes = await write(`${base}/execution-plan.json`, plan)
  const ledger = { schemaVersion: 1, kind: 'ocr-category-d-spending-ledger', budgetCents: 2500, planSha256: hash(String(planBytes)), receipts }
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

describe('advertisement annotated-token coverage diagnostic', () => {
  test('is order independent, counts duplicate targets, and separates additional output from missing targets', () => {
    expect(scoreAnnotatedTokenCoverage('SALE sale Today!', 'today SALE')).toMatchObject({ referenceNormalizedTokenCount: 3, matchedReferenceTokens: 2,
      missingReferenceTokens: 1, annotatedNormalizedTokenCoverage: 2 / 3, unmatchedCandidateTokens: 0 })
    expect(scoreAnnotatedTokenCoverage('SALE sale Today!', 'today sale sale EXTRA')).toMatchObject({ annotatedNormalizedTokenCoverage: 1,
      matchedReferenceTokens: 3, candidateNormalizedTokenCount: 4, unmatchedCandidateTokens: 1 })
  })
  test('empty or unrelated output has zero coverage; complete presence is not a localization claim', () => {
    expect(scoreAnnotatedTokenCoverage('One Two', '').annotatedNormalizedTokenCoverage).toBe(0)
    expect(scoreAnnotatedTokenCoverage('One Two', 'unrelated').annotatedNormalizedTokenCoverage).toBe(0)
    const result = scoreAnnotatedTokenCoverage('One Two', 'Two One')
    expect(result.annotatedNormalizedTokenCoverage).toBe(1)
    expect(result.scopeLimitation).toContain('incidental duplicates')
    expect(JSON.stringify(result)).not.toContain('"primaryRegionAccuracy":1')
    expect(() => scoreAnnotatedTokenCoverage('!!!', 'anything')).toThrow('no tokens')
  })
})

describe('advertisement report scope and saved-output integrity', () => {
  test('valid empty OCR output has zero coverage and no fabricated page-wrapper tokens', async () => {
    const f = await fixture({ blankLocal: true }), entry = f.cases[0]!
    await buildCategoryDOcrReports(f.options)
    const result = await Bun.file(join(f.root, `${base}/benchmark-runs/${entry.id}/providers/tesseract-tesseract/result.json`)).json()
    expect(result.pages[0].text).toBe('')
    expect(result.text).toBe('')
    const diagnostic = await Bun.file(join(f.root, `${entry.runDir}/evaluation-diagnostics.json`)).json()
    expect(diagnostic.providers.find((p: { provider: string }) => p.provider === 'tesseract').annotatedNormalizedTokenCoverage).toBe(0)
    const ordered = diagnostic.orderedReferenceDiagnostics.providers.find((p: { providerKey: string }) => p.providerKey === 'tesseract/tesseract')
    expect(ordered.normalizedWER).toBe(1)
    expect(ordered.werEditBreakdown.insertions).toBe(0)
    expect((await Bun.file(join(f.root, `${entry.runDir}/case-metadata.json`)).json()).coverage.successfulLocalModels).toBe(1)
  })
  test('inspection is read only and preserves D authorization separate from B/C', async () => {
    const f = await fixture(), before = await Bun.file(join(f.root, `${base}/execution-plan.json`)).text()
    const result = await inspectCategoryDOcrReports(f.options)
    expect(result.cases.map(c => c.successfulModels)).toEqual([3, 3])
    expect(result.spending.accountedCents).toBe(1)
    expect(await Bun.file(join(f.root, `${base}/execution-plan.json`)).text()).toBe(before)
    expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).exists()).toBe(false)
  })
  test('real local reports make primary spatial accuracy unavailable while retaining coverage, costs, speed and baseline scores', async () => {
    const f = await fixture()
    await buildCategoryDOcrReports(f.options)
    const partial = f.cases[0]!, baseline = f.cases[1]!
    const report = await Bun.file(join(f.root, `${partial.runDir}/provider-comparison-report.json`)).json()
    expect(report.referenceProvenance.sourceRevision).toBe('annotation-fixture-v2')
    expect(report.primaryQualityUnavailableReason).toContain('without coordinates')
    expect(report.providerGroups.local.providers[0].metrics).toMatchObject({ score: null, wer: null, cer: null })
    for (const group of Object.values(report.providerGroups) as Array<{ providers: Array<Record<string, unknown>> }>) for (const row of group.providers) {
      expect(row['werBreakdown']).toBeNull(); expect(row['cerBreakdown']).toBeNull()
    }
    expect(report.metricRankings.thirdPartyService.qualityScore.every((row: { value: unknown }) => row.value === null)).toBe(true)
    expect(report.metricRankings.thirdPartyService.price).toHaveLength(2)
    expect(report.metricRankings.thirdPartyService.speed).toHaveLength(2)
    const diagnostic = await Bun.file(join(f.root, `${partial.runDir}/evaluation-diagnostics.json`)).json()
    expect(diagnostic.evaluation.officialAnnotatedWordRegions).toBe(3)
    expect(diagnostic.providers.find((p: { provider: string }) => p.provider === 'tesseract').annotatedNormalizedTokenCoverage).toBe(1)
    expect(diagnostic.providers.find((p: { provider: string }) => p.provider === 'openai').annotatedNormalizedTokenCoverage).toBe(2 / 3)
    expect(diagnostic.orderedReferenceDiagnostics.providers.find((p: { providerKey: string }) => p.providerKey === 'tesseract/tesseract').normalizedWER).toBeGreaterThan(0)
    const baselineReport = await Bun.file(join(f.root, `${baseline.runDir}/provider-comparison-report.json`)).json()
    expect(baselineReport.providerGroups.thirdPartyService.providers[0].metrics.score).toBe(100)
    for (const name of ['manifest.json', 'case-metadata.json', 'provider-comparison-report.json', 'provider-comparison-report.md', 'evaluation-diagnostics.json', 'page-metrics.json', 'outliers.json', 'selective-adjudication-pages.json', 'variant-comparison-summary.json', 'ocr-benchmark-summary.md']) {
      const value = await Bun.file(join(f.root, `${partial.runDir}/${name}`)).text()
      expect(value).not.toContain(secret)
      if (name.endsWith('.json') && !['manifest.json', 'case-metadata.json'].includes(name)) expect(value).toContain('primaryRegionAccuracyAvailable')
    }
    expect(await Bun.file(join(f.root, `${partial.runDir}/provider-comparison-report.md`)).text()).not.toContain('Ranking metric: word error rate')
    const modulePath = resolve('.codex/skills/consensus/scripts/ocr/build_combined_report.ts'), rendererPath = resolve('.codex/skills/consensus/scripts/shared/dashboard_client.js')
    const child = Bun.spawn([process.execPath, '-e', 'const b=await import(process.argv[1]); const r=b.buildOcrCombinedReport(process.argv[2]); const c=await import(process.argv[3]); console.log(JSON.stringify({report:r.report,model:r.dashboardModel,html:c.renderDashboard({schemaVersion:1,title:"Fixture",generatedAt:"now",tabs:[{key:"ocr",label:"OCR",rootLabel:"fixture",model:r.dashboardModel}]})}));', modulePath, join(f.root, 'docs/benchmarks/ocr'), rendererPath], { env: f.env, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    if (exit !== 0) throw new Error(stderr)
    const combined = JSON.parse(stdout)
    const row = combined.report.metricRankings.thirdPartyService.qualityScore[0]
    expect(row.runsCovered).toBe(2)
    expect(row.avgQualityScore).toBe(100)
    expect(row.weightedWER).toBe(0)
    expect(row.weightedCER).toBe(0)
    expect(combined.html).toContain('advertisement-fixture')
    expect(combined.html).not.toContain(secret)
  })
  test('changed structured annotations fail before any reports are produced', async () => {
    const f = await fixture(), path = f.cases[0]!.structuredReference!
    await f.write(path, '{}')
    await expect(buildCategoryDOcrReports(f.options)).rejects.toThrow('structured-reference hash changed')
    expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).exists()).toBe(false)
  })
})
