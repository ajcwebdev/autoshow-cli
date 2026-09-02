import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { draftScenesCommand, getDraftSceneStages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/draft-scenes/draft-scenes-command'
import { generateBlockingPlan } from '~/cli/commands/process-steps/step-8-comic/comic-commands/draft-scenes/generate-blocking-plan'
import { generateStructuredScript } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/generator'
import { rebindBlockingPlan } from '~/cli/commands/process-steps/step-8-comic/comic-commands/draft-scenes/blocking-plan-rebind'
import { generateSceneJson, SCENE_DRAFT_RETRY_HEADER } from '~/cli/commands/process-steps/step-8-comic/comic-commands/draft-scenes/generate-scene-json'
import { generatePanelImages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-panel-images'
import { BLOCKING_LEDGER_AUTHORITY_SENTENCE, buildComicPagePrompt, buildComicPagePromptData, SHOT_DIVERSITY_SENTENCE } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import { panelPromptsCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/panel-prompts/panel-prompts-command'
import { getBlockingDirectory, getBlockingPanelLayoutGuidePath, getBlockingPlanPath, getBlockingPromptPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-paths'
import { OFF_FRAME_PINNED_SENTENCE } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-compile'
import { BLOCKING_DRAFTER_PINNED_SENTENCE, SCENE_PLAN_PINNED_SENTENCE } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-prompt'
import { coerceAndValidateDraftScenes } from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import { estimateDraftScenesPrice, SCENE_DRAFT_OUTPUT_UNITS_FIXED, SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-price-llm-estimates'
import { validatePriceReferenceGroup } from '~/cli/commands/process-steps/step-8-comic/comic-utils/final-image-price-inventory'
import { generateJsonPrompt, SCENE_PLAN_SECTION_MARKER } from '~/cli/commands/process-steps/step-8-comic/comic-utils/json-prompt-utils'
import { extractPanelBundleData, getPromptBundleFilename } from '~/cli/commands/process-steps/step-8-comic/comic-utils/panel-prompt-utils'
import { getDraftPromptPath, getPanelPromptsDirectory, getPreviousStructuredScriptPath, getSceneJsonPath, getStructuredScriptPath } from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import { draftScenesCommandDefinition } from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import type { ComicImageRequestInput, DraftScenesCommandOptions, DraftScenesStage, PageQaEntry, PanelBundleData, SceneDraftRequest, ScenePromptData } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { captureLogEvents } from '../../../test-utils/console-capture'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { BLOCKING_FIXTURE_CATALOG_CHARACTERS, BLOCKING_FIXTURE_SCENE_SLUG, BLOCKING_FIXTURE_SEGMENTS, BLOCKING_FIXTURE_TINY_PNG, buildBlockingFixturePlan, buildBlockingFixtureScene, buildBlockingFixtureStructuredScript, writeBlockingFixtureInputRoot } from './fixtures/blocking/blocking-plan-fixture'

const temporaryDirectories: string[] = []
const script = buildBlockingFixtureStructuredScript()

afterEach(async () => {
  resetSceneRunContext()
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const parseDraftScenesArgs = (args: string[]) =>
  coerceAndValidateDraftScenes(parseCommandInvocation([draftScenesCommandDefinition.name, ...args], draftScenesCommandDefinition, GLOBAL_FLAG_DEFINITIONS))

const prepareWorkspace = async () => {
  const root = await makeTempDir('autoshow-blocking-prompt-inputs-')
  temporaryDirectories.push(root)
  const inputs = await writeBlockingFixtureInputRoot(root)
  configureCharactersRoot(inputs.charactersRoot)
  const sheetSha256 = sha256Bytes(new Uint8Array(BLOCKING_FIXTURE_TINY_PNG))
  await writeFile(join(inputs.charactersRoot, 'character-sketches.json'), JSON.stringify({
    schemaVersion: 1,
    sketches: BLOCKING_FIXTURE_CATALOG_CHARACTERS.map(character => ({
      characterKey: character.key,
      generationId: `${character.key}-fixture`,
      origin: 'legacy-import',
      sourceImage: `${character.key}.png`,
      outlineSheet: `${character.key}.png`,
      sourceSha256: sheetSha256,
      sheetSha256,
      model: 'gpt-image-2',
      createdAt: '2026-01-01T00:00:00.000Z',
    })),
  }, null, 2))
  const workspace = await makeTempDir('autoshow-blocking-prompt-workspace-')
  temporaryDirectories.push(workspace)
  const slug = BLOCKING_FIXTURE_SCENE_SLUG
  beginSceneRun(slug, { outputDir: workspace })
  await mkdir(join(workspace, 'metadata'), { recursive: true })
  await writeFile(getStructuredScriptPath(slug), `${JSON.stringify(script, null, 2)}\n`)
  return { slug, workspace }
}

const importFixturePlan = async (slug: string, workspace: string): Promise<void> => {
  const importPath = join(workspace, 'hand-authored-plan.json')
  await writeFile(importPath, JSON.stringify(buildBlockingFixturePlan(script), null, 2))
  await captureLogEvents(async () => {
    await generateBlockingPlan(slug, { model: 'gpt-5.6-sol', importPath, requestPlan: async () => { throw new Error('import must not call the drafter') } })
  })
}

const readPanelBundle = async (slug: string, panelDirectoryName: string): Promise<{ content: string; bundle: PanelBundleData }> => {
  const panelDirectory = join(getPanelPromptsDirectory(slug), panelDirectoryName)
  const entries = await readdir(panelDirectory, { withFileTypes: true })
  const content = await Bun.file(join(panelDirectory, getPromptBundleFilename(panelDirectory, entries))).text()
  return { content, bundle: extractPanelBundleData(content) }
}

const stageRecorder = () => {
  const calls: string[] = []
  const panelPromptOptions: Array<Record<string, unknown>> = []
  return {
    calls,
    panelPromptOptions,
    dependencies: {
      runStructureScripts: async () => { calls.push('structure') },
      runDraftPrompts: async () => { calls.push('prompt') },
      runBlockingPlan: async () => { calls.push('blocking') },
      runSceneDraft: async () => { calls.push('scene') },
      runPanelPrompts: async (options: Record<string, unknown>) => { calls.push('panel-prompts'); panelPromptOptions.push(options); return { success: 1, errors: 0, panels: 0 } },
    },
  }
}

const runDraftScenes = async (options: Partial<DraftScenesCommandOptions>, recorder: ReturnType<typeof stageRecorder>) => {
  const slug = `stage-machine-${crypto.randomUUID().slice(0, 8)}`
  const workspace = await makeTempDir('autoshow-blocking-stage-machine-')
  temporaryDirectories.push(workspace)
  beginSceneRun(slug, { outputDir: workspace })
  return await draftScenesCommand({ scriptPath: 'input/scripts/02-script/01-mandatory-meeting.md', sceneSlug: slug, ...options }, recorder.dependencies as never, 'nested')
}

describe('draft-scenes blocking stage machine', () => {
  test('orders the blocking stage between prompt and scene and honours --only and --no-blocking', () => {
    expect(getDraftSceneStages({})).toEqual(['structure', 'prompt', 'blocking', 'scene', 'panel-prompts'])
    expect(getDraftSceneStages({ only: 'blocking' as DraftScenesStage })).toEqual(['blocking'])
    expect(getDraftSceneStages({ blocking: false })).toEqual(['structure', 'prompt', 'scene', 'panel-prompts'])
    expect(getDraftSceneStages({ only: 'scene' as DraftScenesStage, blocking: false })).toEqual(['scene'])
  })

  test('runs every stage in order, then only the blocking stage, then skips it for --no-blocking', async () => {
    const full = stageRecorder()
    const fullResult = await runDraftScenes({}, full)
    expect(full.calls).toEqual(['structure', 'prompt', 'blocking', 'scene', 'panel-prompts'])
    expect(fullResult.stages).toEqual(['structure', 'prompt', 'blocking', 'scene', 'panel-prompts'])
    expect(full.panelPromptOptions[0]).not.toHaveProperty('blocking')

    const only = stageRecorder()
    await runDraftScenes({ only: 'blocking' }, only)
    expect(only.calls).toEqual(['blocking'])

    const skipped = stageRecorder()
    await runDraftScenes({ blocking: false }, skipped)
    expect(skipped.calls).toEqual(['structure', 'prompt', 'scene', 'panel-prompts'])
    expect(skipped.panelPromptOptions[0]).toMatchObject({ blocking: false })
  })

  test('parses the four blocking flags and rejects their invalid combinations', () => {
    expect(parseDraftScenesArgs(['script.md', '--only', 'blocking']).only).toBe('blocking')
    expect(parseDraftScenesArgs(['script.md', '--no-blocking']).blocking).toBe(false)
    expect(parseDraftScenesArgs(['script.md']).blocking).toBeUndefined()
    expect(parseDraftScenesArgs(['script.md', '--blocking-plan', 'input/blocking/plan.json']).blockingPlan).toBe('input/blocking/plan.json')
    expect(parseDraftScenesArgs(['script.md', '--only', 'blocking', '--rebind']).rebind).toBe(true)
    expect(() => parseDraftScenesArgs(['script.md', '--rebind'])).toThrow('--rebind requires --only blocking')
    expect(() => parseDraftScenesArgs(['script.md', '--only', 'blocking', '--rebind', '--blocking-plan', 'plan.json'])).toThrow('--rebind cannot be combined with --blocking-plan')
    expect(() => parseDraftScenesArgs(['script.md', '--only', 'scene', '--blocking-plan', 'plan.json'])).toThrow('--blocking-plan only applies to the blocking stage')
    expect(() => parseDraftScenesArgs(['script.md', '--no-blocking', '--only', 'blocking'])).toThrow('--no-blocking cannot be combined with --only blocking, --blocking-plan, or --rebind')
  })
})

describe('blocking prompt artifacts', () => {
  test('the prompt stage writes the drafter prompt and adds the scene plan section only once a plan exists', async () => {
    const { slug, workspace } = await prepareWorkspace()
    await captureLogEvents(async () => { await generateJsonPrompt(slug) })
    const planFreePrompt = await Bun.file(getDraftPromptPath(slug)).text()
    expect(planFreePrompt).not.toContain(SCENE_PLAN_SECTION_MARKER)
    expect(planFreePrompt).not.toContain(SCENE_PLAN_PINNED_SENTENCE)
    const drafterPrompt = await Bun.file(getBlockingPromptPath(slug)).text()
    expect(getBlockingPromptPath(slug)).toBe(join(workspace, 'metadata', 'blocking-prompt.md'))
    expect(drafterPrompt).toContain(BLOCKING_DRAFTER_PINNED_SENTENCE)

    await importFixturePlan(slug, workspace)
    await captureLogEvents(async () => { await generateJsonPrompt(slug) })
    const plannedPrompt = await Bun.file(getDraftPromptPath(slug)).text()
    expect(plannedPrompt).toContain(SCENE_PLAN_SECTION_MARKER)
    expect(plannedPrompt).toContain(SCENE_PLAN_PINNED_SENTENCE)
    expect(plannedPrompt.indexOf(SCENE_PLAN_SECTION_MARKER)).toBe(plannedPrompt.lastIndexOf(SCENE_PLAN_SECTION_MARKER))
    expect(plannedPrompt.startsWith(planFreePrompt)).toBe(true)
    expect(plannedPrompt).toContain('the scene blocking plan\'s stage marks, camera setups, and canonical location geometry when a plan section is present')
    expect(plannedPrompt).toContain('every panel must also carry a `blocking` object citing `cameraSetupId`')
  })
})

describe('scene drafting against a blocking plan', () => {
  const sceneWithout = (drop: string): ScenePromptData => {
    const scene = buildBlockingFixtureScene({ withBlocking: true })
    return { ...scene, panels: scene.panels.map(panel => panel.number === 1 ? { ...panel, characterKeys: panel.characterKeys.filter(key => key !== drop) } : panel) }
  }

  test('retries once with the validator issues appended and then succeeds', async () => {
    const { slug, workspace } = await prepareWorkspace()
    await importFixturePlan(slug, workspace)
    await captureLogEvents(async () => { await generateJsonPrompt(slug) })
    const prompts: string[] = []
    await captureLogEvents(async () => {
      await generateSceneJson(slug, {
        model: 'gpt-5.6-sol',
        requestScene: async (request: SceneDraftRequest) => {
          prompts.push(request.prompt)
          return { text: JSON.stringify(request.attempt === 1 ? sceneWithout('bishop') : buildBlockingFixtureScene({ withBlocking: true })), inputTokens: 100, outputTokens: 200 }
        },
      })
    })
    expect(prompts).toHaveLength(2)
    expect(prompts[0]).not.toContain(SCENE_DRAFT_RETRY_HEADER)
    expect(prompts[0]).toContain(SCENE_PLAN_PINNED_SENTENCE)
    expect(prompts[1]).toContain(SCENE_DRAFT_RETRY_HEADER)
    expect(prompts[1]).toContain('Panel 1 camera "wide-from-airlock" sees "bishop" who is not in characterKeys and is not declared croppedOnStage')
    const scene = JSON.parse(await Bun.file(getSceneJsonPath(slug)).text()) as ScenePromptData & { blockingPlanSha256?: string }
    expect(scene.blockingPlanSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(scene.panels[0]!.blocking?.cameraSetupId).toBe('wide-from-airlock')
  })

  test('throws with the issue list when the retry still contradicts the plan', async () => {
    const { slug, workspace } = await prepareWorkspace()
    await importFixturePlan(slug, workspace)
    await captureLogEvents(async () => { await generateJsonPrompt(slug) })
    let attempts = 0
    await captureLogEvents(async () => {
      await expect(generateSceneJson(slug, {
        model: 'gpt-5.6-sol',
        requestScene: async () => { attempts++; return { text: JSON.stringify(sceneWithout('bishop')), inputTokens: 100, outputTokens: 200 } },
      })).rejects.toThrow('contradicts the blocking plan after 2 attempts')
    })
    expect(attempts).toBe(2)
    expect(existsSync(getSceneJsonPath(slug))).toBe(false)
  })

  test('a plan-free run makes exactly one call, adds no plan section, and stamps no plan hash', async () => {
    const { slug } = await prepareWorkspace()
    await captureLogEvents(async () => { await generateJsonPrompt(slug) })
    const prompts: string[] = []
    await captureLogEvents(async () => {
      await generateSceneJson(slug, {
        model: 'gpt-5.6-sol',
        requestScene: async (request: SceneDraftRequest) => {
          prompts.push(request.prompt)
          const scene = buildBlockingFixtureScene()
          return { text: JSON.stringify(scene), inputTokens: 100, outputTokens: 200 }
        },
      })
    })
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).not.toContain(SCENE_PLAN_SECTION_MARKER)
    const scene = JSON.parse(await Bun.file(getSceneJsonPath(slug)).text()) as Record<string, unknown>
    expect(scene).not.toHaveProperty('blockingPlanSha256')
    expect((scene['panels'] as Array<Record<string, unknown>>)[0]).not.toHaveProperty('blocking')
  })
})

describe('panel bundles compiled from an imported plan', () => {
  const buildPlannedWorkspace = async () => {
    const prepared = await prepareWorkspace()
    await importFixturePlan(prepared.slug, prepared.workspace)
    await writeFile(getSceneJsonPath(prepared.slug), JSON.stringify(buildBlockingFixtureScene({ withBlocking: true }), null, 2))
    await captureLogEvents(async () => { await panelPromptsCommand({ sceneSlug: prepared.slug, concurrency: 1 }) })
    return prepared
  }

  test('stamps blocking and planSha256 on every bundle, lists the on-stage cast, and writes the blocking artifacts', async () => {
    const { slug } = await buildPlannedWorkspace()
    const planSha256 = sha256Bytes(new Uint8Array(await Bun.file(getBlockingPlanPath(slug)).arrayBuffer()))
    const panelDirectories = (await readdir(getPanelPromptsDirectory(slug), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
    expect(panelDirectories).toEqual(['panel-01', 'panel-02', 'panel-03', 'panel-04', 'panel-05', 'panel-06'])

    const scene = buildBlockingFixtureScene({ withBlocking: true })
    for (const [index, name] of panelDirectories.entries()) {
      const { bundle } = await readPanelBundle(slug, name)
      expect(bundle.planSha256).toBe(planSha256)
      expect(bundle.blocking?.planSha256).toBe(planSha256)
      expect(bundle.blocking?.cameraSetupId).toBe(scene.panels[index]!.blocking!.cameraSetupId)
      const ledgerKeys = bundle.blocking!.ledger.map(entry => entry.characterKey)
      const cropped = bundle.blocking!.croppedOnStage.map(entry => entry.characterKey)
      const offFrame = bundle.blocking!.offFrameRoster.map(entry => entry.characterKey)
      const extras = bundle.blocking!.extrasInFrame.map(entry => entry.ensembleKey)
      for (const key of bundle.panels[0]!.characterKeys) {
        expect([...ledgerKeys, ...cropped, ...offFrame, ...extras]).toContain(key)
      }
      expect(new Set([...ledgerKeys, ...offFrame, ...cropped]).size).toBe(ledgerKeys.length + offFrame.length + cropped.length)
    }

    const blockingDirectory = getBlockingDirectory(slug)
    const artifacts = (await readdir(blockingDirectory)).sort()
    expect(artifacts).toEqual(['blocking-ledger.md', 'panel-01-layout.png', 'panel-01.svg', 'panel-02-layout.png', 'panel-02.svg', 'panel-03.svg', 'panel-04-layout.png', 'panel-04.svg', 'panel-05.svg', 'panel-06.svg', 'plan-overview.svg'])
    const ledger = await Bun.file(join(blockingDirectory, 'blocking-ledger.md')).text()
    const ledgerLines = ledger.split('\n').filter(line => line.startsWith('- Panel '))
    expect(ledgerLines).toHaveLength(6)
    expect(ledgerLines.every(line => !line.includes('\n'))).toBe(true)
    expect(ledgerLines[0]).toContain('camera wide-from-airlock')
  })

  test('keeps a plan-free run byte-identical in shape and free of blocking fields', async () => {
    const { slug } = await prepareWorkspace()
    await writeFile(getSceneJsonPath(slug), JSON.stringify(buildBlockingFixtureScene(), null, 2))
    await captureLogEvents(async () => { await panelPromptsCommand({ sceneSlug: slug, concurrency: 1 }) })
    const { bundle } = await readPanelBundle(slug, 'panel-01')
    expect(bundle.blocking).toBeUndefined()
    expect(bundle.planSha256).toBeUndefined()
    expect(existsSync(getBlockingDirectory(slug))).toBe(false)
  })

  test('--no-blocking ignores an existing plan for the panel-prompt stage', async () => {
    const { slug, workspace } = await prepareWorkspace()
    await importFixturePlan(slug, workspace)
    await writeFile(getSceneJsonPath(slug), JSON.stringify(buildBlockingFixtureScene(), null, 2))
    await captureLogEvents(async () => { await panelPromptsCommand({ sceneSlug: slug, concurrency: 1, blocking: false }) })
    const { bundle } = await readPanelBundle(slug, 'panel-01')
    expect(bundle.blocking).toBeUndefined()
    expect(bundle.planSha256).toBeUndefined()
  })

  test('the image prompt carries the ledger and both pinned sentences only for a single-panel planned bundle', async () => {
    const { slug } = await buildPlannedWorkspace()
    const first = (await readPanelBundle(slug, 'panel-01')).bundle
    const second = (await readPanelBundle(slug, 'panel-02')).bundle

    const singleData = buildComicPagePromptData([first])
    expect(singleData.blocking?.cameraSetupId).toBe('wide-from-airlock')
    expect(singleData.planSha256).toBe(first.planSha256)
    const singlePrompt = buildComicPagePrompt(singleData)
    expect(singlePrompt).toContain(BLOCKING_LEDGER_AUTHORITY_SENTENCE)
    expect(singlePrompt).toContain(OFF_FRAME_PINNED_SENTENCE)
    expect(singlePrompt).toContain('Blocking ledger (screen space, compiled from the reviewed stage plan)')
    expect(singlePrompt).toContain(first.blocking!.lines.camera)
    for (const line of first.blocking!.lines.ledger) expect(singlePrompt).toContain(line)
    expect(singlePrompt).toContain('Authoritative fixed-anchor visibility for this crop')
    expect(singlePrompt).toContain('Anchors not named as inside this frame are not visibility requirements')
    expect(singlePrompt).toContain('Temporary dressing state, not a visibility requirement')
    expect(singlePrompt).not.toContain(first.blocking!.lines.offFrame)
    const densePrompt = buildComicPagePrompt(singleData, [], [], [], { markerLegend: '1=duco (left, foreground, seated, away-from-camera)' })
    expect(densePrompt).toContain('Dense-cast screen-space layout: the final reference image')
    expect(densePrompt).toContain('structural diagram only, never an art or identity reference')
    expect(densePrompt).toContain('1=duco (left, foreground, seated, away-from-camera)')
    expect(densePrompt).toContain('Do not render any diagram marks in the final art')
    expect(singlePrompt).not.toContain(first.panels[0]!.shotPlan)
    expect(singlePrompt).toContain(SHOT_DIVERSITY_SENTENCE)
    expect(singlePrompt).not.toContain('Source Segments')
    expect(singlePrompt).not.toContain('"sourceSegments"')
    expect(singlePrompt).not.toContain('"blocking"')

    const groupedData = buildComicPagePromptData([first, second])
    expect(groupedData.blocking).toBeUndefined()
    expect(groupedData.planSha256).toBeUndefined()
    const groupedPrompt = buildComicPagePrompt(groupedData)
    expect(groupedPrompt).not.toContain(BLOCKING_LEDGER_AUTHORITY_SENTENCE)
    expect(groupedPrompt).not.toContain('Blocking ledger')
    expect(groupedPrompt).toContain(SHOT_DIVERSITY_SENTENCE)
  })

  test('the panel-image preflight rejects a stale plan hash before any provider call', async () => {
    const { slug } = await buildPlannedWorkspace()
    await writeFile(getBlockingPlanPath(slug), `${await Bun.file(getBlockingPlanPath(slug)).text()}\n`)
    const staleSha256 = sha256Bytes(new Uint8Array(await Bun.file(getBlockingPlanPath(slug)).arrayBuffer()))
    const bundleSha256 = (await readPanelBundle(slug, 'panel-01')).bundle.planSha256!
    let requested = 0
    await captureLogEvents(async () => {
      await expect(generatePanelImages(slug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'preflight-run', concurrency: 1, qa: false, panels: [1] }, {
        requestImage: async () => { requested++; return { mode: 'generate', result: { imageBase64: '' } } },
        writeImage: async () => {},
      })).rejects.toThrow(`Panel bundle plan hash ${bundleSha256} does not match metadata/blocking-plan.json ${staleSha256}; rerun draft-scenes --only panel-prompts`)
    })
    expect(requested).toBe(0)
  })

  test('passes the compiled dense-cast guide to generation and price accounting', async () => {
    const { slug } = await buildPlannedWorkspace()
    const calls: ComicImageRequestInput[] = []
    let judgments = 0
    await captureLogEvents(async () => {
      await generatePanelImages(slug, { models: ['gpt-image-2'], size: '1536x1024', quality: 'high', force: false, runId: 'layout-guide-run', concurrency: 1, qa: true, maxRepairs: 1, panels: [1], blockingLayoutGuide: true }, {
        requestImage: async input => {
          calls.push(input)
          return { mode: 'generate', result: { imageBase64: BLOCKING_FIXTURE_TINY_PNG.toString('base64') } }
        },
        writeImage: async (outputPath, imageBase64) => { await Bun.write(outputPath, Buffer.from(imageBase64, 'base64')) },
        judgePage: async request => {
          const failed = judgments++ === 0
          return {
            pageNumber: 1, panelNumbers: [1], outputFile: 'attempt.png', judgeModel: request.model, hardFailure: failed,
            result: { panelStructure: { pass: true, observedPanelCount: 1, observedPanelOrder: [1], issues: [] }, panels: [{ panelNumber: 1, requiredCastPresent: true, unexpectedCastAbsent: true, identityMatch: true, identityIssueKind: 'none', locationMatch: true, setContinuityMatch: true, setContinuityAudit: [], sourcePrecedence: true, shotPlanMatch: !failed, blockingMatch: true, axisSideMatch: true, blockingAudit: [], dialogueAccuracy: true, dialogueIssueKind: 'none', speakerAttribution: true, artifacts: [], visualQualityScore: 8, compositionScore: 8, issues: failed ? ['The first framing attempt is wrong.'] : [], editInstructions: failed ? 'Correct the framing.' : '', repairAssessment: { issueVisibility: failed ? 'directly-visible' : 'not-assessable', expectedBenefit: failed ? 'meaningful' : 'none', editScope: 'bounded', editIsolation: 'isolated-single-region', collateralRisk: 'low', confidence: 'high', recommendation: failed ? 'targeted-edit' : 'retain-current', preservationRequirements: [], rationale: failed ? 'The framing error is visible.' : 'No repair is needed.' } }], summary: failed ? 'Framing fails.' : 'Pass.' },
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, costUsd: 0 },
          } satisfies PageQaEntry
        },
      })
    })

    expect(calls).toHaveLength(2)
    const layoutPath = getBlockingPanelLayoutGuidePath(slug, 1)
    expect(calls[0]!.referenceImages.at(-1)).toBe(layoutPath)
    expect(calls[1]!.referenceImages[0]).toContain('attempt-0.png')
    expect(calls[1]!.referenceImages.at(-1)).toBe(layoutPath)
    expect(calls[0]!.normalizedPrompt).toContain('Dense-cast screen-space layout: the final reference image')
    expect(calls[1]!.normalizedPrompt).toContain('Dense-cast screen-space layout: the final reference image')
    expect(calls[0]!.normalizedPrompt).toContain('structural diagram only, never an art or identity reference')
    expect(calls[0]!.normalizedPrompt).toContain('1=peaches')
    expect(await validatePriceReferenceGroup(getPanelPromptsDirectory(slug), [1], ['gpt-image-2'])).toBe(calls[0]!.referenceImages.length - 1)
    expect(await validatePriceReferenceGroup(getPanelPromptsDirectory(slug), [1], ['gpt-image-2'], true)).toBe(calls[0]!.referenceImages.length)
    expect(calls[1]!.referenceImages).toHaveLength(calls[0]!.referenceImages.length + 1)
  })
})

describe('rebind against the structure stage snapshot', () => {
  const splitSegments = BLOCKING_FIXTURE_SEGMENTS.flatMap(segment => segment.id === 'beat-0004'
    ? [
      { ...segment, id: 'beat-0004-01', text: 'Gulp sits on a crate near the ladder.' },
      { ...segment, id: 'beat-0004-02', text: 'Bishop crosses to the grav lift and leans on it.' },
    ]
    : [segment])

  const prepareSplitWorkspace = async (options: { withSnapshot: boolean }) => {
    const prepared = await prepareWorkspace()
    await importFixturePlan(prepared.slug, prepared.workspace)
    // Stand in for a structure re-run that split one direction beat in two.
    if (options.withSnapshot) await writeFile(getPreviousStructuredScriptPath(prepared.slug), `${JSON.stringify(script, null, 2)}\n`)
    await writeFile(getStructuredScriptPath(prepared.slug), `${JSON.stringify(buildBlockingFixtureStructuredScript({ segments: splitSegments }), null, 2)}\n`)
    return prepared
  }

  test('resolves a split citation from the snapshot the structure stage leaves behind', async () => {
    const prepared = await prepareSplitWorkspace({ withSnapshot: true })
    expect(existsSync(getPreviousStructuredScriptPath(prepared.slug))).toBe(true)
    const { result } = await captureLogEvents(async () => await rebindBlockingPlan(prepared.slug))
    expect(result.unresolved).toEqual([])
    expect(result.remapped.map(item => `${item.path}:${item.from}->${item.to}`)).toEqual([
      'stageStates[1].startsAt:beat-0004->beat-0004-01',
      'stageStates[1].moves[0].citation:beat-0004->beat-0004-01',
      'stageStates[1].moves[1].citation:beat-0004->beat-0004-02',
    ])
    const rewritten = JSON.parse(await Bun.file(getBlockingPlanPath(prepared.slug)).text())
    expect(rewritten.stageStates[1].startsAt.sourceSegmentId).toBe('beat-0004-01')
  })

  test('the structure stage snapshots the script it replaces and leaves none on a first run', async () => {
    // prepareWorkspace only configures the character and location catalogs the parser needs; the
    // structure stage under test runs in its own untouched workspace.
    await prepareWorkspace()
    const workspace = await makeTempDir('autoshow-structure-snapshot-')
    temporaryDirectories.push(workspace)
    const slug = 'structure-snapshot'
    beginSceneRun(slug, { outputDir: workspace })
    const scriptPath = join(workspace, 'scene.md')
    await writeFile(scriptPath, '# Episode Eight\n\n## Scene: "Snapshot"\n\n**INT. CARGO BAY - MORNING**\n\n**PEACHES**\n\nMandatory meeting.\n')
    await captureLogEvents(async () => { await generateStructuredScript(scriptPath, slug) })
    expect(existsSync(getPreviousStructuredScriptPath(slug))).toBe(false)
    const firstBytes = await Bun.file(getStructuredScriptPath(slug)).text()
    // A re-run of the same canonical source: the workspace stays bound to it, and the script the run
    // replaces is preserved for --rebind.
    await captureLogEvents(async () => { await generateStructuredScript(scriptPath, slug) })
    expect(await Bun.file(getPreviousStructuredScriptPath(slug)).text()).toBe(firstBytes)
    expect(await Bun.file(getStructuredScriptPath(slug)).text()).toBe(firstBytes)
  })

  test('without a snapshot the same split is unresolved and the error names the missing file', async () => {
    const prepared = await prepareSplitWorkspace({ withSnapshot: false })
    expect(existsSync(getPreviousStructuredScriptPath(prepared.slug))).toBe(false)
    const failure = await captureLogEvents(async () => await rebindBlockingPlan(prepared.slug).then(() => undefined, (error: unknown) => error))
    const message = failure.result instanceof Error ? failure.result.message : String(failure.result)
    expect(message).toContain('no current segment carries the cited content hash and no previous structured script was available to recognize a split or merge')
    expect(message).toContain('No structured-script.previous.json snapshot was available')
  })
})

describe('blocking price estimates', () => {
  test('prices the blocking stage as at most two calls and the scene stage per panel', async () => {
    const { slug, workspace } = await prepareWorkspace()
    await importFixturePlan(slug, workspace)
    await captureLogEvents(async () => { await generateJsonPrompt(slug) })
    await writeFile(getSceneJsonPath(slug), JSON.stringify(buildBlockingFixtureScene({ withBlocking: true }), null, 2))

    const { events } = await captureLogEvents(async () => {
      await estimateDraftScenesPrice({ scriptPath: 'input/scripts/02-script/01-mandatory-meeting.md', sceneSlug: slug, only: 'blocking' })
    })
    const blockingRows = events.find(event => typeof event.message === 'string' && event.message.startsWith('Comic - Price Estimate: draft-scenes --only blocking'))
    expect(blockingRows?.metadata).toMatchObject({ stage: 'draft-scenes:blocking', maximumCalls: 2, locationCount: 2 })
    expect(Object.keys(blockingRows?.metadata ?? {}).some(key => key.toLowerCase().includes('token'))).toBe(false)
    expect(events.some(event => typeof event.message === 'string' && event.message.startsWith('Blocking plan: maximum calls 2 (one drafting call plus one automatic retry'))).toBe(true)

    const { events: sceneEvents } = await captureLogEvents(async () => {
      await estimateDraftScenesPrice({ scriptPath: 'input/scripts/02-script/01-mandatory-meeting.md', sceneSlug: slug, only: 'scene' })
    })
    const sceneEstimate = sceneEvents.find(event => typeof event.message === 'string' && event.message.startsWith('Comic - Price Estimate: draft-scenes --only scene'))
    expect(sceneEstimate?.metadata).toMatchObject({
      stage: 'draft-scenes:scene',
      maximumCalls: 2,
      panelEstimate: 6,
      outputUnitsFixed: SCENE_DRAFT_OUTPUT_UNITS_FIXED,
      outputUnitsPerPanel: SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL,
      outputUnitsPerCall: SCENE_DRAFT_OUTPUT_UNITS_FIXED + SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL * 6,
    })
    // The row table never reaches stdout, so the readable basis line has to carry the exact total the
    // project approval threshold is checked against.
    const sceneBasis = sceneEvents.find(event => typeof event.message === 'string' && event.message.startsWith('Scene estimate: input units'))
    expect(sceneBasis?.message).toMatch(/; total ~\$\d+\.\d{2}$/)
    expect(typeof (sceneBasis?.metadata as { totalCost?: unknown } | undefined)?.totalCost).toBe('number')
  })

  test('rebind and import price as zero-call local operations', async () => {
    const { slug } = await prepareWorkspace()
    const { events: rebindEvents } = await captureLogEvents(async () => {
      await estimateDraftScenesPrice({ scriptPath: 'script.md', sceneSlug: slug, only: 'blocking', rebind: true })
    })
    expect(rebindEvents.some(event => event.message === 'Comic - Price Estimate: draft-scenes --only blocking: --rebind remaps plan citations locally and makes no LLM or image generation API calls.')).toBe(true)

    const { events: importEvents } = await captureLogEvents(async () => {
      await estimateDraftScenesPrice({ scriptPath: 'script.md', sceneSlug: slug, only: 'blocking', blockingPlan: 'input/blocking/plan.json' })
    })
    expect(importEvents.some(event => event.message === 'Comic - Price Estimate: draft-scenes --only blocking: --blocking-plan imports input/blocking/plan.json locally and makes no LLM or image generation API calls.')).toBe(true)
  })
})

describe('reference slot reservation', () => {
  test('reserves the repair slot without ever dropping a required reference', async () => {
    const { trimOptionalContinuityReferences } = await import('~/cli/commands/process-steps/step-8-comic/comic-utils/reference-capabilities')
    const required = Array.from({ length: 15 }, (_, index) => `required-${index + 1}.png`)
    const optional = ['optional-1.png', 'optional-2.png']
    expect(trimOptionalContinuityReferences('gpt-image-2', required, optional).references).toEqual([...required, 'optional-1.png'])
    const reserved = trimOptionalContinuityReferences('gpt-image-2', required, optional, { reserveSlots: 1 })
    expect(reserved.references).toEqual(required)
    expect(reserved.trimmed).toEqual(optional)
    expect(trimOptionalContinuityReferences('gpt-image-2', required, [], { reserveSlots: 4 }).references).toEqual(required)
    expect(() => trimOptionalContinuityReferences('gpt-image-2', Array.from({ length: 17 }, (_, index) => `required-${index + 1}.png`), [], { reserveSlots: 1 })).toThrow('Required character references')
  })
})
