import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  parseComicPageQaResult,
  resolveComicQaProvider
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import { runQaOnlyPanelAudit } from '~/cli/commands/visuals/comic/comic-commands/generate-images/qa-only-panel-audit'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'
const { tinyPng, repairAssessment, createSceneFixture } = setupPageContractFixtures()

describe('page QA parsing and audit routing', () => {
  test('routes panel QA through supported vision providers', () => {
    expect(resolveComicQaProvider('gpt-5.5')).toBe('openai')
    expect(resolveComicQaProvider('gemini-3.1-pro-preview')).toBe('gemini')
    expect(() => resolveComicQaProvider('grok-4.5')).toThrow('supports OpenAI and Gemini')
  })

  test('normalizes a single-panel judge bookkeeping number to the requested canonical panel', () => {
    const payload = { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, blockingMatch: true, axisSideMatch: true, blockingAudit: [], dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [], editInstructions: '', repairAssessment: repairAssessment() }], summary: 'Pass.' }
    const normalized = parseComicPageQaResult(JSON.stringify(payload), [4])
    expect(normalized.panelStructure.observedPanelOrder).toEqual([4])
    expect(normalized.panels[0]?.panelNumber).toBe(4)
  })

  test('QA-only audits canonical panels without changing their bytes or invoking an image path', async () => {
    const sceneSlug = `qa-only-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const panelPath = join(runDirectory, 'panels', 'panel-01.png')
    await mkdir(dirname(panelPath), { recursive: true })
    await Bun.write(panelPath, tinyPng)
    const before = await Bun.file(panelPath).arrayBuffer()
    const result = await runQaOnlyPanelAudit({ sceneSlug, scriptPath: 'script.md', qaOnly: true, qa: true, qaModel: 'gemini-3.1-pro-preview', maxRepairs: 0, panels: [1], concurrency: 1 }, {
      runId: 'test-audit',
      judgePage: async request => ({ pageNumber: request.pageNumber, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: request.model, hardFailure: true, result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 7, issues: ['framing'], editInstructions: 'Use the authored framing.' }], summary: 'Framing mismatch.' }, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, costUsd: 0.01 } }),
    })
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.hardFailure).toBe(true)
    expect(Buffer.from(await Bun.file(panelPath).arrayBuffer())).toEqual(Buffer.from(before))
    const audit = JSON.parse(await Bun.file(join(result.reportDirectory, 'qa-only-audit.json')).text())
    expect(audit.imageGenerationCalls).toBe(0)
    expect(audit.imageRepairCalls).toBe(0)
    expect(audit.canonicalImagesModified).toBe(false)
    expect(await Bun.file(join(result.reportDirectory, 'page-qa-report.json')).exists()).toBe(true)
  })
})
