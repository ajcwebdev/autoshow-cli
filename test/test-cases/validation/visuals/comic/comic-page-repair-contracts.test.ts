import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  advancePageQaRepairStagnation,
  applyPageQaRepairPolicy,
  applyPageQaTolerancePolicy,
  buildComicPageQaPrompt,
  createPageQaRepairStagnationState,
  decidePageQaRepairDispatch,
  hasHardPageQaFailure,
  parseComicPageQaResult
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-qa'
import { generateComicPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-pages'
import { generatePanelImages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-panel-images'
import { estimateQaWork, normalizeFinalImageEstimateRequest } from '~/cli/commands/visuals/comic/comic-utils/final-image-price-estimate'
import type { ComicImageRequestInput, PageQaEntry } from '~/types'
import { setupPageContractFixtures } from './comic-page-contract-fixtures'
const { tinyPng, repairAssessment, repairComparisonResponse, panelBundle, createSceneFixture } = setupPageContractFixtures()

describe('page repair eligibility and promotion', () => {

  test('edits the failed exact image, preserves attempts, and promotes only a passing repair', async () => {
    const sceneSlug = `page-repair-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    let judges = 0
    const judgePage = async (): Promise<PageQaEntry> => {
      judges++
      const failed = judges === 1
      return { pageNumber: 1, panelNumbers: [1, 2], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: failed, result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: !failed, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['framing'] : [], editInstructions: failed ? 'Correct the framing.' : '' })), summary: failed ? 'Repair framing.' : 'Pass.' }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    }
    await generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 2 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })
    const output = join(runDirectory, 'pages', 'test-run', 'page-01-panels-01-02.png')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[1]?.referenceImages.at(-1)).toContain('cargo-bay.png')
    expect(await Bun.file(output).exists()).toBe(true)
    expect(await Bun.file(join(dirname(output), 'attempts', 'page-01', 'attempt-0.png')).exists()).toBe(true)
    expect(await Bun.file(join(dirname(output), 'attempts', 'page-01', 'attempt-1-qa.json')).exists()).toBe(true)
  })

  test('applies the same bounded promotion loop to default individual panels', async () => {
    const sceneSlug = `panel-repair-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    let judges = 0
    const judgePage = async (): Promise<PageQaEntry> => {
      judges++
      const failed = judges === 1
      return { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: failed, result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: !failed, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['angle'] : [], editInstructions: failed ? 'Use the specified angle.' : '' }], summary: failed ? 'Repair.' : 'Pass.' }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    }
    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 2 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })
    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    expect(calls).toHaveLength(2)
    expect(calls[1]?.model).toBe('gpt-image-2')
    expect(calls[1]?.referenceImages[0]).toContain('attempt-0.png')
    expect(await Bun.file(output).exists()).toBe(true)
  })

  test('prices two order-swapped comparisons for every possible individual-panel repair', () => {
    const request = normalizeFinalImageEstimateRequest({ sceneSlug: 'pricing', scriptPath: 'script.md', imageModels: ['gpt-image-2'], panelsPerImage: 1, maxRepairs: 1 })
    if (request.mode !== 'panel') throw new Error('Expected panel mode')
    const qa = estimateQaWork(request, { mode: 'panel', totalOutputs: 2, skipped: 0, grid: null }, { mode: 'panel', panelPromptsDir: '/tmp', panels: [], gridPages: [] })
    expect(qa?.mode).toBe('panel')
    if (qa?.mode !== 'panel') throw new Error('Expected panel QA work')
    expect(qa.maximumAdditionalImageEdits).toBe(2)
    expect(qa.maximumRepairQaCalls).toBe(2)
    expect(qa.maximumComparisonJudgeCalls).toBe(4)
    expect(qa.maximumAdditionalJudgeCalls).toBe(6)
    expect(qa.maximumTotalJudgeCalls).toBe(8)
    expect(qa.estimatedInputTokens).toBe(58_000)
    expect(qa.estimatedOutputTokens).toBe(10_400)
  })

  test('skips an individual-panel edit when the expected change is marginal and preserves the canonical bytes', async () => {
    const sceneSlug = `panel-value-skip-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    const originalBytes = Buffer.from('current-canonical')
    await mkdir(dirname(output), { recursive: true })
    await Bun.write(output, originalBytes)
    const failedEntry: PageQaEntry = {
      pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['A tiny background fixture differs.'], editInstructions: 'Adjust the tiny fixture.', repairAssessment: repairAssessment({ issueVisibility: 'directly-visible', expectedBenefit: 'marginal', recommendation: 'retain-current', rationale: 'The change would not affect the panel reading.' }) }], summary: 'A marginal strict finding remains.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    }
    expect(decidePageQaRepairDispatch(failedEntry).action).toBe('skip')
    await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 1 }, {
      requestImage: async () => { throw new Error('repair image call must be skipped') },
      judgePage: async () => failedEntry,
    })).rejects.toThrow('1 panel QA hard failure(s)')
    expect(Buffer.from(await Bun.file(output).arrayBuffer())).toEqual(originalBytes)
    const evidence = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'panel-01', 'attempt-0-qa.json')).text()) as PageQaEntry
    expect(evidence.hardFailure).toBe(true)
    expect(evidence.repairPolicy?.action).toBe('skip')
  })

  test('dispatches meaningful high-confidence repairs through direct or comparison-protected lanes', () => {
    const decisionFor = (editIsolation: NonNullable<PageQaEntry['result']['panels'][number]['repairAssessment']>['editIsolation']) => decidePageQaRepairDispatch({
      hardFailure: true,
      result: { panels: [{ repairAssessment: repairAssessment({ issueVisibility: 'directly-visible', expectedBenefit: 'meaningful', editScope: 'bounded', editIsolation, collateralRisk: 'low', confidence: 'high', recommendation: 'targeted-edit', preservationRequirements: ['Preserve every unaffected subject and region.'], rationale: 'Synthetic dispatch fixture.' }) }] },
    } as PageQaEntry)
    expect(decisionFor('isolated-single-region')).toEqual({ action: 'edit', reason: 'The defect qualifies for the low-risk targeted-edit lane.' })
    for (const editIsolation of ['shared-attribute', 'multi-region', 'generative-redraw'] as const) {
      const decision = decisionFor(editIsolation)
      expect(decision.action).toBe('edit')
      expect(decision.reason).toContain('comparison-protected lane')
    }
  })

  test('overrides a contradictory low-benefit label for an objective story-contract failure', () => {
    const decision = decidePageQaRepairDispatch({
      hardFailure: true,
      result: { panels: [{ requiredCastPresent: false, unexpectedCastAbsent: true, identityIssueKind: 'none', dialogueIssueKind: 'none', speakerAttribution: true, sourcePrecedence: true, repairAssessment: repairAssessment({ issueVisibility: 'directly-visible', expectedBenefit: 'marginal', editScope: 'diffuse', editIsolation: 'multi-region', collateralRisk: 'high', confidence: 'high', recommendation: 'retain-current', rationale: 'The cast correction is broad.' }) }] },
    } as PageQaEntry)
    expect(decision.action).toBe('edit')
    expect(decision.reason).toContain('Objective story-contract failures override')
  })

  for (const outcome of ['tie', 'worse', 'malformed'] as const) {
    test(`retains the original after a ${outcome} comparison between equivalently failing images`, async () => {
      const sceneSlug = `panel-value-${outcome}-${crypto.randomUUID()}`
      const { runDirectory } = await createSceneFixture(sceneSlug)
      const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
      const originalBytes = Buffer.from(`original-${outcome}`)
      const candidateBytes = Buffer.from(`candidate-${outcome}`)
      await mkdir(dirname(output), { recursive: true })
      await Bun.write(output, originalBytes)
      let judges = 0
      let imageCalls = 0
      const comparisonOrders: string[][] = []
      await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 1 }, {
        requestImage: async () => { imageCalls++; return { mode: 'edit', result: { imageBase64: candidateBytes.toString('base64') } } },
        writeImage: async path => { await Bun.write(path, candidateBytes) },
        judgePage: async (): Promise<PageQaEntry> => {
          judges++
          const failed = true
          return { pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5', hardFailure: failed, result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: !failed, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['The required wall display is missing.'] : [], editInstructions: failed ? 'Restore the wall display only.' : '', repairAssessment: failed ? repairAssessment({ issueVisibility: 'directly-visible', expectedBenefit: 'meaningful', editScope: 'bounded', collateralRisk: 'low', confidence: 'high', recommendation: 'targeted-edit', preservationRequirements: ['Preserve all cast and staging.'], rationale: 'This is a specific visible omission.' }) : repairAssessment() }], summary: failed ? 'Repairable omission.' : 'Candidate passes QA.' }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
        },
        requestRepairComparison: async request => {
          comparisonOrders.push(request.imagePaths.slice(0, 2))
          return { text: outcome === 'malformed' ? '{bad json' : repairComparisonResponse(request.pass, outcome), inputTokens: 2, outputTokens: 1 }
        },
      })).rejects.toThrow('1 panel QA hard failure(s)')
      expect(imageCalls).toBe(1)
      expect(comparisonOrders).toHaveLength(2)
      expect(comparisonOrders[0]?.[0]).toContain('attempt-0.png')
      expect(comparisonOrders[0]?.[1]).toContain('attempt-1.png')
      expect(comparisonOrders[1]?.[0]).toContain('attempt-1.png')
      expect(comparisonOrders[1]?.[1]).toContain('attempt-0.png')
      expect(Buffer.from(await Bun.file(output).arrayBuffer())).toEqual(originalBytes)
      if (outcome === 'malformed') {
        const malformed = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'panel-01', 'attempt-1-comparison-pass-1-error.json')).text())
        expect(malformed.usage).toEqual({ inputTokens: 2, outputTokens: 1, costUsd: 0.00004 })
      }
    })
  }

  test('uses remaining repair budget for a fresh canonical restart after comparison rejects an edit', async () => {
    const sceneSlug = `panel-value-restart-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    await mkdir(dirname(output), { recursive: true })
    await Bun.write(output, Buffer.from('original-before-rejected-edit'))
    const calls: ComicImageRequestInput[] = []
    let judges = 0
    let comparisons = 0
    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 2 }, {
      requestImage: async input => {
        calls.push(input)
        const bytes = Buffer.from(calls.length === 1 ? 'rejected-edit' : 'passing-fresh-restart')
        return { mode: calls.length === 1 ? 'edit' : 'generate', result: { imageBase64: bytes.toString('base64') } }
      },
      writeImage: async (path, imageBase64) => { await Bun.write(path, Buffer.from(imageBase64, 'base64')) },
      judgePage: async (): Promise<PageQaEntry> => {
        judges++
        const failed = judges < 3
        return { pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5', hardFailure: failed, result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: !failed, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['The required wall display is missing.'] : [], editInstructions: failed ? 'Restore the wall display only.' : '', repairAssessment: failed ? repairAssessment({ issueVisibility: 'directly-visible', expectedBenefit: 'meaningful', editScope: 'bounded', collateralRisk: 'low', confidence: 'high', recommendation: 'targeted-edit', preservationRequirements: ['Preserve all cast and staging.'], rationale: 'This is a specific visible omission.' }) : repairAssessment() }], summary: failed ? 'Repairable omission.' : 'Fresh restart passes QA.' }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
      },
      requestRepairComparison: async request => { comparisons++; return { text: repairComparisonResponse(request.pass, 'tie'), inputTokens: 2, outputTokens: 1 } },
    })
    expect(calls).toHaveLength(2)
    expect(comparisons).toBe(2)
    expect(calls[0]?.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[1]?.referenceImages.some(path => path.includes('/attempts/'))).toBe(false)
    expect(calls[1]?.normalizedPrompt).toContain('Generate a completely new image from the canonical references')
    expect(Buffer.from(await Bun.file(output).arrayBuffer())).toEqual(Buffer.from('passing-fresh-restart'))
    const rejectedQa = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'panel-01', 'attempt-1-qa.json')).text()) as PageQaEntry
    expect(rejectedQa.repairPolicy?.action).toBe('retain-original')
  })

  test('promotes a hard-contract-clean repair before subjective comparison', async () => {
    const sceneSlug = `panel-value-win-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    const candidateBytes = Buffer.from('candidate-clear-winner')
    await mkdir(dirname(output), { recursive: true })
    await Bun.write(output, Buffer.from('original-clear-winner'))
    let judges = 0
    let comparisons = 0
    await generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 1 }, {
      requestImage: async () => ({ mode: 'edit', result: { imageBase64: candidateBytes.toString('base64') } }),
      writeImage: async path => { await Bun.write(path, candidateBytes) },
      judgePage: async (): Promise<PageQaEntry> => {
        judges++
        const failed = judges === 1
        return { pageNumber: 1, panelNumbers: [1], outputFile: 'panel-01.png', judgeModel: 'gpt-5.5', hardFailure: failed, result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: !failed, dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['The required wall display is missing.'] : [], editInstructions: failed ? 'Restore the wall display only.' : '', repairAssessment: failed ? repairAssessment({ issueVisibility: 'directly-visible', expectedBenefit: 'meaningful', editScope: 'bounded', collateralRisk: 'low', confidence: 'high', recommendation: 'targeted-edit', preservationRequirements: ['Preserve all cast and staging.'], rationale: 'This is a specific visible omission.' }) : repairAssessment() }], summary: failed ? 'Repairable omission.' : 'Candidate passes QA.' }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
      },
      requestRepairComparison: async request => { comparisons++; return { text: repairComparisonResponse(request.pass, 'winner'), inputTokens: 2, outputTokens: 1 } },
    })
    expect(comparisons).toBe(0)
    expect(Buffer.from(await Bun.file(output).arrayBuffer())).toEqual(candidateBytes)
    const qa = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'panel-01', 'attempt-1-qa.json')).text()) as PageQaEntry
    expect(qa.repairComparison).toBeUndefined()
  })

  test('does not waive a persistent individual-panel shot-plan mismatch', async () => {
    const sceneSlug = `panel-shot-plan-strict-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const judgePage = async (): Promise<PageQaEntry> => ({
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 7, issues: ['depth staging'], editInstructions: 'Move the hero deeper.' }], summary: 'Shot-plan staging remains unresolved.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generatePanelImages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1], qa: true, maxRepairs: 4 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })).rejects.toThrow('1 panel QA hard failure(s)')
    const output = join(runDirectory, 'panels', 'test-run', 'panel-01.png')
    const repairedQa = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'panel-01', 'attempt-1-qa.json')).text()) as PageQaEntry
    expect(calls).toHaveLength(4)
    expect(repairedQa.result.panels[0]?.shotPlanMatch).toBe(false)
    expect(repairedQa.hardFailure).toBe(true)
    expect(repairedQa.waivedChecks).toBeUndefined()
    expect(await Bun.file(output).exists()).toBe(false)
  })

  test('does not waive persistent grouped-page shot-plan mismatches', async () => {
    const sceneSlug = `page-shot-plan-strict-${crypto.randomUUID()}`
    const { runDirectory } = await createSceneFixture(sceneSlug)
    const calls: ComicImageRequestInput[] = []
    const judgePage = async (): Promise<PageQaEntry> => ({
      pageNumber: 1, panelNumbers: [1, 2], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 2, observedPanelOrder: [1, 2], issues: [] }, panels: [1, 2].map(panelNumber => ({ panelNumber, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 7, issues: ['framing'], editInstructions: 'Correct framing.' })), summary: 'Grouped framing remains unresolved.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    })
    await expect(generateComicPages(sceneSlug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'test-run', concurrency: 1, panels: [1, 2], panelsPerImage: 2, qa: true, maxRepairs: 4 }, {
      requestImage: async input => { calls.push(input); return { mode: calls.length === 1 ? 'generate' : 'edit', result: { imageBase64: tinyPng.toString('base64') } } },
      writeImage: async outputPath => { await mkdir(dirname(outputPath), { recursive: true }); await Bun.write(outputPath, tinyPng) }, judgePage,
    })).rejects.toThrow('1 comic page QA hard failure(s)')
    const output = join(runDirectory, 'pages', 'test-run', 'page-01-panels-01-02.png')
    const repairedQa = JSON.parse(await Bun.file(join(dirname(output), 'attempts', 'page-01', 'attempt-1-qa.json')).text()) as PageQaEntry
    expect(calls).toHaveLength(4)
    expect(repairedQa.hardFailure).toBe(true)
    expect(repairedQa.waivedChecks).toBeUndefined()
    expect(await Bun.file(output).exists()).toBe(false)
  })

  test('never waives strict identity failures', () => {
    const entry: PageQaEntry = {
      pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true,
      result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: false, identityIssueKind: 'unmistakable-mismatch' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: false, dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 7, issues: ['identity and framing'], editInstructions: 'Fix identity and framing.' }], summary: 'Strict identity failure.' },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
    }
    const repaired = applyPageQaRepairPolicy(entry, 1)
    expect(repaired.hardFailure).toBe(true)
    expect(repaired.waivedChecks).toBeUndefined()
  })

  test('treats harmless typography substitutions and minor recognizable identity variance as advisory', () => {
    const prompt = buildComicPageQaPrompt(panelBundle(1), [{ key: 'hero', description: 'A free-standing hologram above a projector base.' }], [{ key: 'cargo-bay', specification: 'The loading door remains left of the control booth.' }])
    expect(prompt).toContain('Unicode ellipsis (…) and three consecutive periods (...)')
    expect(prompt).toContain('Never fail dialogueAccuracy for a harmless typography-only substitution.')
    expect(prompt).toContain('Minor body-width or proportion variance')
    expect(prompt).toContain('Set identityMatch=false only for an unmistakably wrong person')
    expect(prompt).toContain('highest visual precedence for identity, physical embodiment, projection/display medium')
    expect(prompt).toContain('violates this canon is a hard identity failure')
    expect(prompt).toContain('hero: A free-standing hologram above a projector base.')
    expect(prompt).toContain('cargo-bay: The loading door remains left of the control booth.')
    expect(prompt).toContain('Judge set anchors in world space (topology and relative relationships), but judge each listed character\'s screen side, depth order, posture, facing, and wardrobe in screen space against the blocking ledger when one is supplied. A different camera distance, elevation, perspective, or crop is desirable shot variation; a swapped screen side or a crossed axis of action is not.')
    expect(prompt).not.toContain('A different camera side, angle, distance, elevation, perspective, or crop is desirable shot variation')
    expect(prompt).toContain('Perform a mandatory anchor-by-anchor continuity audit')
    expect(prompt).toContain('Audit canonical assemblies component by component')
    expect(prompt).toContain('There is no occluded status')
    expect(prompt).toContain('character or prop blocking never excuses an unverifiable anchor')
    expect(prompt).toContain('absent, hidden, or replaced by generic clutter, status is missing')
    expect(prompt).not.toContain('physically-occluded')
    expect(prompt).toContain('explicitly compare footprint, silhouette, connectedness, orientation, visible edge geometry, and wall relationships')
    expect(prompt).toContain('may not turn a straight run into a corner, L-shaped, wraparound, split, or freestanding form')
    expect(prompt).toContain('A wide or otherwise revealing view that shows an anchor\'s canonical region but omits the anchor is a hard failure')
    const tolerantResult = applyPageQaTolerancePolicy({
      panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
      panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: false, identityIssueKind: 'minor-variance' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: false, dialogueIssueKind: 'typography-only' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['minor proportions', 'ellipsis glyph'], editInstructions: '' }],
      summary: 'Advisory differences only.',
    })
    expect(tolerantResult.panels[0]?.identityMatch).toBe(true)
    expect(tolerantResult.panels[0]?.dialogueAccuracy).toBe(true)
    expect(hasHardPageQaFailure(tolerantResult)).toBe(false)
    const strictResult = applyPageQaTolerancePolicy({
      panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
      panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'unmistakable-mismatch' as const, locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: true, dialogueAccuracy: true, dialogueIssueKind: 'content' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['wrong person', 'missing words'], editInstructions: 'Restore the character and dialogue.' }],
      summary: 'Material failures.',
    })
    expect(strictResult.panels[0]?.identityMatch).toBe(false)
    expect(strictResult.panels[0]?.dialogueAccuracy).toBe(false)
    expect(hasHardPageQaFailure(strictResult)).toBe(true)
  })

  test('keeps set continuity strict without treating camera variation as a failure', () => {
    const setDrift = {
      panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] },
      panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none' as const, locationMatch: true, setContinuityMatch: false, setContinuityAudit: [{ anchor: 'fixed control booth', status: 'relocated' as const, evidence: 'It appears on the opposite side of the loading door.' }], sourcePrecedence: true, shotPlanMatch: true, blockingMatch: true, axisSideMatch: true, blockingAudit: [], dialogueAccuracy: true, dialogueIssueKind: 'none' as const, speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: ['The fixed control booth moved to the other side of the loading door.'], editInstructions: 'Restore the canonical world-space relationship while retaining this camera angle.', repairAssessment: repairAssessment({ issueVisibility: 'directly-visible', expectedBenefit: 'meaningful', editScope: 'bounded', collateralRisk: 'low', confidence: 'high', recommendation: 'targeted-edit', rationale: 'The topology error is directly visible and isolated.' }) }],
      summary: 'The location identity is recognizable, but its permanent topology drifted.',
    }
    expect(hasHardPageQaFailure(setDrift)).toBe(true)
    const entry: PageQaEntry = { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true, result: setDrift, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    expect(applyPageQaRepairPolicy(entry, 1).hardFailure).toBe(true)
    expect(advancePageQaRepairStagnation(createPageQaRepairStagnationState(), entry).state.consecutiveFailures).toEqual({ 'panel-1:setContinuityMatch': 1, 'panel-1:setContinuityAudit': 1 })

    const variedCamera = { ...setDrift, panels: [{ ...setDrift.panels[0]!, setContinuityMatch: true, setContinuityAudit: [{ anchor: 'fixed control booth', status: 'outside-crop' as const, evidence: 'The entire booth wall is beyond the right frame edge.' }], issues: [], editInstructions: '' }], summary: 'A different crop preserves the canonical set topology.' }
    expect(hasHardPageQaFailure(variedCamera)).toBe(false)

    const inconsistentAudit = { ...variedCamera, panels: [{ ...variedCamera.panels[0]!, setContinuityAudit: [{ anchor: 'fixed control booth', status: 'missing' as const, evidence: 'Its wall zone is visible and empty.' }] }] }
    expect(hasHardPageQaFailure(inconsistentAudit)).toBe(true)
    const normalizedInconsistentAudit = applyPageQaTolerancePolicy(inconsistentAudit)
    expect(normalizedInconsistentAudit.panels[0]?.setContinuityMatch).toBe(false)
    const inconsistentEntry: PageQaEntry = { pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: 'gpt-5.5', hardFailure: true, result: normalizedInconsistentAudit, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 } }
    expect(advancePageQaRepairStagnation(createPageQaRepairStagnationState(), inconsistentEntry).state.consecutiveFailures).toEqual({ 'panel-1:setContinuityMatch': 1, 'panel-1:setContinuityAudit': 1 })

    const strictPayload = { ...setDrift, panels: [{ ...setDrift.panels[0]!, identityIssueKind: 'none' as const, dialogueIssueKind: 'none' as const }] }
    expect(parseComicPageQaResult(JSON.stringify(strictPayload), [1]).panels[0]?.setContinuityMatch).toBe(false)
    const legacyOcclusionPayload = { ...strictPayload, panels: [{ ...strictPayload.panels[0]!, setContinuityAudit: [{ anchor: 'fixed control booth', status: 'physically-occluded', evidence: 'A character covers it.' }] }] }
    expect(() => parseComicPageQaResult(JSON.stringify(legacyOcclusionPayload), [1])).toThrow('invalid setContinuityAudit')
    const { setContinuityMatch: _omitted, ...missingContinuityField } = strictPayload.panels[0]!
    expect(() => parseComicPageQaResult(JSON.stringify({ ...strictPayload, panels: [missingContinuityField] }), [1])).toThrow('missing or unexpected fields')
    const { setContinuityAudit: _auditOmitted, ...missingAuditField } = strictPayload.panels[0]!
    expect(() => parseComicPageQaResult(JSON.stringify({ ...strictPayload, panels: [missingAuditField] }), [1])).toThrow('missing or unexpected fields')
  })
})
