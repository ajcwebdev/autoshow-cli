import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { TreatmentDraftRequest, TreatmentDraftValidationContext } from '~/types'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { draftTreatmentCommand, resolveNextEpisodeNumber, resolveTreatmentScriptTarget } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/draft-treatment-command'
import { SCENE_DRAFT_RETRY_HEADER } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/scene-draft-defaults'
import { buildTreatmentJsonSchema, countVoiceSwitches, maxVoiceSwitchesFor, TreatmentDraftSchema, validateTreatmentDraft } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-schemas'
import { buildTreatmentDraftPrompt } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-llm-prompt'
import { captureLogEvents } from '../../../../test-utils/console-capture'
import { buildTreatmentFixtureDraft, makeTreatmentProjectRoot } from './comic-treatment-contract-fixtures'

const temporaryRoots: string[] = []
afterEach(async () => {
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const context = (overrides: Partial<TreatmentDraftValidationContext> = {}): TreatmentDraftValidationContext => ({
  panelRange: { minimum: 3, maximum: 3 },
  voicePacing: 'exclusive',
  speakers: ['ranger-ruth'],
  catalogPolicy: 'skip-existing',
  existingCharacters: { schemaVersion: 3, characters: [], groupAliases: [] },
  existingLocations: undefined,
  ...overrides,
})

describe('comic treatment draft validation contracts', () => {
  test('a valid fixture draft passes the schema and the validator', () => {
    const draft = buildTreatmentFixtureDraft()
    expect(TreatmentDraftSchema).toBeDefined()
    expect(validateTreatmentDraft(draft, context())).toEqual([])
    const schema = buildTreatmentJsonSchema()
    expect(schema.name).toBe('treatment_draft_v1')
    expect(schema.schema.required).toEqual(['schemaVersion', 'title', 'sceneTitle', 'styleInstructions', 'characters', 'locations', 'panels'])
  })

  test('the validator names every structural problem the retry must fix', () => {
    const base = buildTreatmentFixtureDraft()
    const broken = buildTreatmentFixtureDraft({
      panels: [
        { ...base.panels[0]!, number: 2, narration: 'EXT. NOWHERE - DAY starts wrong', dialogue: [{ characterKey: 'milo', line: 'I am not allowed to speak.' }, { characterKey: 'ghost', line: '' }] },
        { ...base.panels[1]!, number: 2, locationKey: 'nowhere', narration: null, dialogue: [] },
      ],
      locations: [
        { ...base.locations[0]! },
        { ...base.locations[1]!, slugline: 'EXT. OLD SILVER MINE - 1850S - DAY' },
        { ...base.locations[0]!, name: ' ', specification: ' ' },
      ],
      characters: [
        { ...base.characters[0]! },
        { ...base.characters[1]!, key: 'ranger-ruth' },
        { ...base.characters[1]!, key: 'ruth', name: 'RANGER RUTH', wardrobe: { colorTokens: [' '], never: [] } },
      ],
    })
    const issues = validateTreatmentDraft(broken, context({ speakers: ['ranger-ruth', 'nobody'] }))
    expect(issues).toEqual(expect.arrayContaining([
      'panels: expected exactly 3 panels, received 2',
      'panels[0]: number must be 1, received 2',
      'panels[0]: narration must not begin with INT., EXT., a bracket, or an asterisk',
      'panels[0].dialogue[0]: characterKey "milo" is not an allowed speaker (ranger-ruth, nobody); fold the quote into narration',
      'panels[0].dialogue[1]: line must not be blank',
      'panels[1]: needs narration or at least one dialogue line',
      'panels[1]: locationKey "nowhere" is not one of the defined locations',
      'characters[1] (ranger-ruth): duplicate character key',
      'characters[2] (ruth): display name "RANGER RUTH" collides with "ranger-ruth"; names must identify exactly one character',
      'characters[2] (ruth): wardrobe.colorTokens needs at least one non-blank token',
      'locations[2] (ridge-firepit): duplicate location key',
      'locations[2] (ridge-firepit): name must not be blank',
      'locations[2] (ridge-firepit): specification must not be blank',
      '--speaker nobody is not defined in characters and does not exist in the character catalog',
    ]))
    expect(issues.find(issue => issue.startsWith('locations[1] (old-silver-mine): slugline'))).toContain('must read like "EXT. PLACE - NIGHT"')
  })

  test('the fail policy reports existing keys and colliding aliases while skip-existing leaves them to the merge', () => {
    const draft = buildTreatmentFixtureDraft()
    const existing = context({
      existingCharacters: { schemaVersion: 3, characters: [{ key: 'milo', name: 'MILO', aliases: ['the ranger'], image: 'milo--outline-sheet.png', outlineSheet: 'milo--outline-sheet.png', description: 'x' }], groupAliases: [] },
      existingLocations: { schemaVersion: 1, styleImage: 'style.png', locations: [{ key: 'ridge-firepit', name: 'Ridge Firepit', aliases: ['EXT. RIDGE FIREPIT - NIGHT'], specification: 'x', sourceScripts: [] }] },
    })
    expect(validateTreatmentDraft(draft, existing)).toEqual([])
    expect(validateTreatmentDraft(draft, { ...existing, catalogPolicy: 'fail' })).toEqual([
      'characters[0] (ranger-ruth): alias "the ranger" collides with "milo"',
      'characters[1] (milo): key already exists in the character catalog; choose a new key or rerun with --catalog-policy skip-existing',
      'locations[0] (ridge-firepit): key already exists in the location catalog; choose a new key or rerun with --catalog-policy skip-existing',
    ])
  })

  test('exclusive voice pacing rejects mixed-voice panels and too many voice changes, while mixed pacing allows them', () => {
    const base = buildTreatmentFixtureDraft()
    const ruth = base.characters[0]!.key
    const narrationPanel = (number: number) => ({ ...base.panels[0]!, number, locationKey: 'ridge-firepit', narration: `Narration beat ${number}.`, dialogue: [] })
    const speechPanel = (number: number) => ({ ...base.panels[0]!, number, locationKey: 'ridge-firepit', narration: null, dialogue: [{ characterKey: ruth, line: `Line ${number}.` }] })
    const alternating = buildTreatmentFixtureDraft({ panels: [narrationPanel(1), speechPanel(2), narrationPanel(3), speechPanel(4), narrationPanel(5), speechPanel(6)] })
    expect(countVoiceSwitches(alternating.panels)).toBe(5)
    expect(maxVoiceSwitchesFor(6)).toBe(2)
    expect(maxVoiceSwitchesFor(25)).toBe(8)
    const exclusiveIssues = validateTreatmentDraft(alternating, context({ panelRange: { minimum: 6, maximum: 6 } }))
    expect(exclusiveIssues).toEqual(['panels: the voice changes 5 times across 6 panels; keep it to at most 2 by grouping consecutive panels into longer narration and speech runs'])
    expect(validateTreatmentDraft(alternating, context({ panelRange: { minimum: 6, maximum: 6 }, voicePacing: 'mixed' }))).toEqual([])
    const both = buildTreatmentFixtureDraft({ panels: [{ ...speechPanel(1), narration: 'Narration and speech together.' }, narrationPanel(2), narrationPanel(3)] })
    expect(validateTreatmentDraft(both, context())).toEqual(['panels[0]: carries both narration and dialogue; give each panel one voice and move the narration to its own bridging panel'])
    expect(validateTreatmentDraft(both, context({ voicePacing: 'mixed' }))).toEqual([])
    const grouped = buildTreatmentFixtureDraft({ panels: [narrationPanel(1), speechPanel(2), speechPanel(3), speechPanel(4), narrationPanel(5)] })
    expect(validateTreatmentDraft(grouped, context({ panelRange: { minimum: 4, maximum: 6 } }))).toEqual([])
    expect(validateTreatmentDraft(grouped, context({ panelRange: { minimum: 6, maximum: 8 } }))).toEqual(['panels: expected between 6 and 8 panels, received 5'])
  })

  test('the prompt carries the panel count, speaker rule, existing keys, and the treatment text', async () => {
    const project = await makeTreatmentProjectRoot()
    temporaryRoots.push(project.root)
    const prompt = buildTreatmentDraftPrompt({
      source: { path: project.treatmentPath, kind: 'markdown', text: 'Once upon a ridge.', title: 'Lantern Ridge', defaultSlug: 'lantern-ridge', pageCount: 1 },
      panelRange: { minimum: 3, maximum: 3 },
      voicePacing: 'exclusive',
      speakers: ['ranger-ruth'],
      existingCharacterKeys: ['ada'],
      existingLocationKeys: [],
    })
    expect(prompt).toContain('exactly 3 comic panels')
    expect(prompt).toContain('Every panel carries exactly one voice')
    expect(prompt).toContain('at most 2')
    const ranged = buildTreatmentDraftPrompt({ source: { path: 'x', kind: 'text', text: 't', title: 't', defaultSlug: 't', pageCount: 1 }, panelRange: { minimum: 20, maximum: 25 }, voicePacing: 'mixed', speakers: [], existingCharacterKeys: [], existingLocationKeys: [] })
    expect(ranged).toContain('between 20 and 25 comic panels')
    expect(ranged).not.toContain('Every panel carries exactly one voice')
    expect(prompt).toContain('Only these character keys may carry dialogue: ranger-ruth')
    expect(prompt).toContain('Character keys that already exist in the catalog: ada')
    expect(prompt).toContain('```text\nOnce upon a ridge.\n```')
    expect(buildTreatmentDraftPrompt({ source: { path: 'x', kind: 'text', text: 't', title: 't', defaultSlug: 't', pageCount: 1 }, panelRange: { minimum: 1, maximum: 1 }, voicePacing: 'exclusive', speakers: [], existingCharacterKeys: [], existingLocationKeys: [] })).toContain('No character may carry dialogue')
  })

  test('draft-treatment retries once with validator issues, then writes the script, catalogs, and run artifacts', async () => {
    const project = await makeTreatmentProjectRoot()
    temporaryRoots.push(project.root)
    configureCharactersRoot(project.charactersRoot)
    configureOutputRoot(project.outputRoot)
    const requests: TreatmentDraftRequest[] = []
    const valid = buildTreatmentFixtureDraft()
    const { result } = await captureLogEvents(async () => await draftTreatmentCommand({
      treatmentPath: project.treatmentPath,
      panelRange: { minimum: 3, maximum: 3 },
      voicePacing: 'exclusive',
      episode: '02',
      scene: '01',
      speakers: ['ranger-ruth'],
      catalogPolicy: 'skip-existing',
      scriptsRoot: project.scriptsRoot,
      requestDraft: async (request) => {
        requests.push(request)
        const draft = request.attempt === 1 ? buildTreatmentFixtureDraft({ panels: valid.panels.slice(0, 2) }) : valid
        return { text: `\`\`\`json\n${JSON.stringify(draft)}\n\`\`\``, inputTokens: 100, outputTokens: 200 }
      },
    }))
    expect(requests).toHaveLength(2)
    expect(requests[0]?.prompt).not.toContain(SCENE_DRAFT_RETRY_HEADER)
    expect(requests[1]?.prompt).toContain(SCENE_DRAFT_RETRY_HEADER)
    expect(requests[1]?.prompt).toContain('panels: expected exactly 3 panels, received 2')
    expect(requests[1]?.schemaName).toBe('treatment_draft_v1')
    expect(result.attempts).toBe(2)
    expect(result.panelCount).toBe(3)
    expect(result.voiceSwitches).toBe(1)
    expect(result.shorthand).toBe('02-01')
    expect(result.scriptPath).toBe(join(project.scriptsRoot, '02-script', '01-lantern-ridge.md'))
    expect(await Bun.file(result.scriptPath).text()).toContain('**NARRATION**')
    expect(result.report.charactersAdded).toEqual(['ranger-ruth', 'milo'])
    expect(result.report.locationsAdded).toEqual(['ridge-firepit', 'old-silver-mine'])
    expect(result.report.styleImage).toEqual({ action: 'created', value: '../characters/lantern-ridge--style-seed.png' })
    expect(result.structuredScript.beats.filter(beat => beat.type === 'panel-note')).toHaveLength(3)
    const characters = JSON.parse(await Bun.file(join(project.charactersRoot, 'characters-reference.json')).text())
    expect(characters.characters.map((character: { key: string }) => character.key)).toEqual(['ranger-ruth', 'milo'])
    const locations = JSON.parse(await Bun.file(join(project.locationsRoot, 'locations-reference.json')).text())
    expect(locations.locations.map((location: { key: string }) => location.key)).toEqual(['old-silver-mine', 'ridge-firepit'])
    const artifacts = (await readdir(join(result.runDirectory, 'metadata', 'treatment'))).sort()
    expect(artifacts).toEqual(['merge-report.json', 'merge-report.md', 'prompt.md', 'response-attempt-1.json', 'response-attempt-2.json', 'script.md', 'source.md', 'source.txt', 'structured-script.preview.json', 'treatment.json'])
    expect(await Bun.file(join(result.runDirectory, 'metadata', 'treatment', 'merge-report.md')).text()).toContain('bun autoshow comic reference-sketch --character ranger-ruth')
    await expect(draftTreatmentCommand({ treatmentPath: project.treatmentPath, panelRange: { minimum: 3, maximum: 3 }, voicePacing: 'exclusive', episode: '02', scene: '01', speakers: [], catalogPolicy: 'skip-existing', scriptsRoot: project.scriptsRoot, requestDraft: async () => ({ text: '{}' }) })).rejects.toThrow('already exists. Pass --force')
  })

  test('two failed attempts persist the invalid candidate and leave the catalogs and scripts untouched', async () => {
    const project = await makeTreatmentProjectRoot()
    temporaryRoots.push(project.root)
    configureCharactersRoot(project.charactersRoot)
    configureOutputRoot(project.outputRoot)
    await expect(captureLogEvents(async () => await draftTreatmentCommand({
      treatmentPath: project.treatmentPath,
      panelRange: { minimum: 3, maximum: 3 },
      voicePacing: 'exclusive',
      episode: '02',
      scene: '01',
      speakers: ['ranger-ruth'],
      catalogPolicy: 'skip-existing',
      scriptsRoot: project.scriptsRoot,
      requestDraft: async () => ({ text: JSON.stringify(buildTreatmentFixtureDraft({ panels: [] })) }),
    }))).rejects.toThrow('failed validation after 2 attempts')
    expect(existsSync(join(project.charactersRoot, 'characters-reference.json'))).toBe(false)
    expect(existsSync(join(project.locationsRoot, 'locations-reference.json'))).toBe(false)
    expect(existsSync(join(project.scriptsRoot, '02-script'))).toBe(false)
    const runs = await readdir(project.outputRoot)
    expect(runs).toHaveLength(1)
    const invalid = JSON.parse(await Bun.file(join(project.outputRoot, runs[0]!, 'metadata', 'treatment', 'treatment.invalid.json')).text())
    expect(invalid.attempt).toBe(2)
    expect(invalid.issues).toContain('panels: expected exactly 3 panels, received 0')
  })

  test('a missing style seed is a usage error before any provider request', async () => {
    const project = await makeTreatmentProjectRoot({ styleSeed: false })
    temporaryRoots.push(project.root)
    configureCharactersRoot(project.charactersRoot)
    configureOutputRoot(project.outputRoot)
    let requested = false
    await expect(draftTreatmentCommand({ treatmentPath: project.treatmentPath, panelRange: { minimum: 3, maximum: 3 }, voicePacing: 'exclusive', scene: '01', speakers: [], catalogPolicy: 'skip-existing', scriptsRoot: project.scriptsRoot, requestDraft: async () => { requested = true; return { text: '{}' } } })).rejects.toThrow('Style seed image not found')
    expect(requested).toBe(false)
  })

  test('episode numbering and shorthand ambiguity are resolved from the scripts root', async () => {
    const project = await makeTreatmentProjectRoot()
    temporaryRoots.push(project.root)
    expect(await resolveNextEpisodeNumber(project.scriptsRoot)).toBe('01')
    await Bun.write(join(project.scriptsRoot, '03-script', '01-other.md'), '# x\n')
    expect(await resolveNextEpisodeNumber(project.scriptsRoot)).toBe('04')
    await expect(resolveTreatmentScriptTarget({ episode: '03', scene: '01', slug: 'lantern-ridge', force: false, scriptsRoot: project.scriptsRoot })).rejects.toThrow('the 03-01 shorthand would be ambiguous')
    expect(await resolveTreatmentScriptTarget({ episode: '03', scene: '02', slug: 'lantern-ridge', force: false, scriptsRoot: project.scriptsRoot })).toEqual({ scriptPath: join(project.scriptsRoot, '03-script', '02-lantern-ridge.md'), shorthand: '03-02' })
  })
})
