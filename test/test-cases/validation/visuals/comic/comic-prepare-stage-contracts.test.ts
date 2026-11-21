import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { draftScenesCommand, getDraftSceneStages } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/draft-scenes-command'
import { generateSceneJson, SCENE_DRAFT_RETRY_HEADER } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/generate-scene-json'
import { prepareSceneCommand, readPreparedScenePair } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/prepare-scene'
import { estimateDraftScenesPrice, SCENE_DRAFT_OUTPUT_UNITS_FIXED, SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL } from '~/cli/commands/visuals/comic/comic-utils/comic-price-llm-estimates'
import { extractPanelBundleData, getPromptBundleFilename } from '~/cli/commands/visuals/comic/comic-utils/panel-prompt-utils'
import { getDraftPromptPath, getInvalidSceneJsonPath, getPanelPromptsDirectory, getSceneJsonPath, getStructuredScriptPath } from '~/cli/commands/visuals/comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { prepareHarborlightComic } from '~/tools/prepare-harborlight-comic'
import type { DraftScenesCommandOptions, ScenePromptData, SceneDraftRequest, StructuredScriptData } from '~/types'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

// Local contracts only: the Harborlight inputs are parsed for real, every hosted scene request goes through an injected
// fake, and global fetch is replaced with a counter that fails loudly, so these tests prove dispatch counts and artifact
// bytes, never model output quality.

const SCENE_SLUG = '01-harborlight-camp'
const LEGACY_BLOCKING_PLAN_SECTION = '## Scene blocking plan (authoritative stage marks and cameras)'
const temporaryDirectories: string[] = []
const originalFetch = globalThis.fetch
let fetchCalls = 0

beforeEach(() => {
  fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls++
    throw new Error('Network is forbidden in the local prepare-stage contracts')
  }) as unknown as typeof fetch
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  resetSceneRunContext()
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const setup = async () => {
  const base = await makeTempDir('autoshow-prepare-stage-')
  temporaryDirectories.push(base)
  const root = join(base, 'fixture')
  await prepareHarborlightComic(root)
  configureCharactersRoot(join(root, 'characters'))
  const scriptPath = join(root, '02-script', `${SCENE_SLUG}.md`)
  const run = join(base, 'run')
  beginSceneRun(SCENE_SLUG, { outputDir: run })
  return { base, root, scriptPath, run }
}

const readFileText = (path: string): string => readFileSync(path, 'utf8')

const quiet = async <T>(run: () => Promise<T>) => (await captureLogEvents(run)).result

const prepare = async (scriptPath: string) => await quiet(() => prepareSceneCommand({ scriptPath, sceneSlug: SCENE_SLUG }))

const pairBytes = async (run: string) => ({
  structure: await Bun.file(join(run, 'metadata/structured-script.json')).text(),
  prompt: await Bun.file(join(run, 'metadata/draft-prompt.md')).text(),
  manifest: await Bun.file(join(run, 'manifest.json')).text(),
})

const listFiles = async (directory: string): Promise<string[]> => {
  if (!existsSync(directory)) return []
  return (await readdir(directory, { recursive: true })).map(String).sort()
}

const sceneFor = (script: StructuredScriptData): ScenePromptData => {
  const groups: StructuredScriptData['sourceSegments'][] = []
  for (const segment of script.sourceSegments) {
    if (segment.type === 'panel-note' || groups.length === 0) groups.push([])
    groups.at(-1)!.push(segment)
  }
  return {
    schemaVersion: 4,
    title: 'The Lantern Path',
    location: 'EXT. HARBORLIGHT CAMP - DUSK',
    panels: groups.map((segments, index) => ({
      number: index + 1,
      description: `Panel ${index + 1}: Papa Bear stands left and Mira right beside the stone fire ring.`,
      shotPlan: 'Wide two-shot from the southern approach; the timber bench stays visible.',
      characterKeys: ['papa-bear', 'mira'] as ScenePromptData['panels'][number]['characterKeys'],
      speech: segments.filter(segment => segment.type === 'dialogue').map(segment => ({ speaker: { kind: 'character' as const, characterKey: segment.speakerKey!, offscreen: false }, line: segment.text })),
      sourceSegmentIds: segments.map(segment => segment.id),
      locationKey: 'harborlight-camp',
      designReferences: [],
    })),
  }
}

