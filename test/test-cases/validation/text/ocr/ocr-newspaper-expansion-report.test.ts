import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rename, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { NEWSPAPER_EXECUTION_REPORT, NEWSPAPER_PUBLIC_PLAN, analyzeNewspaperExpansionReports, analyzeRetainedNewspaperExpansionReports, buildNewspaperExpansionReports, inspectNewspaperExpansionReports, newspaperCurrentCohortMarkdown, newspaperExecutionMarkdown, parseNewspaperReportArguments, summarizeNewspaperPanels, updateNewspaperExecutionSection } from '~/tools/ocr-newspaper-expansion-report'
import { assertNewspaperOcrResultComplete, classifyNewspaperFailureLog, classifyNewspaperOcrFailure, inspectBcOcrReports, scoreNewspaperRepetition, scoreNewspaperSpacingConvention, scoreNewspaperTokenMultiset } from '~/tools/ocr-categories-bc-report'
import { levenshteinDistance, tokenize } from '../../../../../.codex/skills/consensus/scripts/ocr/ocr_consensus_lib'
import { normalizeHistoricalReference } from '~/tools/ocr-preparation/prepare-historical-newspapers'
import { redDotPng } from '../../../../test-utils/media-fixtures'

const base = 'input/examples/document/ocr-newspaper-expansion'
const secret = 'PrivateNewspaperFixture'
const hash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
interface TestSlot {
  caseId: string, documentCaseId: string, provider: string, model: string, inputSha256: string, referenceSha256: string,
  directory: string, status: string, startedAt: string, completedAt: string, manifestSha256: string | null,
  artifactHashes: Array<{ path: string, sha256: string }>
}

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-newspaper-report-')); roots.push(root)
  const write = async (path: string, value: unknown) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    const bytes = typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)
    await Bun.write(join(root, path), bytes); return bytes
  }
  const read = async (path: string) => Bun.file(join(root, path)).json()
  const targets = [{ provider: 'tesseract', model: 'tesseract' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' },
    { provider: 'gemini', model: 'gemini-3.8-flash' }, { provider: 'grok', model: 'grok-4.7' }]
  const specs = [
    { id: 'newspapers-expansion-layout-fixture', scope: 'full-page', text: `${secret} ſhort ﬁeld “text”—12.\n` },
    { id: 'newspapers-expansion-bln-era-burglars', scope: 'region-crop', text: `${secret} saw someone here.\n` },
    { id: 'newspapers-expansion-new-york-times-fixture', scope: 'full-page', text: `${secret} capacity text end.\n` }
  ]
  const cases = [], pages = [], receipts = []
  const slots: TestSlot[] = []
  for (const spec of specs) {
    const input = `${base}/cases/${spec.id}/input.png`, reference = `${base}/cases/${spec.id}/canonical-reference.txt`
    const normalizedReference = `${base}/cases/${spec.id}/normalized-reference.txt`, structuredReference = `${base}/cases/${spec.id}/reference.json`
    const structure = { sourceId: spec.id, sourceRevision: 'human-v2', imageSize: { width: 1, height: 1 },
      readingOrder: ['declared source order'], errata: [], referenceCoverage: { fullInputCovered: true } }
    const structureBytes = JSON.stringify(structure)
    await write(input, redDotPng); await write(reference, spec.text)
    await write(normalizedReference, normalizeHistoricalReference(spec.text)); await write(structuredReference, structureBytes)
    const page = { id: `${spec.id}-page-01`, caseId: spec.id, pageNumber: 1, input, inputSha256: hash(redDotPng), width: 1, height: 1 }
    const entry = { id: spec.id, category: 'newspapers', input, inputSha256: hash(redDotPng), reference, referenceSha256: hash(spec.text),
      referenceKind: 'publisher-canonical', normalizedReference, normalizedReferenceSha256: hash(normalizeHistoricalReference(spec.text)),
      structuredReference, structuredReferenceSha256: hash(structureBytes), sourceURL: 'https://example.org/image-v1', sourceRevision: 'image-v1',
      annotationURL: 'https://example.org/gold-v2', annotationRevision: 'human-v2', scope: spec.scope, sourceFamily: 'Independent human fixture',
      serializationPolicy: 'Reading normalization is applied to BOTH texts in private derivatives; raw source bytes retained.', runDir: `docs/benchmarks/text/ocr/${spec.id}`, pages: [page] }
    cases.push(entry); pages.push(page)
    for (const target of targets) {
      const directory = `${base}/slots/${page.id}/${`${target.provider}-${target.model}`.replace(/[^a-zA-Z0-9_.-]/g, '-')}`
      const failed = spec.id.includes('new-york-times') && target.provider === 'grok'
      const body = target.provider === 'tesseract' ? spec.text : normalizeHistoricalReference(spec.text).replace('someone', 'some one')
      const result = { text: `Page 1\n${body}`, pages: [{ pageNumber: 1, method: 'ocr', text: body }], totalPages: 1 }
      const manifest = { command: 'extract', scope: 'single', items: [{ extractRoute: 'document', metadata: { source: { filePath: input } },
        providers: [{ service: target.provider, model: target.model, status: failed ? 'failed' : 'succeeded', artifactDir: '.', options: { apiKey: secret },
          metadata: { processingTime: 90, rawResponse: secret }, ...(failed ? { error: { code: 'OCR_OUTPUT_LIMIT', message: `Native output limit: ${secret}` } } : {}), result }] }] }
      const manifestBytes = await write(`${directory}/manifest.json`, manifest)
      const resultBytes = await write(`${directory}/result.json`, result); await write(`${directory}/extraction.txt`, result.text)
      const journal = { caseId: page.id, documentCaseId: spec.id, provider: target.provider, model: target.model,
        inputSha256: page.inputSha256, referenceSha256: entry.referenceSha256, directory, status: failed ? 'failed' : 'succeeded',
        startedAt: '2026-10-23T12:00:00Z', completedAt: '2026-10-23T12:00:02Z', manifestSha256: hash(String(manifestBytes)),
        artifactHashes: [{ path: `${directory}/manifest.json`, sha256: hash(String(manifestBytes)) },
          { path: `${directory}/result.json`, sha256: hash(String(resultBytes)) }, { path: `${directory}/extraction.txt`, sha256: hash(result.text) }] }
      await write(`${directory}/dispatch.json`, journal); slots.push(journal)
      if (target.provider !== 'tesseract') receipts.push({ id: `${spec.id}-${target.provider}`, invocationId: `${spec.id}-${target.provider}`,
        caseId: page.id, documentCaseId: spec.id, provider: target.provider, model: target.model, inputSha256: page.inputSha256,
        status: 'settled', reservedCents: 5, chargedCents: 0.25, httpStatus: 200, createdAt: '2026-10-23T12:00:01Z' })
    }
  }
  const plan = { schemaVersion: 1, kind: 'ocr-newspaper-expansion-execution-plan',
    approval: { status: 'approved', budgetCents: 3000, evidence: 'User approved up to $30 for the 12-input newspaper expansion' }, cases, pages, targets }
  const planBytes = await write(`${base}/execution-plan.json`, plan)
  const ledger = { schemaVersion: 1, kind: 'ocr-newspaper-expansion-spending-ledger', budgetCents: 3000, planSha256: hash(String(planBytes)), receipts }
  await write(`${base}/spending-ledger.json`, ledger)
  await write(NEWSPAPER_PUBLIC_PLAN, { kind: 'ocr-newspaper-expansion-benchmark-status', cases, targets,
    spending: { accountedCents: 2.25, heldReservationCents: 0, settledConservativeCents: 0 } })
  const era = cases[1]!, evidenceImage = `${base}/originals/spacing-evidence.png`
  await write(evidenceImage, redDotPng)
  await write(`${base}/reference-adjudication-evidence.json`, { kind: 'ocr-newspaper-reference-adjudication-evidence', goldChangesApplied: false, primaryScoresChanged: false,
    entries: [{ caseId: era.id, input: era.input, inputSha256: era.inputSha256, canonicalReference: era.reference,
      canonicalReferenceSha256: era.referenceSha256, evidenceImage, evidenceImageSha256: hash(redDotPng), sourceCrop: { x: 0, y: 0, width: 1, height: 1 },
      imageTransform: { resampling: false }, printedReading: 'some one', frozenReferenceReading: 'someone', wordingInferredFromModelAgreement: false }] })
  await write(NEWSPAPER_EXECUTION_REPORT, '# Existing preparation report\n\nOriginal research preserved.\n')
  await mkdir(join(root, 'src/cli/commands/setup-and-utilities'), { recursive: true })
  await symlink(resolve('src/cli/commands/setup-and-utilities/models'), join(root, 'src/cli/commands/setup-and-utilities/models'), 'dir')
  const quote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`
  const bin = join(root, 'bin'); await mkdir(bin)
  await Bun.write(join(bin, 'bun'), `#!/bin/sh\nAUTOSHOW_PROJECT_ROOT=${quote(root)} exec ${quote(process.execPath)} "$@"\n`); await chmod(join(bin, 'bun'), 0o755)
  const env = { ...process.env, PATH: `${bin}:${process.env['PATH'] ?? ''}`, AUTOSHOW_PROJECT_ROOT: root }
  const options = { projectRoot: root, runConsensus: async (argv: readonly string[]) => {
    const process = Bun.spawn([Bun.which('bun')!, 'scripts/run.ts', ...argv], { cwd: resolve('.codex/skills/consensus'), env, stdout: 'pipe', stderr: 'pipe' })
    const [, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
    if (code) throw new Error(`Local consensus fixture failed: ${stderr}`)
  } }
  const repinPlan = async () => { const bytes = await write(`${base}/execution-plan.json`, plan); ledger.planSha256 = hash(String(bytes)); await write(`${base}/spending-ledger.json`, ledger) }
  const removeSlot = async (caseId: string, provider: string) => {
    const slot = slots.find(slot => slot.documentCaseId === caseId && slot.provider === provider)!
    const destination = `${base}/preserved-test-evidence/${caseId}/${provider}`; await mkdir(dirname(join(root, destination)), { recursive: true })
    await rename(join(root, slot.directory), join(root, destination))
    ledger.receipts = ledger.receipts.filter(receipt => !(receipt.documentCaseId === caseId && receipt.provider === provider))
    await write(`${base}/spending-ledger.json`, ledger)
    return slot
  }
  const terminal = async () => {
    const completed = []
    for (const slot of slots) if (await Bun.file(join(root, `${slot.directory}/dispatch.json`)).exists()) completed.push(slot)
    await write(`${base}/execution.json`, { status: 'blocked-retained-evidence', completedAt: '2026-10-23T12:01:00Z', planSha256: ledger.planSha256,
      intendedSlots: slots.length, completedSlots: completed.length, pendingSlots: slots.length - completed.length,
      lanes: { active: 0, activeByProvider: Object.fromEntries(targets.map(target => [target.provider, 0])), activeByModel: Object.fromEntries(targets.map(target => [`${target.provider}/${target.model}`, 0])) }, slots: completed })
  }
  return { root, write, read, plan, ledger, cases, slots, targets, options, repinPlan, removeSlot, terminal }
}

const publicFixture = async (includeGrok = false) => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-newspaper-public-report-')); roots.push(root)
  const write = async (path: string, value: unknown) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await Bun.write(join(root, path), typeof value === 'string' ? value : JSON.stringify(value))
  }
  const read = async (path: string) => Bun.file(join(root, path)).json()
  const targets = [{ provider: 'tesseract', model: 'tesseract' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'gemini', model: 'gemini-3.8-flash' },
    ...(includeGrok ? [{ provider: 'grok', model: 'grok-4.7' }] : [])]
  const cases = ['newspapers-expansion-layout-fixture', 'newspapers-expansion-new-york-times-fixture'].map(id => ({ id, scope: 'full-page',
    runDir: `docs/benchmarks/text/ocr/${id}`, reference: `${base}/cases/${id}/canonical-reference.txt`, referenceSha256: 'a'.repeat(64),
    normalizedReference: `${base}/cases/${id}/normalized-reference.txt`, normalizedReferenceSha256: 'b'.repeat(64) }))
  const lineCounts = { nonemptyLogicalLines: 1, uniqueLogicalLines: 1, duplicateLineOccurrences: 0, repeatedLineKinds: 0, maximumIdenticalLineOccurrences: 1, maximumConsecutiveIdenticalLineRun: 1 }
  for (const [index, entry] of cases.entries()) {
    const reference = { kind: 'publisher-canonical', path: entry.normalizedReference, sha256: entry.normalizedReferenceSha256 }
    const providers = targets.map(target => ({ service: target.provider, model: target.model,
      status: index === 1 && ['gemini', 'grok'].includes(target.provider) ? 'failed' : 'succeeded',
      metadata: { pageEvidence: [{ failureKind: target.provider === 'grok' ? 'accounting-allowance-breach' : 'output-limit' }] } }))
    await write(`${entry.runDir}/manifest.json`, { reference, source: { originalCanonicalReference: { path: entry.reference, sha256: entry.referenceSha256 },
      coverage: { configuredModels: 4, successfulModels: index === 1 ? 3 : 4 } }, items: [{ providers }] })
    const successful = providers.filter(row => row.status === 'succeeded')
    await write(`${entry.runDir}/provider-comparison-report.json`, { referenceProvenance: { ...reference, independentOfProviders: true }, providerGroups: {
      local: { providers: successful.filter(row => row.service === 'tesseract').map(row => ({ providerKey: `${row.service}/${row.model}`, metrics: { score: 50 } })) },
      thirdPartyService: { providers: successful.filter(row => row.service !== 'tesseract').map(row => ({ providerKey: `${row.service}/${row.model}`, metrics: { score: row.service === 'anthropic' ? 90 : 80 } })) }
    } })
    await write(`${entry.runDir}/evaluation-diagnostics.json`, { caseId: entry.id, reference, providers: successful.map(row => ({ providerKey: `${row.service}/${row.model}`,
      tokenMultiset: { referenceTokenCount: 10, candidateTokenCount: 10, matchedTokenCount: 8, missingTokenCount: 2, unmatchedTokenCount: 2, precision: 0.8, recall: 0.8, f1: 0.8 },
      repetition: { reference: lineCounts, candidate: lineCounts } })) })
  }
  const plan = { kind: 'ocr-newspaper-expansion-benchmark-status', cases, targets: [...targets, { provider: 'retired', model: 'historical-only' }],
    currentCohort: { targets }, spending: { accountedCents: 25, heldReservationCents: 10, settledConservativeCents: 0 } }
  await write(NEWSPAPER_PUBLIC_PLAN, plan)
  const historical = '<!-- newspaper-execution:start -->\n\nHistorical 21-target results: 246/252.\n\n<!-- newspaper-execution:end -->'
  await write(NEWSPAPER_EXECUTION_REPORT, `# Expansion\n\n${historical}\n\nOther research remains.\n`)
  return { root, write, read, cases, plan, historical, options: { projectRoot: root } }
}

