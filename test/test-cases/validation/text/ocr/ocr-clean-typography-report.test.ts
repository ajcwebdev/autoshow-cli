import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { CLEAN_TYPOGRAPHY_SOURCE_PINS } from '~/tools/ocr-clean-typography-admission'
import { buildCleanTypographyReports, cleanTypographyReportArtifactDir, inspectCleanTypographyReports } from '~/tools/ocr-clean-typography-report'
import type { CleanTypographyReportOptions } from '~/tools/ocr-clean-typography-report'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const rootPath = 'input/examples/document/ocr-clean-typography'
const secret = 'PRIVATE_DOCUMENT_OR_API_KEY_MUST_NEVER_BE_PUBLIC'
const hash = (value: string | Uint8Array): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-ocr-report-')); roots.push(root)
  const write = async (path: string, value: unknown): Promise<string> => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    const bytes = typeof value === 'string' ? value : JSON.stringify(value)
    await Bun.write(join(root, path), bytes)
    return bytes
  }
  const targets = [{ provider: 'tesseract', model: 'tesseract' }, { provider: 'deepinfra', model: 'google/gemma-fixture' }, { provider: 'openai', model: 'failed-fixture' }]
  const cases = []
  const receipts = []
  for (const [index, pin] of CLEAN_TYPOGRAPHY_SOURCE_PINS.entries()) {
    const id = pin.id
    const input = `${rootPath}/cases/${id}/input.png`, reference = `${rootPath}/cases/${id}/canonical-reference.txt`
    await mkdir(dirname(join(root, input)), { recursive: true }); await Bun.write(join(root, input), redDotPng)
    const referenceText = `${secret} publisher ${index}.\n`; await write(reference, referenceText)
    const entry = { id, input, reference, inputSha256: hash(redDotPng), referenceSha256: hash(referenceText),
      annotationURL: 'https://example.org/pinned-annotation', sourceURL: 'https://example.org/pinned-image', sourceRevision: 'fixture-pinned-revision',
      runDir: `docs/benchmarks/text/ocr/${id}`, localPilot: { directory: `${rootPath}/local-pilot/${id}` },
      rights: { license: 'Synthetic private research fixture', notice: `${rootPath}/notice.txt`, redistributable: false } }
    cases.push(entry)
    const result = { text: `${secret} provider ${index}`, pages: [{ pageNumber: 1, method: 'ocr', text: `${secret} provider ${index}` }], totalPages: 1 }
    const manifest = (provider: string, model: string, artifactDir: string) => ({ command: 'extract', scope: 'single', createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z',
      items: [{ extractRoute: 'document', status: 'full', metadata: { source: { filePath: input } },
        providers: [{ service: provider, model, artifactDir, status: 'succeeded', attempts: 1, options: { apiKey: secret },
          metadata: { processingTime: 120 + index, tokenEstimate: 20, rawResponse: secret }, result, error: { message: secret } }] }] })
    const pilotBytes = await write(`${entry.localPilot.directory}/manifest.json`, manifest('tesseract', 'tesseract', '.'))
    await write(`${entry.localPilot.directory}/extraction.txt`, `${secret} original extraction ${index}`)
    await write(`${entry.runDir}/manifest.json`, { source: { localPilotManifestSha256: hash(pilotBytes) } })
    const privateDirectory = `${rootPath}/benchmark-runs/${id}`
    await write(`${privateDirectory}/manifest.json`, { priorAssembly: true })
    await write(`${privateDirectory}/keep.bin`, `prior ${index}`)
    for (const target of targets.slice(1)) {
      const directory = `${rootPath}/slots/${id}/${`${target.provider}-${target.model}`.replace(/[^a-zA-Z0-9_.-]/g, '-')}`
      let manifestSha256: string | null = null
      const successful = target.provider === 'deepinfra'
      if (successful) {
        const artifactDir = cleanTypographyReportArtifactDir(target.provider, target.model)
        const bytes = await write(`${directory}/manifest.json`, manifest(target.provider, target.model, artifactDir))
        manifestSha256 = hash(bytes)
        await write(`${directory}/${artifactDir}/result.json`, JSON.stringify(result, null, 2) + '\n')
        await write(`${directory}/${artifactDir}/extraction.txt`, `${secret} exact hosted extraction ${index}`)
      } else await write(`${directory}/failure.txt`, `Bearer ${secret}: arbitrary raw provider error`)
      await write(`${directory}/dispatch.json`, { caseId: id, provider: target.provider, model: target.model,
        inputSha256: entry.inputSha256, referenceSha256: entry.referenceSha256, status: successful ? 'succeeded' : 'failed', directory, manifestSha256, startedAt: '2026-10-23T00:01:00Z' })
      receipts.push({ id: `${id}-${target.provider}`, invocationId: `${id}-${target.provider}`, caseId: id, provider: target.provider, model: target.model,
        inputSha256: entry.inputSha256, reservedCents: successful ? 20 : 7, chargedCents: successful ? 0.25 : 7,
        status: successful ? 'settled' : 'ambiguous', createdAt: '2026-10-23T00:01:01Z', reason: secret })
    }
  }
  const bundle = { cases: cases.map(entry => ({ id: entry.id, input: entry.input, reference: entry.reference, inputSha256: entry.inputSha256, referenceSha256: entry.referenceSha256 })) }
  const bundleBytes = await write(`${rootPath}/bundle.json`, bundle)
  const plan = { schemaVersion: 1, category: 'clean-typography', caseCount: 5, targetCount: 3, bundle: `${rootPath}/bundle.json`, bundleSha256: hash(bundleBytes), quote: { models: targets }, cases }
  await write('docs/benchmarks/text/ocr/clean-typography-additions-plan.json', plan)
  await write(`${rootPath}/spending-ledger.json`, { schemaVersion: 1, kind: 'ocr-clean-typography-spending-ledger', budgetCents: 500, receipts })
  const mutableCommands: string[][] = []
  const options: CleanTypographyReportOptions = { projectRoot: root, runConsensus: async argv => {
    mutableCommands.push([...argv])
    if (argv[1] === 'build-report') {
      await Bun.write(argv[argv.indexOf('--json-out') + 1]!, JSON.stringify({ notes: [] }))
      await Bun.write(argv[argv.indexOf('--markdown-out') + 1]!, '# Synthetic metric report\n')
    }
  } }
  return { root, options, cases, plan, write, commands: mutableCommands }
}

