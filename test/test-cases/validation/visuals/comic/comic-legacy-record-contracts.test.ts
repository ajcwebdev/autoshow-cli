import { afterEach, describe, expect, test } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import { loadCharacterCatalog } from '~/cli/commands/visuals/comic/comic-utils/character-reference-config'
import { parseJsonFile } from '~/cli/commands/visuals/comic/comic-utils/json-prompt-utils'
import { loadPromptsConfig } from '~/cli/commands/visuals/comic/comic-utils/scene-utils'
import { PanelBundleDataSchema, PromptsConfigSchema, ScenePromptDataSchema, stripRetiredPlanFields, StructuredScriptDataSchema } from '~/cli/commands/visuals/comic/schemas/schemas'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
const fixtureRoot = 'test/test-cases/validation/visuals/comic/fixtures/structured-script-parser'
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const tempDir = async (prefix: string) => {
  const directory = await makeTempDir(prefix)
  temporaryDirectories.push(directory)
  return directory
}

// Shapes recorded by the retired blocking workflow before its removal.
const LEGACY_STAGING = {
  blocking: [{ lineIndex: 8, afterSegmentId: null, state: 'meeting-open', location: 'cargo-bay', text: 'The captain stands at the loading door.' }],
  camera: [{ lineIndex: 18, afterSegmentId: 'beat-0002', panel: 'next', text: 'Low and wide from behind the crew.' }],
  axisBreaks: [{ lineIndex: 26, afterSegmentId: 'beat-0003', panel: 2, text: 'Cross the line.' }],
  costume: [{ lineIndex: 30, afterSegmentId: 'beat-0003', character: 'pilot', text: 'Flight jacket torn.' }],
  extras: [{ lineIndex: 36, afterSegmentId: 'beat-0004', group: 'villagers', count: 12, exclude: ['children'], text: 'Mixed ages.' }],
  skipPanels: { lineIndex: 42, reason: 'previously-on recap' },
}
const LEGACY_PANEL_BLOCKING = { stageStateId: 'meeting-open', cameraSetupId: 'wide-from-airlock', croppedOnStage: [], axisBreak: null }
const LEGACY_COMPILED_BLOCKING = { planSha256: 'b'.repeat(64), stageStateId: 'meeting-open', cameraSetupId: 'wide-from-airlock', ledger: [], croppedOnStage: [], offFrameRoster: [], extrasInFrame: [], lines: { camera: 'Camera wide.', ledger: [], offFrame: '' } }

const scenePanel = (number: number) => ({
  number,
  description: `Panel ${number} description.`,
  shotPlan: `Panel ${number} shot plan.`,
  characterKeys: ['captain'],
  speech: [{ speaker: { kind: 'character', characterKey: 'captain', offscreen: false }, line: `Line ${number}.` }],
  sourceSegmentIds: [`beat-000${number}`],
  locationKey: 'cargo-bay',
  designReferences: [],
})
const planFreeScene = () => ({ schemaVersion: 4, title: 'Probe', location: 'INT. CARGO BAY - NIGHT', panels: [scenePanel(1), scenePanel(2)] })
const legacyScene = () => {
  const scene = planFreeScene()
  return { ...scene, blockingPlanSha256: 'a'.repeat(64), panels: scene.panels.map(panel => ({ ...panel, blocking: LEGACY_PANEL_BLOCKING })) }
}
const bundlePanel = () => ({
  number: 1,
  description: 'Panel 1 description.',
  shotPlan: 'Panel 1 shot plan.',
  characterKeys: ['captain'],
  speech: [],
  sourceSegmentIds: ['beat-0001'],
  sourceSegments: [{ id: 'beat-0001', type: 'direction', text: 'The crew gathers.', beatIndex: 1, sourceSpans: [], location: { key: 'cargo-bay', raw: 'INT. CARGO BAY - NIGHT', type: 'INT', place: 'CARGO BAY - NIGHT' } }],
  locationKey: 'cargo-bay',
  locationSnapshotId: 'loc-snapshot',
})
const planFreeBundle = () => ({ schemaVersion: 4, snapshotId: 'snap', title: 'Probe', location: 'INT. CARGO BAY - NIGHT', panels: [bundlePanel()] })
const legacyBundle = () => ({ ...planFreeBundle(), panels: [{ ...bundlePanel(), blocking: LEGACY_PANEL_BLOCKING }], blocking: LEGACY_COMPILED_BLOCKING, planSha256: 'b'.repeat(64) })