describe('Newspaper matched-input arithmetic, with explicit completion coverage', () => {
  test('rebuild CLI accepts explicit authorized-case selection and rejects malformed or analysis-only filters', () => {
    expect(parseNewspaperReportArguments([]).action).toBe('--analyze')
    expect(parseNewspaperReportArguments(['--generate']).action).toBe('--generate')
    expect(parseNewspaperReportArguments(['--analyze-historical']).action).toBe('--analyze-historical')
    expect(parseNewspaperReportArguments(['--rebuild-authorized', '--case', 'newspapers-expansion-first', '--case', 'newspapers-expansion-second'])).toMatchObject({ action: '--rebuild-authorized', buildCaseIds: ['newspapers-expansion-first', 'newspapers-expansion-second'] })
    for (const args of [['--case', 'newspapers-expansion-first'], ['--analyze', '--case', 'newspapers-expansion-first'], ['--generate', '--case', 'newspapers-expansion-first'], ['--rebuild-authorized', '--case'], ['--rebuild-authorized', '--case', '../escape'], ['--rebuild-authorized', '--case', 'newspapers-expansion-first', '--case', 'newspapers-expansion-first']]) expect(() => parseNewspaperReportArguments(args)).toThrow('Usage:')
  })
  test('compares the same common inputs and preserves a valid zero score without giving failures a zero', () => {
    const targets = [{ provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'gemini', model: 'gemini-3.8-flash' }]
    const panels = summarizeNewspaperPanels([
      { id: 'easy', panel: 'whole-page-layout', outcomes: [{ providerKey: 'anthropic/claude-sonnet-5-5', status: 'succeeded', score: 100 }, { providerKey: 'gemini/gemini-3.8-flash', status: 'succeeded', score: 90 }] },
      { id: 'hard', panel: 'whole-page-layout', outcomes: [{ providerKey: 'anthropic/claude-sonnet-5-5', status: 'succeeded', score: 0 }, { providerKey: 'gemini/gemini-3.8-flash', status: 'failed', score: null }] }
    ], targets)
    const group = panels[0]!.groups.find(group => group.group === 'thirdPartyService')!
    expect(group.matchedCaseIds).toEqual(['easy'])
    expect(group.models[0]).toMatchObject({ providerKey: 'anthropic/claude-sonnet-5-5', meanScoreOnCompletedInputs: 50, matchedMeanScore: 100, completedInputs: 2 })
    expect(group.models[1]).toMatchObject({ completionRate: 0.5, meanScoreOnCompletedInputs: 90, matchedMeanScore: 90, failedInputs: 1 })
    expect(panels[0]!.comparisons[0]).toMatchObject({ commonInputs: 1, meanScoreDifferenceAminusB: 10, modelAWins: 1 })
  })
  test('rejects incomplete/duplicate matrices, out-of-range scores and any invented failed-output score', () => {
    const targets = [{ provider: 'gemini', model: 'gemini-3.8-flash' }]
    for (const score of [0, 100]) expect(() => summarizeNewspaperPanels([{ id: 'case', panel: 'region-recognition', outcomes: [{ providerKey: 'gemini/gemini-3.8-flash', status: 'failed', score }] }], targets)).toThrow('cannot receive')
    expect(() => summarizeNewspaperPanels([{ id: 'case', panel: 'region-recognition', outcomes: [] }], targets)).toThrow('matrix')
    expect(() => summarizeNewspaperPanels([], [...targets, ...targets])).toThrow('identities')
    expect(() => summarizeNewspaperPanels([{ id: 'case', panel: 'region-recognition', outcomes: [{ providerKey: 'gemini/gemini-3.8-flash', status: 'succeeded', score: 101 }] }], targets)).toThrow('cannot receive')
  })
  test('identical matched scores share a rank rather than presenting alphabetical order as a quality gap', () => {
    const targets = [{ provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'gemini', model: 'gemini-3.8-flash' }]
    const result = summarizeNewspaperPanels([{ id: 'case', panel: 'region-recognition', outcomes: targets.map(target => ({ providerKey: `${target.provider}/${target.model}`, status: 'succeeded' as const, score: 100 })) }], targets)
    expect(result[1]!.groups.find(group => group.group === 'thirdPartyService')!.models.map(model => model.matchedRank)).toEqual([1, 1])
  })
  test('native completion flags are separate from transport success and failure messages remain private', () => {
    expect(() => assertNewspaperOcrResultComplete({ text: '' }, {})).not.toThrow()
    for (const flag of [{ finishReason: 'MAX_TOKENS' }, { status: 'incomplete' }, { truncated: true }, { incomplete_details: { reason: 'max_output_tokens' } }]) expect(() => assertNewspaperOcrResultComplete(flag, {})).toThrow()
    expect(() => assertNewspaperOcrResultComplete({}, { stop_reason: 'max_tokens' })).toThrow('native output limit')
    expect(classifyNewspaperOcrFailure({ code: 'OCR_OUTPUT_TOKEN_LIMIT', message: secret })).toBe('output-limit')
    expect(classifyNewspaperOcrFailure({ message: `Spending guard budget exhausted ${secret}` })).toBe('budget-blocked')
    expect(classifyNewspaperOcrFailure({ code: 'ECONNRESET' })).toBe('transport')
    expect(classifyNewspaperFailureLog(JSON.stringify({ error: { name: 'AppProviderError', message: `Your credit balance is too low ${secret}` } }, null, 2))).toBe('provider-credit-blocked')
    expect(classifyNewspaperFailureLog(JSON.stringify({ error: { name: 'Error', message: 'OCR spending guard: reported usage exceeded the reserved allowance; further dispatch blocked' } }))).toBe('accounting-allowance-breach')
  })
  test('multiset F1 ignores reordered words while ordered WER changes, and both sides use reading normalization', () => {
    const gold = 'Alpha beta gamma.', shuffled = 'gamma Alpha beta.'
    expect(levenshteinDistance(tokenize(gold), tokenize(shuffled))).toBeGreaterThan(0)
    expect(scoreNewspaperTokenMultiset(gold, shuffled)).toMatchObject({ precision: 1, recall: 1, f1: 1, matchedTokenCount: 3 })
    expect(scoreNewspaperTokenMultiset('ſhort ﬁeld “alpha”—beta', 'beta short field alpha')).toMatchObject({ precision: 1, recall: 1, f1: 1 })
  })
  test('multiset duplicate, missing and substituted words affect exact occurrence counts without implying geometry', () => {
    const result = scoreNewspaperTokenMultiset('one one two three', 'one two wrong wrong')
    expect(result).toMatchObject({ matchedTokenCount: 2, missingTokenCount: 2, unmatchedTokenCount: 2, precision: 0.5, recall: 0.5, f1: 0.5 })
    expect(scoreNewspaperTokenMultiset('one two', '')).toMatchObject({ precision: 0, recall: 0, f1: 0 })
    expect(result.policy).toContain('not spatial accuracy')
  })
  test('ERA spacing equivalence is secondary, symmetric, case-specific and does not mutate primary text', () => {
    const gold = 'They saw someone.', candidate = 'They saw some one.'
    expect(levenshteinDistance(tokenize(gold), tokenize(candidate))).toBe(2)
    expect(scoreNewspaperSpacingConvention('newspapers-expansion-bln-era-burglars', gold, candidate)).toMatchObject({ wordEdits: 0, wordErrorRate: 0, qualityScore: 100, primaryMetricsUnchanged: true })
    expect(scoreNewspaperSpacingConvention('newspapers-expansion-bln-era-burglars', candidate, gold)).toMatchObject({ wordEdits: 0, wordErrorRate: 0 })
    expect(scoreNewspaperSpacingConvention('newspapers-expansion-other', gold, candidate)).toBeNull()
    expect(gold).toBe('They saw someone.'); expect(candidate).toBe('They saw some one.')
  })
  test('repetition diagnostics count duplicate occurrences and runs without exposing text or asserting geometry', () => {
    const result = scoreNewspaperRepetition('Alpha\nBeta', 'Alpha\\nAlpha\nBeta\nAlpha')
    expect(result.reference).toMatchObject({ nonemptyLogicalLines: 2, duplicateLineOccurrences: 0, maximumIdenticalLineOccurrences: 1 })
    expect(result.candidate).toMatchObject({ nonemptyLogicalLines: 4, uniqueLogicalLines: 2, duplicateLineOccurrences: 2, maximumIdenticalLineOccurrences: 3, maximumConsecutiveIdenticalLineRun: 2 })
    expect(JSON.stringify(result)).not.toContain('Alpha'); expect(JSON.stringify(result)).not.toContain('Beta')
  })
})