describe('clean typography private report assembly', () => {
  test('default overview reads existing artifacts only and separates reported cost from reserved spending', async () => {
    const f = await fixture()
    const before = await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).text()
    const overview = await inspectCleanTypographyReports(f.options)
    expect(overview.cases).toHaveLength(5)
    expect(overview.cases[0]).toMatchObject({ configuredModels: 3, successfulLocalModels: 1, successfulHostedModels: 1, failedHostedModels: 1, pendingHostedModels: 0 })
    expect(overview.spending).toMatchObject({ providerReportedCents: 1.25, heldReservationCents: 35, accountedCents: 36.25 })
    expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).text()).toBe(before)
    expect(f.commands).toHaveLength(0)
  })
  test('build copies exact private artifacts, preserves previous assemblies and publishes metadata without document text or secrets', async () => {
    const f = await fixture()
    const id = f.cases[0]!.id
    const pilot = `${rootPath}/local-pilot/${id}/manifest.json`
    const before = await Bun.file(join(f.root, pilot)).text()
    await buildCleanTypographyReports(f.options)
    expect(f.commands).toHaveLength(10)
    expect(f.commands[0]!.slice(0, 2)).toEqual(['ocr', 'build-packet'])
    expect(f.commands[1]).toContain('--markdown-out'); expect(f.commands[1]).toContain('--json-out')
    const publicText = await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).text()
    expect(publicText).not.toContain(secret)
    const publicManifest = JSON.parse(publicText)
    expect(publicManifest.reference.kind).toBe('publisher-canonical')
    expect(publicManifest.items[0].providers).toHaveLength(3)
    expect(publicManifest.items[0].providers.every((provider: Record<string, unknown>) => !('result' in provider))).toBe(true)
    expect(publicManifest.items[0].metadata.cost.actual.totalCost).toBe(7.25)
    const hosted = publicManifest.items[0].providers.find((provider: { service: string }) => provider.service === 'deepinfra')
    expect(hosted.artifactDir).toBe('providers/deepinfra-google%2Fgemma-fixture')
    const source = `${rootPath}/slots/${id}/deepinfra-google-gemma-fixture/${hosted.artifactDir}`
    const destination = `${rootPath}/benchmark-runs/${id}/${hosted.artifactDir}`
    for (const name of ['result.json', 'extraction.txt']) expect(await Bun.file(join(f.root, `${destination}/${name}`)).bytes()).toEqual(await Bun.file(join(f.root, `${source}/${name}`)).bytes())
    expect(await Bun.file(join(f.root, pilot)).text()).toBe(before)
    const preserved = Array.from(new Bun.Glob(`${rootPath}/prior-assemblies/**/keep.bin`).scanSync({ cwd: f.root }))
    expect(preserved).toHaveLength(5)
    const caseMetadata = await Bun.file(join(f.root, `${f.cases[0]!.runDir}/case-metadata.json`)).text()
    expect(caseMetadata).not.toContain(secret)
    expect(publicManifest.items[0].providers.find((provider: { service: string }) => provider.service === 'openai').error.code).toBe('UNRESOLVED_PROVIDER_OUTCOME')
  })
  test('rejects changed source bytes, publisher reference and original pilot manifest before writing reports', async () => {
    for (const suffix of ['input.png', 'canonical-reference.txt', 'pilot']) {
      const f = await fixture(), entry = f.cases[0]!
      await f.write(suffix === 'input.png' ? entry.input : suffix === 'canonical-reference.txt' ? entry.reference : `${entry.localPilot.directory}/manifest.json`, 'changed')
      await expect(buildCleanTypographyReports(f.options)).rejects.toThrow(suffix === 'pilot' ? 'Saved manifest hash changed' : 'publisher reference hash changed')
      expect(f.commands).toHaveLength(0)
    }
  })
  test('keeps settled conservative costs, reviewed usage and ambiguous holds distinct and labels mixed retry prices honestly', async () => {
    const f = await fixture()
    const path = `${rootPath}/spending-ledger.json`
    const ledger = await Bun.file(join(f.root, path)).json()
    const usage = ledger.receipts[0]
    usage.costBasis = 'provider-usage-at-reviewed-rates'
    usage.costNote = 'Reviewed standard usage, not invoice-reconciled.'
    ledger.receipts.push({ ...usage, id: 'retry-conservative', invocationId: 'retry-conservative', chargedCents: 0.75,
      costBasis: 'conservative-upper-bound', costNote: 'Incomplete cache usage; conservative upper bound.' })
    await f.write(path, ledger)
    const overview = await inspectCleanTypographyReports(f.options)
    expect(overview.cases[0]!.spending).toMatchObject({ providerReportedCents: 0.25, settledConservativeCents: 0.75,
      settledAccountedCents: 1, heldReservationCents: 7, accountedCents: 8 })
    await buildCleanTypographyReports(f.options)
    const manifest = await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).json()
    expect(manifest.items[0].metadata.cost.actual.steps.find((row: { provider: string }) => row.provider === 'deepinfra'))
      .toMatchObject({ cost: 1, costSource: 'conservative_upper_bound' })
    const metric = await Bun.file(join(f.root, `${f.cases[0]!.runDir}/provider-comparison-report.json`)).json()
    expect(metric.notes.join(' ')).toContain('conservative upper bound')
    expect(metric.notes.join(' ')).toContain('not invoice-reconciled')
  })
  test('does not attribute an archived authentication rejection to a fresh failure before any new request', async () => {
    const f = await fixture(), entry = f.cases[0]!
    const path = `${rootPath}/spending-ledger.json`
    const ledger = await Bun.file(join(f.root, path)).json()
    const previous = ledger.receipts.find((row: { caseId: string, provider: string }) => row.caseId === entry.id && row.provider === 'openai')
    previous.status = 'rejected'; previous.httpStatus = 401; previous.chargedCents = 0; previous.createdAt = '2026-10-22T00:01:01Z'
    await f.write(path, ledger)
    await buildCleanTypographyReports(f.options)
    const manifest = await Bun.file(join(f.root, `${entry.runDir}/manifest.json`)).json()
    expect(manifest.items[0].providers.find((row: { service: string }) => row.service === 'openai').error)
      .toMatchObject({ code: 'PROVIDER_RUN_FAILED' })
    expect(manifest.items[0].providers.find((row: { service: string }) => row.service === 'openai').error.httpStatus).toBeUndefined()
  })
  test('successful output retains an earlier unknown-billing hold in its explicitly conservative price', async () => {
    const f = await fixture(), entry = f.cases[0]!
    const path = `${rootPath}/spending-ledger.json`
    const ledger = await Bun.file(join(f.root, path)).json()
    ledger.receipts.push({ ...ledger.receipts[0], id: 'previous-503-hold', invocationId: 'previous-503-invocation',
      status: 'ambiguous', httpStatus: 503, reservedCents: 3.968, chargedCents: 3.968,
      createdAt: '2026-10-22T23:00:00Z', costBasis: 'conservative-upper-bound', costNote: 'Unknown billing; retain the full original reservation.' })
    await f.write(path, ledger)
    await buildCleanTypographyReports(f.options)
    const manifest = await Bun.file(join(f.root, `${entry.runDir}/manifest.json`)).json()
    const price = manifest.items[0].metadata.cost.actual.steps.find((row: { provider: string }) => row.provider === 'deepinfra')
    expect(price).toMatchObject({ cost: 4.218, costSource: 'conservative_upper_bound',
      costBreakdown: { reviewedUsageCents: 0.25, settledConservativeCents: 0, heldReservationCents: 3.968, accountedCents: 4.218 } })
    expect(manifest.source.coverage.spending).toMatchObject({ providerReportedCents: 0.25, heldReservationCents: 10.968, accountedCents: 11.218 })
    expect(manifest.items[0].metadata.cost.actual.totalCost).toBe(11.218)
    expect(manifest.items[0].providers.find((row: { service: string }) => row.service === 'deepinfra').status).toBe('succeeded')
    const metric = await Bun.file(join(f.root, `${entry.runDir}/provider-comparison-report.json`)).json()
    expect(metric.notes.join(' ')).toContain('3.968000 retained unresolved cents')
    expect(metric.costPolicy).toContain('upper bound')
    expect(await Bun.file(join(f.root, path)).json()).toEqual(ledger)
  })
  test('rejects a changed completed-slot manifest and mismatched journal source identity', async () => {
    const f = await fixture(), entry = f.cases[0]!
    const directory = `${rootPath}/slots/${entry.id}/deepinfra-google-gemma-fixture`
    await f.write(`${directory}/manifest.json`, '{}')
    await expect(buildCleanTypographyReports(f.options)).rejects.toThrow('Saved manifest hash changed')
    const g = await fixture(), other = g.cases[0]!
    const path = `${rootPath}/slots/${other.id}/deepinfra-google-gemma-fixture/dispatch.json`
    const journal = await Bun.file(join(g.root, path)).json(); journal.referenceSha256 = '0'.repeat(64)
    await g.write(path, journal)
    await expect(buildCleanTypographyReports(g.options)).rejects.toThrow('Dispatch journal identity')
  })
  test('defers report building while a hosted slot is running, retaining truthful read-only coverage', async () => {
    const f = await fixture(), entry = f.cases[0]!
    const path = `${rootPath}/slots/${entry.id}/openai-failed-fixture/dispatch.json`
    const journal = await Bun.file(join(f.root, path)).json(); journal.status = 'dispatch-started'
    await f.write(path, journal)
    expect((await inspectCleanTypographyReports(f.options)).cases[0]!.pendingHostedModels).toBe(1)
    await expect(buildCleanTypographyReports(f.options)).rejects.toThrow('still missing or running')
    expect(f.commands).toHaveLength(0)
  })
  test('actual local consensus commands score saved outputs against independent gold without exposing text', async () => {
    const f = await fixture()
    const ledgerPath = `${rootPath}/spending-ledger.json`
    const ledger = await Bun.file(join(f.root, ledgerPath)).json()
    ledger.receipts.push({ ...ledger.receipts[0], id: 'integration-retained-hold', invocationId: 'prior-503-invocation',
      status: 'ambiguous', reservedCents: 3.968, chargedCents: 3.968, httpStatus: 503, createdAt: '2026-10-22T23:00:00Z',
      costBasis: 'conservative-upper-bound', costNote: 'Unreconciled earlier inference retains its complete reservation.' })
    await f.write(ledgerPath, ledger)
    const skillRoot = resolve('.codex/skills/consensus')
    await mkdir(join(f.root, 'src/cli/commands/setup-and-utilities'), { recursive: true })
    await symlink(resolve('src/cli/commands/setup-and-utilities/models'), join(f.root, 'src/cli/commands/setup-and-utilities/models'), 'dir')
    // The skill's subprocess environment intentionally drops project-root overrides.
    // An OS-temporary executable retains the fixture root for its nested Bun commands.
    const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`
    const bin = join(f.root, 'bin'); await mkdir(bin)
    await Bun.write(join(bin, 'bun'), `#!/bin/sh\nAUTOSHOW_PROJECT_ROOT=${shellQuote(f.root)} exec ${shellQuote(process.execPath)} "$@"\n`)
    await chmod(join(bin, 'bun'), 0o755)
    const { runConsensus: _mock, ...options } = f.options
    await buildCleanTypographyReports({ ...options, runConsensus: async argv => {
      const child = Bun.spawn([process.execPath, 'scripts/run.ts', ...argv], { cwd: skillRoot, env: { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`, AUTOSHOW_PROJECT_ROOT: f.root }, stdout: 'pipe', stderr: 'pipe' })
      const [, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      if (code !== 0) throw new Error(`Local skill fixture failed: ${stderr}`)
    } })
    const entry = f.cases[0]!
    const json = await Bun.file(join(f.root, `${entry.runDir}/provider-comparison-report.json`)).text()
    expect(json).not.toContain(secret)
    const report = JSON.parse(json)
    expect(report.referenceProvenance.independentOfProviders).toBe(true)
    expect(report.providerCount).toBe(2)
    expect(report.providerGroups.local.providers).toHaveLength(1)
    expect(report.providerGroups.thirdPartyService.providers).toHaveLength(1)
    expect(report.providerGroups.thirdPartyService.providers[0].costCents).toBe(4.218)
    expect(report.providerGroups.thirdPartyService.providers[0].costSource).toBe('conservative_upper_bound')
    expect(report.providerGroups.thirdPartyService.providers[0].costBreakdown)
      .toMatchObject({ reviewedUsageCents: 0.25, settledConservativeCents: 0, heldReservationCents: 3.968, accountedCents: 4.218 })
    expect(report.metricRankings.thirdPartyService.price[0].costSource).toBe('conservative_upper_bound')
    const markdown = await Bun.file(join(f.root, `${entry.runDir}/provider-comparison-report.md`)).text()
    expect(markdown).toContain('3.968000 retained unresolved cents')
    expect(markdown).not.toContain('| Actual Cost |')
    expect(report.metricRankings.local.qualityScore).toHaveLength(1)
    expect(report.metricRankings.thirdPartyService.qualityScore).toHaveLength(1)
  })
})