const readPlanFreeStructure = async (): Promise<Record<string, unknown>> => JSON.parse(await Bun.file(join(fixtureRoot, 'handler-precedence.expected.json')).text())

describe('legacy plan-bearing records', () => {
  test('a structure v5 record with staging parses with staging stripped and the input object untouched', async () => {
    const planFree = await readPlanFreeStructure()
    const legacy = { ...structuredClone(planFree), staging: LEGACY_STAGING }
    const snapshot = structuredClone(legacy)
    const parsed = v.parse(StructuredScriptDataSchema, legacy)
    expect(parsed).not.toHaveProperty('staging')
    expect(parsed).toEqual(v.parse(StructuredScriptDataSchema, planFree))
    expect(legacy).toEqual(snapshot)
  })

  test('a scene v4 record with a plan hash and panel citations keeps text, cast, speech, numbering and source citations', () => {
    const legacy = legacyScene()
    const snapshot = structuredClone(legacy)
    const parsed = v.parse(ScenePromptDataSchema, legacy)
    expect(parsed).not.toHaveProperty('blockingPlanSha256')
    for (const panel of parsed.panels) expect(panel).not.toHaveProperty('blocking')
    expect(parsed).toEqual(v.parse(ScenePromptDataSchema, planFreeScene()))
    expect(parsed.panels.map(panel => [panel.number, panel.description, panel.characterKeys, panel.speech.map(item => item.line), panel.sourceSegmentIds])).toEqual([
      [1, 'Panel 1 description.', ['captain'], ['Line 1.'], ['beat-0001']],
      [2, 'Panel 2 description.', ['captain'], ['Line 2.'], ['beat-0002']],
    ])
    expect(legacy).toEqual(snapshot)
  })

  test('a bundle v4 record with compiled blocking and a plan hash parses as the plan-free bundle', () => {
    const legacy = legacyBundle()
    const snapshot = structuredClone(legacy)
    const parsed = v.parse(PanelBundleDataSchema, legacy)
    expect(parsed).not.toHaveProperty('blocking')
    expect(parsed).not.toHaveProperty('planSha256')
    expect(parsed.panels[0]).not.toHaveProperty('blocking')
    expect(parsed).toEqual(v.parse(PanelBundleDataSchema, planFreeBundle()))
    expect(legacy).toEqual(snapshot)
  })

  test('stripping returns plan-free records by identity and only drops fields of the matching kind', () => {
    const scene = planFreeScene()
    expect(stripRetiredPlanFields('scene', scene)).toBe(scene)
    // staging is a structure field, not a scene field: a scene carrying it is still rejected.
    expect(v.safeParse(ScenePromptDataSchema, { ...planFreeScene(), staging: LEGACY_STAGING }).success).toBe(false)
    expect(v.safeParse(StructuredScriptDataSchema, { ...legacyScene(), schemaVersion: 5 }).success).toBe(false)
  })

  test('unknown fields are still rejected at record and panel level', async () => {
    const planFree = await readPlanFreeStructure()
    expect(v.safeParse(StructuredScriptDataSchema, { ...planFree, staging: LEGACY_STAGING, bogus: true }).success).toBe(false)
    expect(v.safeParse(ScenePromptDataSchema, { ...legacyScene(), bogus: true }).success).toBe(false)
    expect(v.safeParse(ScenePromptDataSchema, { ...planFreeScene(), panels: [{ ...scenePanel(1), cameraSetupId: 'wide' }] }).success).toBe(false)
    expect(v.safeParse(PanelBundleDataSchema, { ...legacyBundle(), compiledLedger: [] }).success).toBe(false)
    expect(v.safeParse(PanelBundleDataSchema, { ...planFreeBundle(), panels: [{ ...bundlePanel(), planSha256: 'c'.repeat(64) }] }).success).toBe(false)
    expect(v.safeParse(ScenePromptDataSchema, { ...legacyScene(), schemaVersion: 3 }).success).toBe(false)
  })

  test('reading plan-bearing records from disk leaves every file byte-identical', async () => {
    const directory = await tempDir('autoshow-legacy-records-')
    const planFreeStructure = await readPlanFreeStructure()
    const records = [
      { path: join(directory, 'structured-script.json'), value: { ...planFreeStructure, staging: LEGACY_STAGING }, schema: StructuredScriptDataSchema },
      { path: join(directory, 'scene.json'), value: legacyScene(), schema: ScenePromptDataSchema },
      { path: join(directory, 'panel-01.bundle.json'), value: legacyBundle(), schema: PanelBundleDataSchema },
    ] as const
    for (const record of records) {
      await writeFile(record.path, `${JSON.stringify(record.value, null, 2)}\n`)
      const before = await Bun.file(record.path).bytes()
      const parsed = await parseJsonFile(record.path, record.schema) as Record<string, unknown>
      for (const field of ['staging', 'blockingPlanSha256', 'blocking', 'planSha256']) expect(parsed).not.toHaveProperty(field)
      expect(await Bun.file(record.path).bytes()).toEqual(before)
    }
  })
})

