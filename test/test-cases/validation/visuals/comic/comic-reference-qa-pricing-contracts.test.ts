import { describe, expect, test } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { buildFinalPanelImageEstimate } from '~/cli/commands/visuals/comic/comic-utils/comic-price-final-image-estimates'
import { fingerprintPageQaInputs } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import type { PageQaEntry, PageQaRequest } from '~/types'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'

const { tinyPng, createSceneFixture } = setupPageContractFixtures()
const hashTree = async (root: string): Promise<Record<string, string>> => {
  const rows: Record<string, string> = {}
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) for (const [child, hash] of Object.entries(await hashTree(path))) rows[`${entry.name}/${child}`] = hash
    else rows[entry.name] = new Bun.CryptoHasher('sha256').update(await Bun.file(path).arrayBuffer()).digest('hex')
  }
  return rows
}

const pass = (request: PageQaRequest): PageQaEntry => ({
  pageNumber: request.pageNumber, panelNumbers: request.panelData.panels.map(panel => panel.number), outputFile: request.pagePath.split('/').at(-1)!, judgeModel: request.model, hardFailure: false,
  result: { panelStructure: { pass: true, observedPanelCount: request.panelData.panels.length, observedPanelOrder: request.panelData.panels.map(panel => panel.number), issues: [] }, panels: request.panelData.panels.map(panel => ({ panelNumber: panel.number, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '' })), summary: 'Pass.' },
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
})

describe('current-reference QA pricing', () => {
  for (const grouped of [true, false]) test(`${grouped ? 'page' : 'panel'} pricing includes fresh QA and repairs for an existing image after canon changes, without writes`, async () => {
    const sceneSlug = `qa-price-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const options = { models: ['gpt-image-2.5-flare'], size: '1536x1024' as const, quality: 'high' as const, force: false, runId: 'pricing-proof', concurrency: 1, panels: grouped ? [1, 2] : [1], panelsPerImage: grouped ? 2 : 1, qa: true, qaModel: 'gpt-6.1-sol', maxRepairs: 1 }
    let judgedRequest: PageQaRequest | undefined
    const dependencies = {
      requestImage: async () => ({ mode: 'generate' as const, result: { imageBase64: tinyPng.toString('base64') } }),
      writeImage: async (path: string) => { await mkdir(dirname(path), { recursive: true }); await Bun.write(path, tinyPng) },
      judgePage: async (request: PageQaRequest) => { judgedRequest = request; return pass(request) },
    }
    if (grouped) await generateComicPages(sceneSlug, options, dependencies)
    else await generatePanelImages(sceneSlug, options, dependencies)
    const priceOptions = { sceneSlug, scriptPath: 'script.md', imageModels: options.models, panels: options.panels, panelsPerImage: options.panelsPerImage, qa: true, qaModel: options.qaModel, maxRepairs: 1, recoveryRunId: options.runId }
    const before = await hashTree(runDirectory)
    const current = await buildFinalPanelImageEstimate(priceOptions)
    expect(current.status).toBe('ready')
    if (current.status !== 'ready') throw new Error('Expected current price inventory')
    expect(current.modeEstimate.totalOutputs).toBe(0)
    expect(current.qaWork).toBeNull()
    expect(await hashTree(runDirectory)).toEqual(before)
    const changedPolicy = await buildFinalPanelImageEstimate({ ...priceOptions, blockingHardKeys: ['side-swapped'] })
    if (changedPolicy.status !== 'ready') throw new Error('Expected changed-policy price inventory')
    expect(changedPolicy.qaWork?.initialJudgeCalls).toBe(1)

    const catalogPath = join(runDirectory, 'input', 'characters', 'characters-reference.json')
    const catalog = JSON.parse(await Bun.file(catalogPath).text())
    catalog.characters[0].description = 'Latest canonical orange uniform.'
    await Bun.write(catalogPath, JSON.stringify(catalog))
    const changedBefore = await hashTree(runDirectory)
    const changed = await buildFinalPanelImageEstimate(priceOptions)
    if (changed.status !== 'ready') throw new Error('Expected changed-reference price inventory')
    expect(changed.modeEstimate.totalOutputs).toBe(0)
    expect(changed.qaWork).toMatchObject({ initialJudgeCalls: 1, maximumAdditionalImageEdits: 1 })
    expect(changed.pricing.primary.rows[0]?.outputs).toBe(0)
    expect(changed.pricing.repair?.rows[0]?.outputs).toBe(1)
    expect(changed.pricing.judgeCost).toBeGreaterThan(0)
    expect(changed.pricing.imageInput?.maximumRepairCalls).toBe(1)
    expect(await hashTree(runDirectory)).toEqual(changedBefore)

    catalog.characters[0].description = 'Test hero'
    await Bun.write(catalogPath, JSON.stringify(catalog))
    const request = { ...judgedRequest!, pagePath: join(runDirectory, grouped ? 'pages' : 'panels', options.runId, grouped ? 'page-01-panels-01-02.png' : 'panel-01.png') }
    const reportPath = join(dirname(request.pagePath), 'page-qa-report.json')
    const report = JSON.parse(await Bun.file(reportPath).text())
    delete report.pages[0].inputSha256
    await Bun.write(reportPath, JSON.stringify(report))
    const legacy = await buildFinalPanelImageEstimate(priceOptions)
    if (legacy.status !== 'ready') throw new Error('Expected legacy-report price inventory')
    expect(legacy.qaWork?.initialJudgeCalls).toBe(1)
    report.pages[0].inputSha256 = await fingerprintPageQaInputs(request)
    report.pages[0].hardFailure = true
    await Bun.write(reportPath, JSON.stringify(report))
    const failed = await buildFinalPanelImageEstimate(priceOptions)
    if (failed.status !== 'ready') throw new Error('Expected failed-report price inventory')
    expect(failed.qaWork?.maximumAdditionalImageEdits).toBe(1)
  })
})