describe('Newspaper saved-artifact report integration, without provider calls', () => {
  test('filtered rebuild dispatches only the selected local reports, preserves other reports and still validates the full batch', async () => {
    const f = await fixture(); await buildNewspaperExpansionReports(f.options)
    const untouched = f.cases.slice(0, 2), selected = f.cases[2]!
    const before = await Promise.all(untouched.map(entry => Bun.file(join(f.root, `${entry.runDir}/provider-comparison-report.json`)).text()))
    const calls: string[] = []
    const options = { ...f.options, buildCaseIds: [selected.id], runConsensus: async (argv: readonly string[], caseId: string) => { calls.push(caseId); await f.options.runConsensus(argv) } }
    const analysis = await buildNewspaperExpansionReports(options)
    expect(calls).toEqual([selected.id, selected.id]); expect(analysis).toMatchObject({ caseCount: 3, selectedSlots: 12, completedSlots: 11 })
    for (let index = 0; index < untouched.length; index++) expect(await Bun.file(join(f.root, `${untouched[index]!.runDir}/provider-comparison-report.json`)).text()).toBe(before[index]!)
    for (const buildCaseIds of [[], [selected.id, selected.id], ['newspapers-expansion-unapproved']]) await expect(buildNewspaperExpansionReports({ ...options, buildCaseIds })).rejects.toThrow('distinct authorized cases')
    calls.length = 0
    await f.write(`${f.slots[0]!.directory}/result.json`, { text: 'invalid unselected artifact' })
    await expect(buildNewspaperExpansionReports(options)).rejects.toThrow('artifact checksum changed')
    expect(calls).toEqual([])
  })
  test('real local consensus reports normalize both sides, preserve raw artifacts and retain failed capacity coverage', async () => {
    const f = await fixture(), entry = f.cases[0]!, slot = f.slots.find(slot => slot.documentCaseId === entry.id && slot.provider === 'anthropic')!
    const original = await Bun.file(join(f.root, `${slot.directory}/result.json`)).bytes()
    const inspected = await inspectNewspaperExpansionReports(f.options)
    expect(inspected.cases[2]!.failedModels).toBe(1)
    expect(await Bun.file(join(f.root, `${entry.runDir}/manifest.json`)).exists()).toBe(false)
    const analysis = await buildNewspaperExpansionReports(f.options)
    expect(analysis).toMatchObject({ selectedSlots: 12, completedSlots: 11, failedSlots: 1, notDispatchedSlots: 0 })
    expect(await Bun.file(join(f.root, `${slot.directory}/result.json`)).bytes()).toEqual(original)
    const report = await f.read(`${entry.runDir}/provider-comparison-report.json`)
    expect(report.providerGroups.thirdPartyService.providers.every((row: { metrics: { score: number } }) => row.metrics.score === 100)).toBe(true)
    expect(report.referenceProvenance).toMatchObject({ path: entry.normalizedReference, sha256: entry.normalizedReferenceSha256, independentOfProviders: true })
    expect(report.evaluation.analysisVariant).toBe('newspaper-reading-normalized-v1')
    const literal = await f.read(`${entry.runDir}/evaluation-diagnostics.json`)
    expect(literal.literalReference.path).toBe(entry.reference)
    expect(literal.providers.find((row: { provider: string }) => row.provider === 'anthropic').strictTextExact).toBe(false)
    expect(literal.providers.find((row: { provider: string }) => row.provider === 'anthropic').tokenMultiset.f1).toBe(1)
    const eraReport = await f.read(`${f.cases[1]!.runDir}/provider-comparison-report.json`)
    expect(eraReport.providerGroups.thirdPartyService.providers[0].metrics.score).toBeLessThan(100)
    expect(analysis.secondarySourceConventions.find(row => row.providerKey.startsWith('anthropic/'))).toMatchObject({ wordEdits: 0, qualityScore: 100 })
    const manifest = await f.read(`${entry.runDir}/manifest.json`)
    expect(manifest.source.originalCanonicalReference.path).toBe(entry.reference)
    const capacity = analysis.panels.find(panel => panel.panel === 'very-long-page-capacity')!
    const hosted = capacity.groups.find(group => group.group === 'thirdPartyService')!
    expect(hosted.matchedCaseIds).toEqual([])
    expect(hosted.models.find(model => model.providerKey.startsWith('grok/'))).toMatchObject({ completedInputs: 0, failedInputs: 1, matchedMeanScore: null, meanScoreOnCompletedInputs: null, failureKinds: { 'output-limit': 1 } })
    for (const c of f.cases) for (const file of ['manifest.json', 'case-metadata.json', 'evaluation-diagnostics.json', 'provider-comparison-report.json', 'provider-comparison-report.md', 'page-metrics.json', 'outliers.json', 'selective-adjudication-pages.json', 'variant-comparison-summary.json', 'ocr-benchmark-summary.md']) {
      const text = await Bun.file(join(f.root, `${c.runDir}/${file}`)).text()
      expect(text).not.toContain(secret); expect(text).not.toContain('apiKey'); expect(text).not.toContain('rawResponse')
    }
    expect(newspaperExecutionMarkdown(analysis)).toContain('11/12 provider-completed/scorable')
    const retained = await analyzeRetainedNewspaperExpansionReports(f.options)
    await updateNewspaperExecutionSection(retained, f.options); await updateNewspaperExecutionSection(retained, f.options)
    const taskReport = await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()
    expect(taskReport).toContain('Original research preserved.'); expect(taskReport.split('<!-- newspaper-current-cohort:start -->')).toHaveLength(2)
    expect(taskReport).not.toContain(secret)
  })
  test('rejects false native completion flags and mismatched inline artifacts before public writes', async () => {
    for (const mode of ['native-limit', 'sidecar-mismatch']) {
      const f = await fixture(), slot = f.slots[0]!
      if (mode === 'native-limit') {
        const manifest = await f.read(`${slot.directory}/manifest.json`); manifest.items[0].providers[0].metadata.finishReason = 'length'
        const bytes = await f.write(`${slot.directory}/manifest.json`, manifest); slot.manifestSha256 = hash(String(bytes)); slot.artifactHashes[0]!.sha256 = slot.manifestSha256; await f.write(`${slot.directory}/dispatch.json`, slot)
      } else await f.write(`${slot.directory}/result.json`, { text: 'invalid artifact' })
      await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow(mode === 'native-limit' ? 'native output limit' : 'artifact checksum changed')
      expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).exists()).toBe(false)
    }
  })
  test('a valid empty decoded page is scorable zero/recall zero while a missing text field is an invalid artifact', async () => {
    for (const mode of ['empty', 'absent']) {
      const f = await fixture(), slot = f.slots[0]!, manifest = await f.read(`${slot.directory}/manifest.json`)
      const result = manifest.items[0].providers[0].result
      result.text = ''; result.pages[0].text = ''
      if (mode === 'absent') delete result.pages[0].text
      const resultBytes = await f.write(`${slot.directory}/result.json`, result)
      const manifestBytes = await f.write(`${slot.directory}/manifest.json`, manifest)
      await f.write(`${slot.directory}/extraction.txt`, '')
      slot.manifestSha256 = hash(String(manifestBytes)); slot.artifactHashes = [
        { path: `${slot.directory}/manifest.json`, sha256: slot.manifestSha256 }, { path: `${slot.directory}/result.json`, sha256: hash(String(resultBytes)) },
        { path: `${slot.directory}/extraction.txt`, sha256: hash('') }
      ]; await f.write(`${slot.directory}/dispatch.json`, slot)
      if (mode === 'absent') await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow('lacks exactly one')
      else {
        const analysis = await buildNewspaperExpansionReports(f.options)
        expect(analysis.cases[0]!.outcomes[0]).toMatchObject({ status: 'succeeded', score: 0, tokenMultiset: { precision: 0, recall: 0, f1: 0 } })
      }
    }
  })
  test('pinned failure logs without a manifest classify native limits, credit configuration and transport separately', async () => {
    const errors = [
      { name: 'OcrStructuredResponseError', message: `Reached its output token limit ${secret}`, expected: 'output-limit' },
      { name: 'AppProviderError', message: `Your credit balance is too low ${secret}`, expected: 'provider-credit-blocked' },
      { name: 'RequestTimeoutError', message: `Socket timed out ${secret}`, expected: 'transport' }
    ]
    for (const error of errors) {
      const f = await fixture(), slot = await f.removeSlot(f.cases[2]!.id, 'grok')
      const failurePath = `${slot.directory}/failure.txt`, payload = JSON.stringify({ type: 'error', error }, null, 2)
      await f.write(failurePath, payload)
      slot.manifestSha256 = null; slot.artifactHashes = [{ path: failurePath, sha256: hash(payload) }]
      await f.write(`${slot.directory}/dispatch.json`, slot)
      const analysis = await buildNewspaperExpansionReports(f.options)
      expect(analysis.cases[2]!.outcomes.find(row => row.providerKey.startsWith('grok/'))).toMatchObject({ status: 'failed', score: null, failureKind: error.expected })
      expect(await Bun.file(join(f.root, `${f.cases[2]!.runDir}/manifest.json`)).text()).not.toContain(secret)
    }
  })
  test('rejects changed normalized gold, held source IDs and approval reuse before public writes', async () => {
    for (const mode of ['gold', 'held', 'approval']) {
      const f = await fixture()
      if (mode === 'gold') await f.write(f.cases[0]!.normalizedReference, 'changed')
      else { if (mode === 'held') f.plan.cases[0]!.id = 'newspapers-expansion-north-star-held'; else f.plan.approval.evidence = 'User approved up to $30 for categories 5–7'; await f.repinPlan() }
      await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow(mode === 'gold' ? 'normalized reference' : mode === 'held' ? 'provenance' : 'report profile')
      expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).exists()).toBe(false)
    }
    const f = await fixture()
    await expect(inspectBcOcrReports({ ...f.options, planPath: `${base}/execution-plan.json`, ledgerPath: `${base}/spending-ledger.json` })).rejects.toThrow('report profile')
  })
  test('missing slots require exact terminal no-active-work evidence and no admitted receipts', async () => {
    const f = await fixture(); await f.removeSlot(f.cases[0]!.id, 'gemini')
    await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow()
    await f.terminal()
    const e = await f.read(`${base}/execution.json`); e.lanes.active = 1; await f.write(`${base}/execution.json`, e)
    await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow('terminal execution')
    e.lanes.active = 0; e.slots.pop(); await f.write(`${base}/execution.json`, e)
    await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow('slot inventory')
    await f.terminal()
    const analysis = await buildNewspaperExpansionReports(f.options)
    expect(analysis).toMatchObject({ completedSlots: 10, failedSlots: 1, notDispatchedSlots: 1 })
    const manifest = await f.read(`${f.cases[0]!.runDir}/manifest.json`)
    expect(manifest.source.coverage.status).toBe('terminal-not-fully-dispatched')
    expect(manifest.items[0].providers.find((row: { service: string }) => row.service === 'gemini').status).toBe('missing')
  })
  test('a zero-completion case publishes selected coverage and has no invented comparison report', async () => {
    const f = await fixture(), id = f.cases[2]!.id
    for (const target of f.targets) await f.removeSlot(id, target.provider)
    await f.terminal()
    const analysis = await buildNewspaperExpansionReports(f.options)
    expect(analysis).toMatchObject({ completedSlots: 8, failedSlots: 0, notDispatchedSlots: 4 })
    expect(await Bun.file(join(f.root, `${f.cases[2]!.runDir}/provider-comparison-report.json`)).exists()).toBe(false)
    expect((await f.read(`${f.cases[2]!.runDir}/manifest.json`)).source.coverage.successfulModels).toBe(0)
  })
  test('a terminal snapshot cannot turn an orphan paid receipt or an interrupted journal into an unattempted slot', async () => {
    for (const mode of ['orphan-receipt', 'interrupted']) {
      const f = await fixture(), slot = await f.removeSlot(f.cases[0]!.id, 'gemini')
      if (mode === 'orphan-receipt') {
        f.ledger.receipts.push({ ...f.ledger.receipts[0]!, id: 'orphan-receipt', invocationId: 'orphan-receipt',
          caseId: slot.caseId, documentCaseId: slot.documentCaseId, provider: slot.provider, model: slot.model, inputSha256: slot.inputSha256 })
        await f.write(`${base}/spending-ledger.json`, f.ledger)
      } else await f.write(`${slot.directory}/dispatch.json`, { ...slot, status: 'dispatch-started', manifestSha256: null })
      await f.terminal()
      await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow('not confirmed terminal and unattempted')
      expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).exists()).toBe(false)
    }
  })
  test('analysis rejects stale failed-output quality rows and execution markers reject partial edits', async () => {
    const f = await fixture(); const analysis = await buildNewspaperExpansionReports(f.options)
    const c = f.cases[2]!, report = await f.read(`${c.runDir}/provider-comparison-report.json`)
    report.providerGroups.thirdPartyService.providers.push({ providerKey: 'grok/grok-4.7', metrics: { score: 0 } })
    await f.write(`${c.runDir}/provider-comparison-report.json`, report)
    await expect(analyzeNewspaperExpansionReports(f.options)).rejects.toThrow('stale quality')
    await f.write(NEWSPAPER_EXECUTION_REPORT, '<!-- newspaper-execution:start -->')
    await expect(updateNewspaperExecutionSection(analysis, f.options)).rejects.toThrow('markers')
  })
  test('the ERA source convention requires hash-matched input, unchanged primary gold and an exact evidence crop', async () => {
    for (const mode of ['wrong-reference', 'changed-evidence', 'wrong-pixels']) {
      const f = await fixture(), path = `${base}/reference-adjudication-evidence.json`, proof = await f.read(path)
      if (mode === 'wrong-reference') proof.entries[0].canonicalReferenceSha256 = 'a'.repeat(64)
      else if (mode === 'changed-evidence') await f.write(proof.entries[0].evidenceImage, 'corrupt evidence')
      else {
        const process = Bun.spawn(['magick', 'png:-', '-negate', 'PNG32:-'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
        process.stdin.write(redDotPng); process.stdin.end()
        const [bytes, stderr, code] = await Promise.all([new Response(process.stdout).arrayBuffer(), new Response(process.stderr).text(), process.exited])
        if (code) throw new Error(stderr)
        const altered = new Uint8Array(bytes); await f.write(proof.entries[0].evidenceImage, altered); proof.entries[0].evidenceImageSha256 = hash(altered)
      }
      await f.write(path, proof)
      await expect(buildNewspaperExpansionReports(f.options)).rejects.toThrow(mode === 'wrong-reference' ? 'pinned input/reference' : mode === 'changed-evidence' ? 'checksum changed' : 'pixels differ')
      expect(await Bun.file(join(f.root, `${f.cases[0]!.runDir}/manifest.json`)).exists()).toBe(false)
    }
  })
})