// Merges the last two panels so every source segment stays covered while the panel count contract is missed.
const mergeLastTwoPanels = (scene: ScenePromptData): ScenePromptData => {
  const last = scene.panels.at(-1)!
  const previous = scene.panels.at(-2)!
  return { ...scene, panels: [...scene.panels.slice(0, -2), { ...previous, speech: [...previous.speech, ...last.speech], sourceSegmentIds: [...previous.sourceSegmentIds, ...last.sourceSegmentIds] }] }
}

const fakeSceneProvider = (respond: (request: SceneDraftRequest) => string) => {
  const requests: SceneDraftRequest[] = []
  return {
    requests,
    requestScene: async (request: SceneDraftRequest) => {
      requests.push(request)
      return { text: respond(request), inputTokens: 100, outputTokens: 200 }
    },
  }
}

const draftScene = async (provider: ReturnType<typeof fakeSceneProvider>, options: { panelCount?: number } = {}) =>
  await quiet(() => generateSceneJson(SCENE_SLUG, { model: 'gpt-6.1-sol', requestScene: provider.requestScene, ...(options.panelCount !== undefined ? { panelCount: options.panelCount } : {}) }))

const readBundles = async () => {
  const directory = getPanelPromptsDirectory(SCENE_SLUG)
  const panels = (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  return await Promise.all(panels.map(async name => {
    const panelDirectory = join(directory, name)
    const content = await Bun.file(join(panelDirectory, getPromptBundleFilename(panelDirectory, await readdir(panelDirectory, { withFileTypes: true })))).text()
    return { name, content, bundle: extractPanelBundleData(content) }
  }))
}

describe('draft-scenes stage order', () => {
  const recorder = () => {
    const calls: string[] = []
    return {
      calls,
      dependencies: {
        runPrepare: async () => { calls.push('prepare') },
        runSceneDraft: async () => { calls.push('scene') },
        runPanelPrompts: async (options: Record<string, unknown>) => { calls.push('panel-prompts'); expect(options).not.toHaveProperty('blocking') },
      },
    }
  }
  const run = async (options: Partial<DraftScenesCommandOptions>, stageRecorder: ReturnType<typeof recorder>) => {
    const workspace = await makeTempDir('autoshow-prepare-stage-order-')
    temporaryDirectories.push(workspace)
    beginSceneRun(SCENE_SLUG, { outputDir: workspace })
    return await quiet(() => draftScenesCommand({ scriptPath: 'script.md', sceneSlug: SCENE_SLUG, ...options }, stageRecorder.dependencies as never, 'nested'))
  }

  test('runs prepare, scene, then panel-prompts and each stage alone with --only', async () => {
    expect(getDraftSceneStages({})).toEqual(['prepare', 'scene', 'panel-prompts'])
    const full = recorder()
    expect((await run({}, full)).stages).toEqual(['prepare', 'scene', 'panel-prompts'])
    expect(full.calls).toEqual(['prepare', 'scene', 'panel-prompts'])
    for (const only of ['prepare', 'scene', 'panel-prompts'] as const) {
      const single = recorder()
      expect((await run({ only }, single)).stages).toEqual([only])
      expect(single.calls).toEqual([only])
    }
    expect(fetchCalls).toBe(0)
  })
})

describe('prepare stage', () => {
  test('writes structured-script.json and draft-prompt.md as one bound pair with zero hosted calls', async () => {
    const { scriptPath, run } = await setup()
    const result = await prepare(scriptPath)
    expect(result.structuredScriptPath).toBe(join(run, 'metadata/structured-script.json'))
    expect(result.draftPromptPath).toBe(join(run, 'metadata/draft-prompt.md'))
    expect(await listFiles(join(run, 'metadata'))).toEqual(['draft-prompt.md', 'structured-script.json'])
    const pair = await readPreparedScenePair(SCENE_SLUG)
    expect(result.sourceSegments).toBe(pair.structuredScript.sourceSegments.length)
    expect(pair.draftPrompt).toContain(`\`\`\`json\n${JSON.stringify(pair.structuredScript, null, 2)}\n\`\`\``)
    expect(pair.draftPrompt).not.toContain(LEGACY_BLOCKING_PLAN_SECTION)
    expect(pair.structuredScript).not.toHaveProperty('staging')
    expect(pair.structuredScript.sourceSegments.filter(segment => segment.type === 'dialogue').map(segment => [segment.speakerKey, segment.text])).toEqual([
      ['papa-bear', 'Lantern ready?'],
      ['mira', 'Ready. I checked the wick.'],
      ['papa-bear', 'Then let us mark the path home.'],
      ['mira', 'A light for whoever comes next.'],
    ])
    expect(pair.structuredScript.sourceSegments.filter(segment => segment.type === 'dialogue').every(segment => segment.sourceSpans.length > 0)).toBe(true)
    expect(pair.structuredScript.sourceSegments.filter(segment => segment.type === 'panel-note')).toHaveLength(4)
    const manifest = JSON.parse((await pairBytes(run)).manifest)
    expect(manifest.items[0].metadata.comic.audio.structuredScript.path).toBe('metadata/structured-script.json')
    expect(fetchCalls).toBe(0)
  })

  test('a parse failure leaves an existing pair and manifest byte-identical', async () => {
    const { scriptPath, run } = await setup()
    await prepare(scriptPath)
    const before = await pairBytes(run)
    const original = await Bun.file(scriptPath).text()
    await writeFile(scriptPath, original.replace('**PAPA BEAR**\nLantern ready?', '**PAPA BEAR**\n\n**CAMERA:** Tight on Papa Bear.\n\nLantern ready?'))
    await expect(quiet(() => prepareSceneCommand({ scriptPath, sceneSlug: SCENE_SLUG }))).rejects.toThrow(`${SCENE_SLUG}.md:`)
    expect(await pairBytes(run)).toEqual(before)
    expect(await listFiles(join(run, 'metadata'))).toEqual(['draft-prompt.md', 'structured-script.json'])
    expect(fetchCalls).toBe(0)
  })

  test('a prompt-building failure keeps the prior pair, and a retry after the cause is fixed publishes a new bound pair', async () => {
    const { root, scriptPath, run } = await setup()
    // The recap montage cue parses, then prompt building fails because the previous episode folder does not exist.
    await writeFile(scriptPath, (await Bun.file(scriptPath).text()).replace('Mira lifts the lantern', 'Cue a rapid montage of Episode 1, every scene sped up.\n\nMira lifts the lantern'))
    await expect(quiet(() => prepareSceneCommand({ scriptPath, sceneSlug: SCENE_SLUG }))).rejects.toThrow('Recap montage expansion could not read previous episode folder')
    expect(await listFiles(run)).toEqual([])

    await mkdir(join(root, '01-script'))
    await writeFile(join(root, '01-script', '01-prior.md'), '# Episode 1: Prior\n\n## Scene 1: Before\n\n**EXT. HARBORLIGHT CAMP - DUSK**\n\nPapa Bear builds the fire ring.\n')
    await prepare(scriptPath)
    const first = await pairBytes(run)
    expect(first.prompt).toContain('01-prior.md')

    // Remove the prior folder again: the retry fails at prompt building and the published pair stays bound and usable.
    await rm(join(root, '01-script'), { recursive: true })
    await expect(quiet(() => prepareSceneCommand({ scriptPath, sceneSlug: SCENE_SLUG }))).rejects.toThrow('Recap montage expansion')
    expect(await pairBytes(run)).toEqual(first)
    const provider = fakeSceneProvider(() => { throw new Error('stop after recording the prompt') })
    await expect(draftScene(provider)).rejects.toThrow('stop after recording the prompt')
    expect(provider.requests.map(request => request.prompt)).toEqual([first.prompt])
    expect(fetchCalls).toBe(0)
  })

  test('rejects a foreign-source --output-dir before writing anything', async () => {
    const { base, scriptPath, run } = await setup()
    await prepare(scriptPath)
    const before = await pairBytes(run)
    const files = await listFiles(run)
    const foreign = join(base, 'other', '02-script', `${SCENE_SLUG}.md`)
    await mkdir(join(base, 'other', '02-script'), { recursive: true })
    await writeFile(foreign, (await Bun.file(scriptPath).text()).replace('Lantern ready?', 'Lantern lit?'))
    await expect(quiet(() => prepareSceneCommand({ scriptPath: foreign, sceneSlug: SCENE_SLUG }))).rejects.toThrow(`Scene output ${run} does not belong to`)
    expect(await pairBytes(run)).toEqual(before)
    expect(await listFiles(run)).toEqual(files)

    // An unmanifested workspace is still checked through the embedded source identity.
    await rm(join(run, 'manifest.json'))
    await expect(quiet(() => prepareSceneCommand({ scriptPath: foreign, sceneSlug: SCENE_SLUG }))).rejects.toThrow('metadata/structured-script.json embeds another source identity')
    expect(await Bun.file(join(run, 'metadata/structured-script.json')).text()).toBe(before.structure)
    expect(await Bun.file(join(run, 'metadata/draft-prompt.md')).text()).toBe(before.prompt)
  })
})

describe('scene drafting accepts only the matching prepared pair', () => {
  const expectRejectedBeforeRequest = async (message: string) => {
    const provider = fakeSceneProvider(() => { throw new Error('scene drafting must not reach the provider') })
    await expect(draftScene(provider)).rejects.toThrow(message)
    expect(provider.requests).toHaveLength(0)
    expect(existsSync(getSceneJsonPath(SCENE_SLUG))).toBe(false)
    expect(fetchCalls).toBe(0)
  }

  test('an edited structure without a rebuilt prompt fails before the provider request', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    const structured = JSON.parse(await Bun.file(getStructuredScriptPath(SCENE_SLUG)).text()) as StructuredScriptData
    structured.sourceSegments[0]!.text += ' edited'
    await writeFile(getStructuredScriptPath(SCENE_SLUG), `${JSON.stringify(structured, null, 2)}\n`)
    await expectRejectedBeforeRequest('was not built from the current')
  })

  test('a legacy prompt carrying the retired blocking plan section fails before the provider request', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    await writeFile(getDraftPromptPath(SCENE_SLUG), `${await Bun.file(getDraftPromptPath(SCENE_SLUG)).text()}\n\n${LEGACY_BLOCKING_PLAN_SECTION}\n\nStage marks.\n`)
    await expectRejectedBeforeRequest('carries a retired blocking plan section')
  })

  test('a consistently hand-edited pair that no longer matches the manifest hash fails before the provider request', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    const structureText = await Bun.file(getStructuredScriptPath(SCENE_SLUG)).text()
    const promptText = await Bun.file(getDraftPromptPath(SCENE_SLUG)).text()
    const structured = JSON.parse(structureText) as StructuredScriptData
    const block = (value: StructuredScriptData) => `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
    const edited = structuredClone(structured)
    edited.sourceSegments[0]!.text += ' edited'
    expect(promptText).toContain(block(structured))
    await writeFile(getStructuredScriptPath(SCENE_SLUG), `${JSON.stringify(edited, null, 2)}\n`)
    await writeFile(getDraftPromptPath(SCENE_SLUG), promptText.replace(block(structured), block(edited)))
    await expectRejectedBeforeRequest('does not match the structured script recorded in the scene manifest')
  })

  test('a missing prepared artifact names the prepare stage', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    await rm(getDraftPromptPath(SCENE_SLUG))
    await expectRejectedBeforeRequest('--only prepare')
  })
})

describe('scene drafting dispatch', () => {
  test('a valid plan-free draft makes exactly one call with the prepared prompt and no retry section', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    const pair = await readPreparedScenePair(SCENE_SLUG)
    const provider = fakeSceneProvider(() => JSON.stringify(sceneFor(pair.structuredScript)))
    await draftScene(provider)
    expect(provider.requests).toHaveLength(1)
    expect(provider.requests[0]!.prompt).toBe(pair.draftPrompt)
    expect(provider.requests[0]!.prompt).not.toContain(SCENE_DRAFT_RETRY_HEADER)
    const scene = JSON.parse(await Bun.file(getSceneJsonPath(SCENE_SLUG)).text()) as Record<string, unknown>
    expect(scene).not.toHaveProperty('blockingPlanSha256')
    for (const panel of scene['panels'] as Array<Record<string, unknown>>) expect(panel).not.toHaveProperty('blocking')
    expect(fetchCalls).toBe(0)
  })

  test('a schema failure is never retried, even with --panel-count, and leaves invalid-candidate evidence', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    for (const panelCount of [undefined, 4]) {
      const provider = fakeSceneProvider(() => '{}')
      await expect(draftScene(provider, panelCount === undefined ? {} : { panelCount })).rejects.toThrow()
      expect(provider.requests).toHaveLength(1)
      const evidence = JSON.parse(await Bun.file(getInvalidSceneJsonPath(SCENE_SLUG)).text())
      expect(evidence.output).toEqual({})
      expect(evidence.validationError).toBeString()
      expect(existsSync(getSceneJsonPath(SCENE_SLUG))).toBe(false)
    }
  })

  test('a panel-count miss retries once with the validator issues appended, then publishes', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    const pair = await readPreparedScenePair(SCENE_SLUG)
    const valid = sceneFor(pair.structuredScript)
    const short = mergeLastTwoPanels(valid)
    const provider = fakeSceneProvider(request => JSON.stringify(request.attempt === 1 ? short : valid))
    await draftScene(provider, { panelCount: 4 })
    expect(provider.requests.map(request => request.attempt)).toEqual([1, 2])
    expect(provider.requests[0]!.prompt).not.toContain(SCENE_DRAFT_RETRY_HEADER)
    expect(provider.requests[1]!.prompt).toContain(SCENE_DRAFT_RETRY_HEADER)
    expect(provider.requests[1]!.prompt).toContain('Scene JSON has 3 panels; the panel count contract requires exactly 4')
    expect(provider.requests[1]!.prompt).not.toMatch(/blocking plan/i)
    expect((JSON.parse(await Bun.file(getSceneJsonPath(SCENE_SLUG)).text()) as ScenePromptData).panels).toHaveLength(4)
  })

  test('retains the original validation error when invalid-candidate evidence cannot be written', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    await mkdir(getInvalidSceneJsonPath(SCENE_SLUG), { recursive: true })
    const pair = await readPreparedScenePair(SCENE_SLUG)
    const valid = sceneFor(pair.structuredScript)
    const provider = fakeSceneProvider(() => JSON.stringify(mergeLastTwoPanels(valid)))
    const { events } = await captureLogEvents(async () => {
      await expect(generateSceneJson(SCENE_SLUG, { model: 'gpt-6.1-sol', panelCount: 4, requestScene: provider.requestScene })).rejects.toThrow('missed the panel count contract after 2 attempts')
    })
    expect(provider.requests).toHaveLength(2)
    expect(events.some(event => typeof event.message === 'string' && event.message.startsWith('Could not save invalid scene draft candidate:'))).toBe(true)
    expect(existsSync(getSceneJsonPath(SCENE_SLUG))).toBe(false)
  })
})

describe('full draft-scenes run and local panel-prompt rebuilds', () => {
  const runStages = async (only: DraftScenesCommandOptions['only'] | undefined, scriptPath: string, provider: ReturnType<typeof fakeSceneProvider>) =>
    await quiet(() => draftScenesCommand({ scriptPath, sceneSlug: SCENE_SLUG, concurrency: 1, ...(only ? { only } : {}) }, {
      runSceneDraft: async () => await generateSceneJson(SCENE_SLUG, { model: 'gpt-6.1-sol', requestScene: provider.requestScene }),
    }, 'nested'))

  test('prepare -> scene -> panel-prompts writes plan-free bundles with one hosted scene call', async () => {
    const { scriptPath, run } = await setup()
    let expectedScene: ScenePromptData | undefined
    const provider = fakeSceneProvider(request => {
      expect(request.prompt).toBe(readFileText(getDraftPromptPath(SCENE_SLUG)))
      expectedScene = sceneFor(JSON.parse(readFileText(getStructuredScriptPath(SCENE_SLUG))))
      return JSON.stringify(expectedScene)
    })
    expect((await runStages(undefined, scriptPath, provider)).stages).toEqual(['prepare', 'scene', 'panel-prompts'])
    expect(provider.requests).toHaveLength(1)
    expect(fetchCalls).toBe(0)
    expect(await listFiles(join(run, 'metadata'))).toEqual(expect.arrayContaining(['draft-prompt.md', 'scene.json', 'structured-script.json']))
    const bundles = await readBundles()
    expect(bundles.map(bundle => bundle.name)).toEqual(['panel-01', 'panel-02', 'panel-03', 'panel-04'])
    for (const [index, { content, bundle }] of bundles.entries()) {
      expect(content).not.toContain('"blocking"')
      expect(content).not.toContain('"planSha256"')
      expect(bundle).not.toHaveProperty('blocking')
      expect(bundle).not.toHaveProperty('planSha256')
      expect(bundle.panels[0]!.number).toBe(index + 1)
      expect(bundle.panels[0]!.sourceSegmentIds).toEqual(expectedScene!.panels[index]!.sourceSegmentIds)
      expect(bundle.panels[0]!.speech.map(item => item.line)).toEqual(expectedScene!.panels[index]!.speech.map(item => item.line))
      expect(bundle.panels[0]!.sourceSegments.map(segment => segment.id)).toEqual(expectedScene!.panels[index]!.sourceSegmentIds)
      expect(bundle.panels[0]!.locationKey).toBe('harborlight-camp')
    }
    expect(await Bun.file(join(run, 'metadata/panel-prompts/source-coverage.json')).json()).toMatchObject({ complete: true, missingSegments: [] })
  })

  test('each stage runs alone, and --only panel-prompts after a scene edit makes zero hosted calls and preserves the reviewed scene', async () => {
    const { scriptPath } = await setup()
    const provider = fakeSceneProvider(() => JSON.stringify(sceneFor(JSON.parse(readFileText(getStructuredScriptPath(SCENE_SLUG))))))
    await runStages('prepare', scriptPath, provider)
    expect(provider.requests).toHaveLength(0)
    expect(existsSync(getSceneJsonPath(SCENE_SLUG))).toBe(false)
    await runStages('scene', scriptPath, provider)
    expect(provider.requests).toHaveLength(1)
    expect(existsSync(getPanelPromptsDirectory(SCENE_SLUG))).toBe(false)

    const reviewed = JSON.parse(await Bun.file(getSceneJsonPath(SCENE_SLUG)).text()) as ScenePromptData
    reviewed.panels[2]!.description = 'Reviewed: Papa Bear points toward the path beyond the bench.'
    reviewed.panels[2]!.shotPlan = 'Reviewed: closer two-shot with the bench behind them.'
    const reviewedBytes = `${JSON.stringify(reviewed, null, 2)}\n`
    await writeFile(getSceneJsonPath(SCENE_SLUG), reviewedBytes)
    const pairBefore = { structure: readFileText(getStructuredScriptPath(SCENE_SLUG)), prompt: readFileText(getDraftPromptPath(SCENE_SLUG)) }

    await runStages('panel-prompts', scriptPath, provider)
    expect(provider.requests).toHaveLength(1)
    expect(fetchCalls).toBe(0)
    expect(await Bun.file(getSceneJsonPath(SCENE_SLUG)).text()).toBe(reviewedBytes)
    expect({ structure: readFileText(getStructuredScriptPath(SCENE_SLUG)), prompt: readFileText(getDraftPromptPath(SCENE_SLUG)) }).toEqual(pairBefore)
    const third = (await readBundles())[2]!.bundle.panels[0]!
    expect(third.description).toBe('Reviewed: Papa Bear points toward the path beyond the bench.')
    expect(third.shotPlan).toBe('Reviewed: closer two-shot with the bench behind them.')
  })

  test('a legacy plan-bearing scene.json builds plan-free bundles and is left byte-identical', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    const scene = sceneFor((await readPreparedScenePair(SCENE_SLUG)).structuredScript)
    const legacy = { ...scene, blockingPlanSha256: 'a'.repeat(64), panels: scene.panels.map(panel => ({ ...panel, blocking: { stageStateId: 'lantern-path', cameraSetupId: 'path-side-wide', croppedOnStage: [], axisBreak: null } })) }
    const legacyBytes = `${JSON.stringify(legacy, null, 2)}\n`
    await mkdir(join(getSceneJsonPath(SCENE_SLUG), '..'), { recursive: true })
    await writeFile(getSceneJsonPath(SCENE_SLUG), legacyBytes)
    await quiet(() => draftScenesCommand({ scriptPath, sceneSlug: SCENE_SLUG, only: 'panel-prompts', concurrency: 1 }, {}, 'nested'))
    expect(await Bun.file(getSceneJsonPath(SCENE_SLUG)).text()).toBe(legacyBytes)
    for (const { content } of await readBundles()) {
      expect(content).not.toContain('"blocking"')
      expect(content).not.toContain('"planSha256"')
    }
    expect(fetchCalls).toBe(0)
  })
})

describe('draft-scenes price estimates', () => {
  const priceEvents = async (options: Partial<DraftScenesCommandOptions>, scriptPath: string) =>
    (await captureLogEvents(async () => { await estimateDraftScenesPrice({ scriptPath, sceneSlug: SCENE_SLUG, ...options }) })).events
  const find = (events: Awaited<ReturnType<typeof priceEvents>>, prefix: string) => events.find(event => typeof event.message === 'string' && event.message.startsWith(prefix))

  test('--only prepare --price is free, makes zero calls and writes no artifacts', async () => {
    const { scriptPath, run } = await setup()
    const events = await priceEvents({ only: 'prepare' }, scriptPath)
    expect(find(events, 'Comic - Price Estimate: draft-scenes prepare stage')?.metadata).toMatchObject({ stage: 'draft-scenes:prepare', llmCalls: 0, imageCalls: 0, totalCost: 0 })
    expect(find(events, 'Comic - Price Estimate: draft-scenes scene stage')).toBeUndefined()
    expect(existsSync(run)).toBe(false)
    expect(fetchCalls).toBe(0)
  })

  test('a full estimate prices scene drafting from the in-memory prompt, without writing artifacts', async () => {
    const { scriptPath, run } = await setup()
    const events = await priceEvents({}, scriptPath)
    expect(find(events, 'Comic - Price Estimate: draft-scenes prepare stage')?.metadata).toMatchObject({ totalCost: 0 })
    expect(find(events, 'Comic - Price Estimate: draft-scenes panel-prompts stage')?.metadata).toMatchObject({ totalCost: 0 })
    const scene = find(events, 'Comic - Price Estimate: draft-scenes scene stage')
    expect(scene?.metadata).toMatchObject({ stage: 'draft-scenes:scene', maximumCalls: 1, panelCountRetryCalls: 0, outputUnitsFixed: SCENE_DRAFT_OUTPUT_UNITS_FIXED, outputUnitsPerPanel: SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL })
    const panelEstimate = (scene?.metadata as { panelEstimate: number }).panelEstimate
    expect(panelEstimate).toBeGreaterThan(1)
    expect(scene?.metadata).toMatchObject({ outputUnitsPerCall: SCENE_DRAFT_OUTPUT_UNITS_FIXED + SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL * panelEstimate })
    expect(Number((scene?.metadata as { totalCost: number }).totalCost)).toBeGreaterThan(0)
    const basis = find(events, 'Scene estimate: input units')
    expect(basis?.message).toContain('maximum calls 1')
    expect(basis?.message).toMatch(/; total ~\$\d+\.\d{2}$/)
    expect(existsSync(run)).toBe(false)
    expect(fetchCalls).toBe(0)
  })

  test('--panel-count reserves exactly one retry and prices the contracted panel count', async () => {
    const { scriptPath, run } = await setup()
    await prepare(scriptPath)
    const before = await pairBytes(run)
    const events = await priceEvents({ only: 'scene', panelCount: 4 }, scriptPath)
    expect(find(events, 'Comic - Price Estimate: draft-scenes scene stage')?.metadata).toMatchObject({
      stage: 'draft-scenes:scene', maximumCalls: 2, panelCountRetryCalls: 1, panelEstimate: 4, panelCount: 4,
      outputUnitsPerCall: SCENE_DRAFT_OUTPUT_UNITS_FIXED + SCENE_DRAFT_OUTPUT_UNITS_PER_PANEL * 4,
    })
    expect(find(events, 'Scene estimate: input units')?.message).toContain('maximum calls 2 including one panel-count retry')
    expect(await pairBytes(run)).toEqual(before)
    expect(fetchCalls).toBe(0)
  })

  test('--only scene --price on a stale pair reports the prepare hint instead of an estimate', async () => {
    const { scriptPath } = await setup()
    await prepare(scriptPath)
    await writeFile(getDraftPromptPath(SCENE_SLUG), `${readFileText(getDraftPromptPath(SCENE_SLUG))}\n${LEGACY_BLOCKING_PLAN_SECTION}\n`)
    const events = await priceEvents({ only: 'scene' }, scriptPath)
    const notice = find(events, 'Comic - Price Estimate: draft-scenes scene stage')
    expect(notice?.message).toContain('retired blocking plan section')
    expect(notice?.message).toContain('--only prepare')
    expect(find(events, 'Scene estimate: input units')).toBeUndefined()
  })
})
