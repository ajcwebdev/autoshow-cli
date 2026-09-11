import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  advancePageQaRepairStagnation,
  createPageQaRepairStagnationState
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import type { ComicImageRequestInput, PageQaEntry } from '~/types'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'
const { tinyPng, createSceneFixture } = setupPageContractFixtures()

describe('page repair restart and stagnation', () => {

  test('restarts once and then stops when the same hard check keeps stagnating', () => {
    const failedEntry: PageQaEntry = {
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: false, dialogueIssueKind: 'content' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['typography'], editInstructions: 'Correct dialogue.' }], summary: 'Dialogue mismatch.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    }
    let state = createPageQaRepairStagnationState()
    const first = advancePageQaRepairStagnation(state, failedEntry)
    expect(first.action).toBe('edit')
    state = first.state
    const second = advancePageQaRepairStagnation(state, failedEntry)
    expect(second.action).toBe('restart')
    expect(second.repeatedHardFailures).toEqual(['panel-1:dialogueAccuracy'])
    state = second.state
    const afterRestart = advancePageQaRepairStagnation(state, failedEntry)
    expect(afterRestart.action).toBe('edit')
    state = afterRestart.state
    const stopped = advancePageQaRepairStagnation(state, failedEntry)
    expect(stopped.action).toBe('stop')
    expect(stopped.repeatedHardFailures).toEqual(['panel-1:dialogueAccuracy'])
  })

  test('stops an alternating hard-failure cycle without spending the remaining repair budget', () => {
    const failedEntry = (failure: 'shot' | 'set'): PageQaEntry => ({
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: failure !== 'set', setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: failure !== 'shot', dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: [`${failure} mismatch`], editInstructions: `Correct ${failure}.` }], summary: `Alternating ${failure} mismatch.` },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    let state = createPageQaRepairStagnationState()
    const first = advancePageQaRepairStagnation(state, failedEntry('shot'))
    expect(first.action).toBe('edit')
    state = first.state
    const second = advancePageQaRepairStagnation(state, failedEntry('set'))
    expect(second.action).toBe('edit')
    state = second.state
    const stopped = advancePageQaRepairStagnation(state, failedEntry('shot'))
    expect(stopped.action).toBe('stop')
    expect(stopped.reason).toBe('constraint-oscillation')
    expect(stopped.state.failureSignatures).toEqual(['panel-1:shotPlanMatch', 'panel-1:setContinuityMatch', 'panel-1:shotPlanMatch'])
  })

  test('restarts a stagnated panel from canonical references and stops a second stagnant cycle', async () => {
    const sceneSlug = `panel-stagnation-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const failedEntry = (): PageQaEntry => ({
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: false, dialogueIssueKind: 'content' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['wording'], editInstructions: 'Correct the wording.' }], summary: 'Persistent dialogue mismatch.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 7 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 || calls.length === 3 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
      judgePage: async () => failedEntry(),
    })).rejects.toThrow('1 panel QA hard failure(s)')
    expect(calls).toHaveLength(4)
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[2]?.referenceImages).toHaveLength(2)
    expect(calls[2]?.referenceImages.some(path => path.includes('/attempts/'))).toBe(false)
    expect(calls[2]?.normalizedPrompt).toContain('Generate a completely new image from the canonical references')
    expect(calls[3]?.referenceImages[0]).toContain('attempt-2.png')
    const attempts = join(runDirectory, 'panels', 'test-run', 'attempts', 'panel-01')
    const restartQa = JSON.parse(await Bun.file(join(attempts, 'attempt-1-qa.json')).text()) as PageQaEntry
    const stopQa = JSON.parse(await Bun.file(join(attempts, 'attempt-3-qa.json')).text()) as PageQaEntry
    expect(restartQa.repairPolicy).toEqual({ action: 'restart', reason: 'repeated-hard-failure', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(stopQa.repairPolicy).toEqual({ action: 'stop', reason: 'repeated-hard-failure', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(await Bun.file(join(runDirectory, 'panels', 'test-run', 'panel-01.png')).exists()).toBe(false)
    const failureReport = JSON.parse(await Bun.file(join(runDirectory, 'panels', 'test-run', 'page-qa-report.json')).text()) as { pages: PageQaEntry[] }
    expect(failureReport.pages).toHaveLength(1)
    expect(failureReport.pages[0]?.hardFailure).toBe(true)
  })

  test('applies the same canonical-reference restart policy to grouped pages', async () => {
    const sceneSlug = `page-stagnation-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const failedEntry = (): PageQaEntry => ({
      pageNumber: 1, panelNumbers: [1, 2], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: panelNumber !== 1, dialogueIssueKind: panelNumber === 1 ? ('content' as const) : ('none' as const), speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: panelNumber === 1 ? ['wording'] : [], editInstructions: panelNumber === 1 ? 'Correct the wording.' : '' })), summary: 'Persistent grouped dialogue mismatch.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 7 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 || calls.length === 3 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) },
      judgePage: async () => failedEntry(),
    })).rejects.toThrow()
    expect(calls).toHaveLength(4)
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[2]?.referenceImages).toHaveLength(2)
    expect(calls[2]?.referenceImages.some(path => path.includes('/attempts/'))).toBe(false)
    expect(calls[2]?.normalizedPrompt).toContain('Generate a completely new image from the canonical references')
    expect(calls[3]?.referenceImages[0]).toContain('attempt-2.png')
    const attempts = join(runDirectory, 'pages', 'test-run', 'attempts', 'page-01')
    const restartQa = JSON.parse(await Bun.file(join(attempts, 'attempt-1-qa.json')).text()) as PageQaEntry
    const stopQa = JSON.parse(await Bun.file(join(attempts, 'attempt-3-qa.json')).text()) as PageQaEntry
    expect(restartQa.repairPolicy).toEqual({ action: 'restart', reason: 'repeated-hard-failure', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(stopQa.repairPolicy).toEqual({ action: 'stop', reason: 'repeated-hard-failure', repeatedHardFailures: ['panel-1:dialogueAccuracy'] })
    expect(await Bun.file(join(runDirectory, 'pages', 'test-run', 'page-01-panels-01-02.png')).exists()).toBe(false)
    const failureReport = JSON.parse(await Bun.file(join(runDirectory, 'pages', 'test-run', 'page-qa-report.json')).text()) as { pages: PageQaEntry[] }
    expect(failureReport.pages).toHaveLength(1)
    expect(failureReport.pages[0]?.hardFailure).toBe(true)
  })
})