describe('Retained newspaper cohort reporting from public artifacts only', () => {
  test('the generate command writes its current section and emits a bounded summary', async () => {
    const f = await publicFixture()
    const child = Bun.spawn([process.execPath, resolve('src/tools/ocr-newspaper-expansion-report.ts'), '--generate'], {
      env: { ...process.env, AUTOSHOW_PROJECT_ROOT: f.root }, stdout: 'pipe', stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(exitCode).toBe(0); expect(stderr).toBe('')
    expect(JSON.parse(stdout)).toEqual({ kind: 'ocr-newspaper-expansion-report-generation', cohort: 'current-retained',
      caseCount: 2, targetCount: 3, completedSlots: 5, selectedSlots: 6, failedSlots: 1, reportPath: 'docs/reports/repository-improvement-actions.md' })
    expect(stdout.length).toBeLessThan(1000)
    const report = await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()
    expect(report).toContain(f.historical); expect(report).toContain('<!-- newspaper-current-cohort:start -->')
    expect(report).toContain('### Current retained newspaper cohort')
    expect(report).not.toContain('Matched mean')
    expect(report.split('\n').length).toBeLessThan(30)
  })

  test('keeps both saved failures and the permanent Grok restriction in compact generation while retaining detailed export', async () => {
    const f = await publicFixture(true), analysis = await analyzeRetainedNewspaperExpansionReports(f.options)
    const compact = newspaperCurrentCohortMarkdown(analysis)
    expect(compact).toContain('6/8 provider-completed/scorable')
    expect(compact).toContain('2 admitted inputs / 4 retained targets')
    expect(compact).toContain('gemini/gemini-3.8-flash')
    expect(compact).toContain('grok/grok-4.7')
    expect(compact).toContain('accounting-allowance-breach')
    expect(compact).toContain('The original Grok slot is permanently prohibited from redispatch; preserve the full accounting hold.')
    expect(compact).toContain('not the cost of the retained cohort')
    expect(compact).toContain('../benchmarks/text/ocr/newspaper-expansion-execution-plan.json')
    expect(compact.split('\n').length).toBeLessThan(20)
    expect(compact).not.toContain('Matched mean')
    expect(newspaperExecutionMarkdown(analysis)).toContain('Matched mean /100')
    await updateNewspaperExecutionSection(analysis, f.options)
    const report = await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()
    expect(report).toContain(compact)
    expect(report).toContain(f.historical)
    expect(report).not.toContain('Matched mean /100')
  })

  test('derives the selected matrix and matched comparisons without opening private gold or execution files', async () => {
    const f = await publicFixture()
    expect(await Bun.file(join(f.root, `${base}/execution-plan.json`)).exists()).toBe(false)
    expect(await Bun.file(join(f.root, f.cases[0]!.normalizedReference)).exists()).toBe(false)
    const analysis = await analyzeRetainedNewspaperExpansionReports(f.options)
    expect(analysis).toMatchObject({ cohort: 'current-retained', provenance: NEWSPAPER_PUBLIC_PLAN, spendingScope: 'historical-approved-batch',
      caseCount: 2, targetCount: 3, selectedSlots: 6, completedSlots: 5, failedSlots: 1, runningSlots: 0, notDispatchedSlots: 0 })
    const layout = analysis.panels[0]!, capacity = analysis.panels[2]!
    expect(layout.comparisons).toMatchObject([{ commonInputs: 1, meanScoreDifferenceAminusB: 10 }])
    expect(layout.groups.find(group => group.group === 'thirdPartyService')!.matchedCaseIds).toEqual([f.cases[0]!.id])
    expect(capacity.groups.find(group => group.group === 'thirdPartyService')!.matchedCaseIds).toEqual([])
    expect(capacity.groups.find(group => group.group === 'local')!.matchedCaseIds).toEqual([f.cases[1]!.id])
    expect(analysis.cases[1]!.outcomes.find(row => row.providerKey.startsWith('gemini/'))).toMatchObject({ status: 'failed', score: null, failureKind: 'output-limit' })
    const markdown = newspaperExecutionMarkdown(analysis)
    expect(markdown).toContain('Historical full-batch accounted cost')
    expect(markdown).toContain('not the cost of the retained cohort')
    await expect(analyzeRetainedNewspaperExpansionReports({ ...f.options, buildCaseIds: [f.cases[0]!.id] })).rejects.toThrow('cannot rebuild')
  })

  test('refreshes only its own marked section and preserves frozen history and authorization bytes', async () => {
    const f = await publicFixture()
    const planText = 'Original approved private plan; its ledger pins these exact bytes.\n'
    const ledgerText = JSON.stringify({ planSha256: hash(planText) })
    await f.write(`${base}/execution-plan.json`, planText); await f.write(`${base}/spending-ledger.json`, ledgerText)
    const before = await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()
    const analysis = await analyzeRetainedNewspaperExpansionReports(f.options)
    await updateNewspaperExecutionSection(analysis, f.options)
    const first = await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()
    await updateNewspaperExecutionSection(analysis, f.options)
    expect(await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()).toBe(first)
    expect(first.startsWith(before)).toBe(true)
    expect(first).toContain(f.historical)
    expect(first.split('<!-- newspaper-current-cohort:start -->')).toHaveLength(2)
    expect(first).toContain('5/6 provider-completed/scorable')
    expect(await Bun.file(join(f.root, `${base}/execution-plan.json`)).text()).toBe(planText)
    expect(await Bun.file(join(f.root, `${base}/spending-ledger.json`)).text()).toBe(ledgerText)
    await expect(updateNewspaperExecutionSection({ ...analysis, cohort: 'historical-approved' }, f.options)).rejects.toThrow('historical execution remains frozen')
    expect(await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()).toBe(first)
  })

  for (const mode of ['inventory', 'quality-reference', 'provider-derived-reference', 'diagnostic-reference', 'stale-failed-score', 'missing-quality', 'invalid-diagnostic', 'unknown-diagnostic', 'duplicate-target', 'destination']) test(`rejects invalid public evidence: ${mode}`, async () => {
    const f = await publicFixture(), entry = f.cases[1]!
    if (mode === 'inventory') {
      const manifest = await f.read(`${entry.runDir}/manifest.json`); manifest.items[0].providers.pop(); await f.write(`${entry.runDir}/manifest.json`, manifest)
    } else if (mode === 'quality-reference' || mode === 'provider-derived-reference' || mode === 'stale-failed-score' || mode === 'missing-quality') {
      const path = `${entry.runDir}/provider-comparison-report.json`, report = await f.read(path)
      if (mode === 'quality-reference') report.referenceProvenance.sha256 = 'c'.repeat(64)
      else if (mode === 'provider-derived-reference') report.referenceProvenance.independentOfProviders = false
      else if (mode === 'missing-quality') report.providerGroups.local.providers = []
      else report.providerGroups.thirdPartyService.providers.push({ providerKey: 'gemini/gemini-3.8-flash', metrics: { score: 0 } })
      await f.write(path, report)
    } else if (mode === 'diagnostic-reference' || mode === 'invalid-diagnostic' || mode === 'unknown-diagnostic') {
      const path = `${entry.runDir}/evaluation-diagnostics.json`, diagnostics = await f.read(path)
      if (mode === 'diagnostic-reference') diagnostics.reference.sha256 = 'c'.repeat(64)
      else if (mode === 'invalid-diagnostic') diagnostics.providers[0].tokenMultiset.precision = 2
      else diagnostics.providers.push({ providerKey: 'retired/historical-only' })
      await f.write(path, diagnostics)
    } else {
      if (mode === 'duplicate-target') f.plan.currentCohort.targets.push(f.plan.currentCohort.targets[0]!)
      else f.plan.cases[1]!.runDir = '../outside'
      await f.write(NEWSPAPER_PUBLIC_PLAN, f.plan)
    }
    const errors: Record<string, string> = { inventory: 'target inventory', 'quality-reference': 'metric report or scoring reference', 'provider-derived-reference': 'metric report or scoring reference',
      'diagnostic-reference': 'diagnostic coverage or reference', 'stale-failed-score': 'stale quality row', 'missing-quality': 'lacks its quality score',
      'invalid-diagnostic': 'Invalid value', 'unknown-diagnostic': 'unselected target', 'duplicate-target': 'Duplicate newspaper', destination: 'Invalid admitted' }
    await expect(analyzeRetainedNewspaperExpansionReports(f.options)).rejects.toThrow(errors[mode]!)
  })

  test('rejects reversed, overlapping and partial markers without editing frozen report text', async () => {
    const f = await publicFixture(), analysis = await analyzeRetainedNewspaperExpansionReports(f.options)
    for (const text of ['<!-- newspaper-current-cohort:end --><!-- newspaper-current-cohort:start -->',
      '<!-- newspaper-execution:start -->',
      '<!-- newspaper-execution:start --><!-- newspaper-current-cohort:start --><!-- newspaper-current-cohort:end --><!-- newspaper-execution:end -->']) {
      await f.write(NEWSPAPER_EXECUTION_REPORT, text)
      await expect(updateNewspaperExecutionSection(analysis, f.options)).rejects.toThrow('markers')
      expect(await Bun.file(join(f.root, NEWSPAPER_EXECUTION_REPORT)).text()).toBe(text)
    }
  })
})
