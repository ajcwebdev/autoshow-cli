import { afterEach, describe, expect, test } from 'bun:test'
import { dirname, join, relative } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import {
  buildRevisionComparisonPrompt,
  computeRevisionPlanFingerprint,
  decideRevisionPromotion,
  loadRevisionEvaluationPlan,
  loadRevisionPriceInventory,
  measureRevisionSimilarity,
  normalizeRevisionComparison,
  parseRevisionComparison,
  parseRevisionPlan,
  runRevisionEvaluation,
  type RevisionEvaluationDependencies,
  type RevisionComparisonRaw,
  type RevisionPlan,
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/revision-evaluation'
import { createComicSourceIdentity, createStructuredScriptArtifactRef } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-audio-contracts'
import { recordComicImageRevision, updateComicImageManifest, writeInitialComicStructureManifest } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-manifest'
import { canonicalTargetKey } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type { GenerateImagesCommandOptions, PanelBundleData, PipelineProviderState } from '~/types'
import { getFfmpegBinary, PROJECT_ROOT, toPosixPath } from '~/utils/runtime-paths'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const sha256Bytes = (value: Uint8Array): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const sha256File = async (path: string): Promise<string> => sha256Bytes(new Uint8Array(await Bun.file(path).arrayBuffer()))
const projectPath = (path: string): string => toPosixPath(relative(PROJECT_ROOT, path))

const comparison = (candidateIsA: boolean, preference: 'candidate' | 'original' | 'tie' = 'candidate'): RevisionComparisonRaw => ({
  targetedDefectStatusImageA: candidateIsA ? 'not-visible' : 'visible',
  targetedDefectStatusImageB: candidateIsA ? 'visible' : 'not-visible',
  targetedDefectLowerIn: candidateIsA ? 'image-a' : 'image-b',
  differenceMeaningful: true,
  majorRegressionImageA: false,
  majorRegressionImageB: false,
  nonTargetDifferenceLevel: 'none',
  preservationRequirementsSatisfiedImageA: true,
  preservationRequirementsSatisfiedImageB: true,
  nonTargetDifferences: [],
  fullContractPreference: preference === 'tie' ? 'tie' : preference === 'candidate' ? candidateIsA ? 'image-a' : 'image-b' : candidateIsA ? 'image-b' : 'image-a',
  confidence: 'high',
  regressionsImageA: [],
  regressionsImageB: [],
  rationale: 'The targeted issue is visibly corrected without collateral changes.',
})

type Fixture = { options: GenerateImagesCommandOptions; plan: RevisionPlan; runDirectory: string; canonicalPath: string; planPath: string; originalBytes: Buffer }
const recordPublishedManifest: NonNullable<RevisionEvaluationDependencies['recordManifest']> = async input => { await input.publishFinal?.() }

const createFixture = async (root: string, importance: RevisionPlan['entries'][number]['importance'] = 'high'): Promise<Fixture> => {
  const sceneSlug = `revision-${crypto.randomUUID()}`
  const runDirectory = join(root, 'scene')
  beginSceneRun(sceneSlug, { outputDir: runDirectory })
  const scriptPath = join(root, 'script.md')
  const priorQaPath = join(root, 'prior-qa.json')
  await Bun.write(scriptPath, '# Test scene\n')
  await Bun.write(priorQaPath, '{"finding":"wrong uniform"}\n')
  const referenceSha = sha256Bytes(tinyPng)
  const characterPath = join(runDirectory, 'assets', 'character-references', 'character-snapshot', 'hero', 'reference.png')
  await mkdir(dirname(characterPath), { recursive: true })
  await Bun.write(characterPath, tinyPng)
  await Bun.write(join(runDirectory, 'assets', 'character-references.json'), JSON.stringify({ schemaVersion: 2, snapshotId: 'character-snapshot', catalogHash: 'test', createdAt: '2026-01-01T00:00:00.000Z', characters: [{ key: 'hero', name: 'Hero', description: 'Blue uniform and dark hair.', sourceSketchVersion: 'v1', assets: [{ role: 'sketch-sheet', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: referenceSha }, { role: 'source-image', path: 'assets/character-references/character-snapshot/hero/reference.png', sha256: referenceSha }] }] }))
  const locationPath = join(runDirectory, 'assets', 'location-references', 'location-snapshot', 'room.png')
  await mkdir(dirname(locationPath), { recursive: true })
  await Bun.write(locationPath, tinyPng)
  await Bun.write(join(runDirectory, 'assets', 'location-references.json'), JSON.stringify({ schemaVersion: 2, snapshots: [{ schemaVersion: 2, snapshotId: 'location-snapshot', locationKey: 'room', specification: 'A fixed display sits above a long cabinet.', sourceScripts: [projectPath(scriptPath)], sourceViews: [{ view: 'establishing', generationId: 'v1', imageSha256: referenceSha }], sheet: { path: 'assets/location-references/location-snapshot/room.png', sha256: referenceSha } }] }))
  const location = { key: 'room', raw: 'room' }
  const bundle: PanelBundleData = { schemaVersion: 4, snapshotId: 'character-snapshot', title: 'Revision fixture', location: 'Room', panels: [{ number: 1, description: 'Hero checks the display.', shotPlan: 'Medium shot; preserve the existing composition.', characterKeys: ['hero'], speech: [], sourceSegmentIds: ['beat-1'], sourceSegments: [{ id: 'beat-1', type: 'direction', text: 'Hero checks the display.', sourceSpans: [], beatIndex: 1, location }], locationKey: 'room', locationSnapshotId: 'location-snapshot' }] }
  const contractPath = join(runDirectory, 'metadata', 'panel-prompts', 'panel-01', 'prompt.md')
  await mkdir(dirname(contractPath), { recursive: true })
  await Bun.write(contractPath, `\`\`\`json\n${JSON.stringify(bundle)}\n\`\`\`\n`)
  const canonicalPath = join(runDirectory, 'panels', 'panel-01.png')
  await mkdir(dirname(canonicalPath), { recursive: true })
  const originalBytes = Buffer.from(tinyPng)
  await Bun.write(canonicalPath, originalBytes)
  const unsigned: Omit<RevisionPlan, 'planFingerprint'> = {
    schemaVersion: 1,
    experimentId: 'revision-contract-test',
    createdAt: '2026-08-30T00:00:00.000Z',
    sceneSlug,
    script: { path: projectPath(scriptPath), sha256: await sha256File(scriptPath) },
    priorQa: { path: projectPath(priorQaPath), sha256: await sha256File(priorQaPath) },
    entries: [{ panelNumber: 1, importance, defectCategory: importance === 'not-meaningful' ? 'false-positive' : 'identity-costume', originalFinding: importance === 'not-meaningful' ? 'The supposedly missing anchor is source-authorized.' : 'Hero has the wrong uniform.', correctionNote: importance === 'not-meaningful' ? 'Preserve the source-authorized composition and make no unrelated changes.' : 'Change only Hero’s uniform to canonical blue.', originalProvider: 'gemini=original-model', original: { path: projectPath(canonicalPath), sha256: await sha256File(canonicalPath) }, contract: { path: projectPath(contractPath), sha256: await sha256File(contractPath) }, references: [{ path: projectPath(characterPath), sha256: await sha256File(characterPath) }, { path: projectPath(locationPath), sha256: await sha256File(locationPath) }] }],
  }
  const plan: RevisionPlan = { ...unsigned, planFingerprint: computeRevisionPlanFingerprint(unsigned) }
  const planPath = join(root, 'revision-plan.json')
  await Bun.write(planPath, `${JSON.stringify(plan, null, 2)}\n`)
  const options: GenerateImagesCommandOptions = { sceneSlug, scriptPath, revisionPlan: projectPath(planPath), panels: [1], panelsPerImage: 1, imageModels: ['gpt-image-2'], qa: true, qaModel: 'gemini-3.1-pro-preview', maxRepairs: 0, comparisonPasses: 2, promote: 'clear-winners', target: 'images', size: '1536x1024', quality: 'high', concurrency: 1 }
  return { options, plan, runDirectory, canonicalPath, planPath, originalBytes }
}

afterEach(() => resetSceneRunContext())

describe('revision evaluation contracts', () => {
  test('schema-validates and fingerprint-binds frozen plans and structured comparisons', () => {
    const unsigned = { schemaVersion: 1 as const, experimentId: 'test', createdAt: '2026-01-01', sceneSlug: 'scene', script: { path: 'input/script.md', sha256: 'a'.repeat(64) }, priorQa: { path: 'output/qa.json', sha256: 'b'.repeat(64) }, entries: [{ panelNumber: 1, importance: 'high' as const, defectCategory: 'identity-costume' as const, originalFinding: 'Wrong coat.', correctionNote: 'Change only the coat.', originalProvider: 'gemini=model', original: { path: 'output/panel.png', sha256: 'c'.repeat(64) }, contract: { path: 'output/prompt.md', sha256: 'd'.repeat(64) }, references: [] }] }
    const plan = { ...unsigned, planFingerprint: computeRevisionPlanFingerprint(unsigned) }
    expect(parseRevisionPlan(plan).entries[0]?.importance).toBe('high')
    expect(() => parseRevisionPlan({ ...plan, createdAt: 'changed' })).toThrow('fingerprint mismatch')
    expect(() => parseRevisionPlan({ ...plan, unexpected: true })).toThrow('schema validation failed')
    expect(parseRevisionComparison(JSON.stringify(comparison(false))).fullContractPreference).toBe('image-b')
    expect(() => parseRevisionComparison('{bad')).toThrow('malformed JSON')
    expect(() => parseRevisionComparison(JSON.stringify({ ...comparison(false), targetedDefectLowerIn: 'image-a' }))).toThrow('internally inconsistent')
    expect(() => parseRevisionComparison(JSON.stringify({ ...comparison(false), targetedIssueStatusImageA: 'present' }))).toThrow('missing or unexpected fields')
    expect(() => parseRevisionComparison(JSON.stringify({ ...comparison(false), nonTargetDifferenceLevel: 'major' }))).toThrow('internally inconsistent')
  })

  test('normalizes order-swapped votes and promotes only unanimous regression-free meaningful wins', () => {
    const pass1 = normalizeRevisionComparison(comparison(false), 1)
    const pass2 = normalizeRevisionComparison(comparison(true), 2)
    expect(pass1.preference).toBe('candidate')
    expect(pass2.preference).toBe('candidate')
    expect(decideRevisionPromotion('high', [pass1, pass2]).decision).toBe('clear-winner')
    expect(decideRevisionPromotion('not-meaningful', [pass1, pass2]).decision).toBe('retain-original')
    const disagreement = normalizeRevisionComparison(comparison(true, 'original'), 2)
    expect(decideRevisionPromotion('high', [pass1, disagreement]).decision).toBe('retain-original')
    const regressionRaw = { ...comparison(true), majorRegressionImageA: true }
    expect(decideRevisionPromotion('high', [pass1, normalizeRevisionComparison(regressionRaw, 2)]).decision).toBe('retain-original')
    const driftRaw = { ...comparison(true), nonTargetDifferenceLevel: 'major' as const, nonTargetDifferences: ['The camera and character positions changed.'] }
    expect(decideRevisionPromotion('high', [pass1, normalizeRevisionComparison(driftRaw, 2)]).decision).toBe('retain-original')
    const preservationRaw = { ...comparison(true), preservationRequirementsSatisfiedImageA: false }
    expect(decideRevisionPromotion('high', [pass1, normalizeRevisionComparison(preservationRaw, 2)]).decision).toBe('retain-original')
    const sharedPreExistingRaw = { ...comparison(true), preservationRequirementsSatisfiedImageA: false, preservationRequirementsSatisfiedImageB: false, regressionsImageA: ['A shared pre-existing glasses defect remains.'], regressionsImageB: ['A shared pre-existing glasses defect remains.'] }
    const sharedPreExisting = normalizeRevisionComparison(sharedPreExistingRaw, 2)
    expect(sharedPreExisting.candidateIntroducesPreservationRegression).toBe(false)
    expect(decideRevisionPromotion('high', [pass1, sharedPreExisting]).decision).toBe('clear-winner')
  })

  test('defines defect polarity and non-target preservation explicitly in the comparison prompt', async () => await withLocalTestDir('revision-comparison-prompt', async root => {
    const fixture = await createFixture(root)
    const loaded = await loadRevisionEvaluationPlan(fixture.options)
    const prompt = buildRevisionComparisonPrompt(loaded.entries[0]!, 1)
    expect(prompt).toContain('visible means the defect exists')
    expect(prompt).toContain('nonTargetDifferenceLevel')
    expect(prompt).toContain('A full-contract preference cannot excuse major non-target drift')
    expect(prompt).toContain('already present to the same degree in both images')
  }))

  test('price inventory has exact call counts and performs zero writes', async () => await withLocalTestDir('revision-price', async root => {
    const fixture = await createFixture(root)
    const inventory = await loadRevisionPriceInventory(fixture.options)
    expect(inventory.imageCalls).toBe(1)
    expect(inventory.comparisonCalls).toBe(2)
    expect(await Bun.file(inventory.loaded.evidenceDirectory).exists()).toBe(false)
  }))

  test('rejects canonical original-hash drift before any slot can be dispatched', async () => await withLocalTestDir('revision-drift', async root => {
    const fixture = await createFixture(root)
    await Bun.write(fixture.canonicalPath, 'drifted')
    await expect(loadRevisionEvaluationPlan(fixture.options)).rejects.toThrow('original hash drift')
  }))

  test('makes one image call, swaps comparison order, promotes a clear winner, and reuses all evidence on resume', async () => await withLocalTestDir('revision-resume', async root => {
    const fixture = await createFixture(root)
    const candidateBytes = Buffer.from('candidate-bytes')
    let imageCalls = 0
    let comparisonCalls = 0
    const comparisonOrders: string[][] = []
    const first = await runRevisionEvaluation(fixture.options, {
      requestImage: async input => { imageCalls += 1; expect(input.referenceImages[0]).toBe(fixture.canonicalPath); return { mode: 'edit', result: { imageBase64: candidateBytes.toString('base64') } } },
      writeImage: async path => { await Bun.write(path, candidateBytes) },
      requestComparison: async input => { comparisonCalls += 1; comparisonOrders.push(input.imagePaths.slice(0, 2)); return { text: JSON.stringify(comparison(comparisonCalls === 2)), inputTokens: 10, outputTokens: 5 } },
      measureSimilarity: async () => ({ ssim: 0.8, normalizedRmse: 0.1 }),
      recordManifest: recordPublishedManifest,
    })
    expect(imageCalls).toBe(1)
    expect(comparisonCalls).toBe(2)
    expect(comparisonOrders[0]?.[0]).toEndWith('original.png')
    expect(comparisonOrders[0]?.[1]).toEndWith('candidate.png')
    expect(comparisonOrders[1]?.[0]).toEndWith('candidate.png')
    expect(comparisonOrders[1]?.[1]).toEndWith('original.png')
    expect(first.promotedPanels).toEqual([1])
    expect(Buffer.from(await Bun.file(fixture.canonicalPath).arrayBuffer()).toString('hex')).toBe(candidateBytes.toString('hex'))
    const resumed = await runRevisionEvaluation(fixture.options, { requestImage: async () => { throw new Error('must not redispatch image') }, requestComparison: async () => { throw new Error('must not redispatch comparison') }, measureSimilarity: async () => { throw new Error('must not recalculate completed metric') }, recordManifest: recordPublishedManifest })
    expect(resumed.promotedPanels).toEqual([1])
    expect(imageCalls).toBe(1)
    expect(comparisonCalls).toBe(2)
    const after = await loadRevisionPriceInventory(fixture.options)
    expect(after.imageCalls).toBe(0)
    expect(after.comparisonCalls).toBe(0)
  }))

  test('still evaluates a frozen false positive but never promotes it', async () => await withLocalTestDir('revision-false-positive', async root => {
    const fixture = await createFixture(root, 'not-meaningful')
    const candidateBytes = Buffer.from('prettier-candidate')
    let comparisons = 0
    const result = await runRevisionEvaluation(fixture.options, { requestImage: async () => ({ mode: 'edit', result: { imageBase64: candidateBytes.toString('base64') } }), writeImage: async path => { await Bun.write(path, candidateBytes) }, requestComparison: async () => { comparisons += 1; return { text: JSON.stringify(comparison(comparisons === 2)), inputTokens: 1, outputTokens: 1 } }, measureSimilarity: async () => ({ ssim: 0.9, normalizedRmse: 0.05 }), recordManifest: recordPublishedManifest })
    expect(comparisons).toBe(2)
    expect(result.promotedPanels).toEqual([])
    expect(Buffer.from(await Bun.file(fixture.canonicalPath).arrayBuffer()).toString('hex')).toBe(fixture.originalBytes.toString('hex'))
  }))

  test('does not retry malformed judgments and withholds promotion when either pass is invalid', async () => await withLocalTestDir('revision-malformed', async root => {
    const fixture = await createFixture(root)
    const candidateBytes = Buffer.from('candidate')
    let imageCalls = 0
    let comparisonCalls = 0
    const result = await runRevisionEvaluation(fixture.options, { requestImage: async () => { imageCalls += 1; return { mode: 'edit', result: { imageBase64: candidateBytes.toString('base64') } } }, writeImage: async path => { await Bun.write(path, candidateBytes) }, requestComparison: async () => { comparisonCalls += 1; return { text: comparisonCalls === 1 ? '{malformed' : JSON.stringify(comparison(true)), inputTokens: 1, outputTokens: 1 } }, measureSimilarity: async () => ({ ssim: 0.7, normalizedRmse: 0.2 }), recordManifest: recordPublishedManifest })
    expect(imageCalls).toBe(1)
    expect(comparisonCalls).toBe(2)
    expect(result.ledgers[0]?.comparisonSlots.map(slot => slot.status)).toEqual(['malformed', 'completed'])
    expect(result.promotedPanels).toEqual([])
    expect(Buffer.from(await Bun.file(fixture.canonicalPath).arrayBuffer()).toString('hex')).toBe(fixture.originalBytes.toString('hex'))
    await runRevisionEvaluation(fixture.options, { requestImage: async () => { throw new Error('no image retry') }, requestComparison: async () => { throw new Error('no judgment retry') }, recordManifest: recordPublishedManifest })
    expect(comparisonCalls).toBe(2)
  }))

  test('turns an interrupted in-flight image slot into a terminal ambiguity without redispatch', async () => await withLocalTestDir('revision-ambiguous', async root => {
    const fixture = await createFixture(root)
    const loaded = await loadRevisionEvaluationPlan(fixture.options)
    const panelDirectory = join(loaded.evidenceDirectory, 'panel-01')
    await mkdir(panelDirectory, { recursive: true })
    await Bun.write(join(panelDirectory, 'panel-ledger.json'), `${JSON.stringify({ schemaVersion: 1, planFingerprint: fixture.plan.planFingerprint, panelNumber: 1, originalSha256: fixture.plan.entries[0]!.original.sha256, imageSlot: { status: 'in-flight', attempts: 1, startedAt: '2026-08-30T00:00:00.000Z' }, comparisonSlots: [] }, null, 2)}\n`)
    let imageCalls = 0
    const result = await runRevisionEvaluation(fixture.options, { requestImage: async () => { imageCalls += 1; throw new Error('must not dispatch') }, requestComparison: async () => { throw new Error('must not compare') }, recordManifest: recordPublishedManifest })
    expect(imageCalls).toBe(0)
    expect(result.ledgers[0]?.imageSlot?.status).toBe('ambiguous')
    expect(result.ledgers[0]?.decision).toBe('incomplete')
  }))

  test('normalizes different source dimensions before descriptive SSIM and RMSE measurement', async () => await withLocalTestDir('revision-similarity', async root => {
    const originalPath = join(root, 'original.png')
    const candidatePath = join(root, 'candidate.png')
    const render = async (path: string, source: string): Promise<void> => {
      const process = Bun.spawn([getFfmpegBinary(), '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', source, '-frames:v', '1', '-y', path], { stdout: 'pipe', stderr: 'pipe' })
      const [, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
      if (exitCode !== 0) throw new Error(stderr)
    }
    await render(originalPath, 'color=c=red:s=12x8')
    await render(candidatePath, 'color=c=blue:s=18x12')
    const similarity = await measureRevisionSimilarity(originalPath, candidatePath)
    expect(similarity.ssim).toBeGreaterThanOrEqual(0)
    expect(similarity.ssim).toBeLessThanOrEqual(1)
    expect(similarity.normalizedRmse).toBeGreaterThan(0)
    expect(similarity.normalizedRmse).toBeLessThanOrEqual(1)
  }))

  test('records fingerprint-keyed revision provenance without changing canonical image-stage provider ownership', async () => await withLocalTestDir('revision-manifest', async root => {
    const sourcePath = join(root, 'scene.md')
    const sceneRunDir = join(root, 'run')
    const sourceBytes = '# Scene\n'
    await Bun.write(sourcePath, sourceBytes)
    const sourceIdentity = await createComicSourceIdentity(sourcePath, sourceBytes)
    const structuredBytes = '{"schemaVersion":5}\n'
    const structuredRef = createStructuredScriptArtifactRef(structuredBytes)
    await mkdir(join(sceneRunDir, 'metadata'), { recursive: true })
    await Bun.write(join(sceneRunDir, structuredRef.path), structuredBytes)
    await mkdir(join(sceneRunDir, 'panels'), { recursive: true })
    await Bun.write(join(sceneRunDir, 'panels/panel-01.png'), tinyPng)
    const panelSha256 = sha256Bytes(tinyPng)
    await writeInitialComicStructureManifest({ sceneRunDir, createdAt: '2026-08-30T00:00:00.000Z', sourceIdentity, structuredScript: structuredRef })
    const targetKey = canonicalTargetKey('comic-image', 'gemini', 'gemini-3.1-flash-image', 'hosted-api')
    const imageProvider: PipelineProviderState = { service: 'gemini', model: 'gemini-3.1-flash-image', local: false, operation: 'comic-image', targetKey, transport: 'hosted-api', artifactDir: '.', status: 'succeeded', attempts: 1, options: {}, metadata: {}, result: {} }
    await updateComicImageManifest({ sceneRunDir, sourceIdentity, providers: [imageProvider], artifactRefs: [{ path: 'panels/panel-01.png', sha256: panelSha256 }] })
    const evaluation = { schemaVersion: 1 as const, experimentId: 'revision-contract-test', planFingerprint: 'b'.repeat(64), evidenceDirectory: 'revision-evaluations/revision-contract-test-bbbbbbbbbbbbbbbb', imageProvider: { service: 'openai', model: 'gpt-image-2', attempts: 1, completed: 0, ambiguous: 1 }, comparisonProvider: { service: 'gemini', model: 'gemini-3.1-pro-preview', attempts: 0, completed: 0, invalid: 0 }, promotedPanels: [], retainedOriginalPanels: [1], actualCostUsd: 0 }
    await recordComicImageRevision({ sceneRunDir, evaluation, artifactRefs: [{ path: 'panels/panel-01.png', sha256: panelSha256 }] })
    const recorded = await recordComicImageRevision({ sceneRunDir, evaluation: { ...evaluation, retainedOriginalPanels: [1, 2] }, artifactRefs: [{ path: 'panels/panel-01.png', sha256: panelSha256 }] })
    expect(recorded.items[0]?.providers).toEqual([imageProvider])
    expect((recorded.items[0]?.metadata['comicImageRevisionEvaluations'] as Array<{ planFingerprint: string; retainedOriginalPanels: number[] }>)).toEqual([{ ...evaluation, retainedOriginalPanels: [1, 2] }])
    expect(((recorded.items[0]?.metadata['comic'] as never as { stages: { image: { targetKeys: string[]; artifactRefs: Array<{ sha256: string }> } } }).stages.image)).toMatchObject({ targetKeys: [targetKey], artifactRefs: [{ sha256: panelSha256 }] })
    const candidateBytes = Buffer.from('published-candidate')
    const candidateSha256 = sha256Bytes(candidateBytes)
    const published = await recordComicImageRevision({
      sceneRunDir,
      evaluation,
      artifactRefs: [{ path: 'panels/panel-01.png', sha256: candidateSha256 }],
      publishFinal: async () => {
        await Bun.write(join(sceneRunDir, 'panels/panel-01.png'), candidateBytes)
        return [{ path: 'panels/panel-01.png', sha256: candidateSha256 }]
      },
    })
    expect(((published.items[0]?.metadata['comic'] as never as { stages: { image: { artifactRefs: Array<{ sha256: string }> } } }).stages.image.artifactRefs[0]?.sha256)).toBe(candidateSha256)
    expect(await sha256File(join(sceneRunDir, 'panels/panel-01.png'))).toBe(candidateSha256)
  }))
})