describe('legacy authored catalog fields', () => {
  const makeCatalog = async (characters: unknown[]) => {
    const root = await tempDir('autoshow-legacy-catalog-')
    await writeFile(join(root, 'hero.png'), TINY_PNG)
    await writeFile(join(root, 'sidekick.png'), TINY_PNG)
    await writeFile(join(root, 'characters-reference.json'), JSON.stringify({ schemaVersion: 3, characters, groupAliases: [] }))
    return root
  }
  const hero = (extra: Record<string, unknown> = {}) => ({ key: 'hero', name: 'Hero', aliases: ['HERO'], image: 'hero.png', outlineSheet: 'hero.png', description: 'Hero.', ...extra })
  const sidekick = (extra: Record<string, unknown> = {}) => ({ key: 'sidekick', name: 'Sidekick', aliases: ['SIDEKICK'], image: 'sidekick.png', outlineSheet: 'sidekick.png', description: 'Sidekick.', ...extra })
  const variantWarnings = (events: Array<{ level: string; message: string }>) => events.filter(event => event.level === 'warn' && event.message.includes('variantOf'))

  test('a catalog with variantOf loads, ignores the field and warns once per catalog path', async () => {
    const root = await makeCatalog([hero({ variantOf: 'sidekick' }), sidekick({ variantOf: 'ghost-key-no-longer-validated' })])
    const configPath = join(root, 'characters-reference.json')
    const before = await Bun.file(configPath).text()
    const first = await captureLogEvents(() => loadCharacterCatalog(root, { fresh: true }))
    const warnings = variantWarnings(first.events)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.message).toContain('sets variantOf for hero, sidekick; variantOf is no longer read and can be removed')
    expect(first.result.characterKeys).toEqual(['hero', 'sidekick'])
    expect(first.result.get(first.result.requireKey('hero'))).not.toHaveProperty('variantOf')
    const second = await captureLogEvents(() => loadCharacterCatalog(root, { fresh: true }))
    expect(variantWarnings(second.events)).toEqual([])
    expect(await Bun.file(configPath).text()).toBe(before)
  })

  test('a catalog without variantOf loads silently', async () => {
    const root = await makeCatalog([hero(), sidekick()])
    const { events } = await captureLogEvents(() => loadCharacterCatalog(root, { fresh: true }))
    expect(variantWarnings(events)).toEqual([])
  })

  test('a catalog with distinguishFrom loads, ignores the field without validating it and warns once per catalog path', async () => {
    const root = await makeCatalog([hero({ distinguishFrom: [{ characterKey: 'ghost-key-no-longer-validated', cue: '  ' }] }), sidekick({ distinguishFrom: [{ characterKey: 'hero', cue: 'Sidekick is shorter.' }] })])
    const configPath = join(root, 'characters-reference.json')
    const before = await Bun.file(configPath).text()
    const distinguishWarnings = (events: Array<{ level: string; message: string }>) => events.filter(event => event.level === 'warn' && event.message.includes('distinguishFrom'))
    const first = await captureLogEvents(() => loadCharacterCatalog(root, { fresh: true }))
    expect(distinguishWarnings(first.events)).toHaveLength(1)
    expect(distinguishWarnings(first.events)[0]!.message).toContain('sets distinguishFrom for hero, sidekick; distinguishFrom is no longer read and can be removed')
    expect(first.result.get(first.result.requireKey('hero'))).not.toHaveProperty('distinguishFrom')
    expect(first.result.get(first.result.requireKey('sidekick'))).not.toHaveProperty('distinguishFrom')
    const second = await captureLogEvents(() => loadCharacterCatalog(root, { fresh: true }))
    expect(distinguishWarnings(second.events)).toEqual([])
    expect(await Bun.file(configPath).text()).toBe(before)
  })

  test('retired catalog fields do not suppress the remaining catalog validation', async () => {
    const load = async (characters: unknown[]) => await captureLogEvents(async () => loadCharacterCatalog(await makeCatalog(characters), { fresh: true }))
    await expect(load([hero({ variantOf: 'sidekick', distinguishFrom: [], unknownField: true }), sidekick()])).rejects.toThrow(/Invalid key|unknown key/i)
    await expect(load([hero({ variantOf: 'sidekick', wardrobe: { colorTokens: [' '] } }), sidekick()])).rejects.toThrow('Character "hero" wardrobe colorTokens[0] must not be blank')
  })
})

describe('prompt configuration without retired variations', () => {
  const basePrompts = () => ({
    'Scene Prompts': { Prefix: 'Create one comic panel.', '1st Panel': 'First panel.' },
    'Sketch Prompts': { Chunk: 'Sketch chunk.' },
    'Character Sketch Prompts': { Character: 'Character.', Front: 'Front.', 'Three-Quarter': 'Three quarter.', Profile: 'Profile.' },
  })

  test('accepts a configuration without Image Prompt Variations and drops a legacy section', () => {
    expect(v.safeParse(PromptsConfigSchema, basePrompts()).success).toBe(true)
    const legacy = v.parse(PromptsConfigSchema, { ...basePrompts(), 'Image Prompt Variations': { canonical: '', 'cinematic-depth': 'Cinematic depth.' } })
    expect(legacy).not.toHaveProperty('Image Prompt Variations')
    expect(v.safeParse(PromptsConfigSchema, { ...basePrompts(), 'Scene Prompts': { Prefix: 'x' } }).success).toBe(false)
  })

  test('the shipped prompts.json validates and carries no variation section', async () => {
    const raw = JSON.parse(await Bun.file('src/cli/commands/visuals/comic/comic-prompts/prompts.json').text()) as Record<string, unknown>
    expect(raw).not.toHaveProperty('Image Prompt Variations')
    expect(v.safeParse(PromptsConfigSchema, raw).success).toBe(true)
    const loaded = await loadPromptsConfig()
    expect(Object.keys(loaded).sort()).toEqual(['Character Sketch Prompts', 'Scene Prompts', 'Sketch Prompts'])
  })
})
