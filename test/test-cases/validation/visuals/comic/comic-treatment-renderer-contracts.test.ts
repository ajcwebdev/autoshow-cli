import { describe, expect, test } from 'bun:test'
import { buildCharacterCatalogIndex } from '~/cli/commands/visuals/comic/comic-utils/character-catalog-index'
import { createCharacterCatalogService } from '~/cli/commands/visuals/comic/comic-utils/character-catalog-service'
import { mergeTreatmentCharacterCatalog, mergeTreatmentLocationCatalog } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-catalog-merge'
import { renderTreatmentScript, sanitizePanelNote, sanitizeSpokenText, selfCheckRenderedScript } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-script-renderer'
import { canonicalSlugline } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-schemas'
import { deriveTreatmentSlug, loadTreatmentSource } from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-source-loader'
import { buildTreatmentFixtureDraft, makeTreatmentProjectRoot } from './comic-treatment-contract-fixtures'

const draft = buildTreatmentFixtureDraft()

const renderFixture = () => {
  const characterMerge = mergeTreatmentCharacterCatalog({
    existing: { schemaVersion: 3, characters: [], groupAliases: [] },
    candidates: draft.characters,
    styleSeed: 'lantern-ridge--style-seed.png',
    styleInstructions: draft.styleInstructions,
    policy: 'skip-existing',
  })
  const locationMerge = mergeTreatmentLocationCatalog({
    existing: undefined,
    candidates: draft.locations,
    scriptPath: 'input/scripts/02-script/01-lantern-ridge.md',
    styleInstructions: draft.styleInstructions,
    styleSeed: 'lantern-ridge--style-seed.png',
    locationsRoot: '/tmp/does-not-matter/locations',
    policy: 'skip-existing',
  })
  const rendered = renderTreatmentScript({
    draft,
    episode: '02',
    sourceDisplayPath: 'input/lantern-ridge.md',
    characterNames: new Map(characterMerge.next.characters.map(character => [character.key, character.name])),
    locationSluglines: new Map(draft.locations.map(location => [location.key, canonicalSlugline(location.slugline)])),
  })
  return { rendered, characterMerge, locationMerge }
}

describe('comic treatment renderer contracts', () => {
  test('renders the parser shape with sluglines on location changes and sanitized spoken text', () => {
    const { rendered } = renderFixture()
    expect(rendered.startsWith('# Episode 02: Lantern Ridge\n\n**Treatment: input/lantern-ridge.md**\n\n---\n\n## Scene 1: The Legend of Lantern Ridge\n\n**EXT. RIDGE FIREPIT - NIGHT**\n\n[Panel 1: ')).toBe(true)
    expect(rendered).toContain('[Panel 2: Miners haul carts from the mine mouth in the flashback.]')
    expect(rendered).toContain('**NARRATION**\nThe ranger leans toward the flames and begins the story of the ridge.\n')
    expect(rendered).toContain('**RANGER RUTH**\nThis ridge was once a silver camp.\n')
    const firepit = [...rendered.matchAll(/\*\*EXT\. RIDGE FIREPIT - NIGHT\*\*/g)].length
    const mine = [...rendered.matchAll(/\*\*EXT\. OLD SILVER MINE - DAY\*\*/g)].length
    expect(firepit).toBe(2)
    expect(mine).toBe(1)
    expect(rendered.indexOf('**EXT. OLD SILVER MINE - DAY**')).toBeLessThan(rendered.indexOf('[Panel 2:'))
    expect(rendered.lastIndexOf('**EXT. RIDGE FIREPIT - NIGHT**')).toBeLessThan(rendered.indexOf('[Panel 3:'))
    expect(rendered.endsWith('And that is why we never dig here.\n')).toBe(true)
    expect(rendered).not.toContain('NARRATOR')
  })

  test('sanitization strips wrapping quotes, parentheticals, and brackets and rejects slugline-shaped lines', () => {
    expect(sanitizeSpokenText('  "(softly) we camp here."  ', 'line')).toBe('We camp here.')
    expect(sanitizeSpokenText('*hello* there', 'line')).toBe('Hello* there')
    expect(sanitizePanelNote('Miners [haul] carts')).toBe('Miners haul carts')
    expect(() => sanitizeSpokenText('EXT. RIDGE - NIGHT', 'line')).toThrow('must not begin with a slugline')
    expect(() => sanitizeSpokenText('""', 'line')).toThrow('empty after sanitization')
  })

  test('the rendered script parses into panel notes, narration beats, resolved dialogue, and location transitions', () => {
    const { rendered, characterMerge, locationMerge } = renderFixture()
    const configPath = '/tmp/does-not-matter/characters/characters-reference.json'
    const index = buildCharacterCatalogIndex('/tmp/does-not-matter/characters', configPath, characterMerge.next, { verifyAssets: false })
    const characterCatalog = createCharacterCatalogService('/tmp/does-not-matter/characters', configPath, JSON.stringify(characterMerge.next), index)
    const structured = selfCheckRenderedScript({
      rendered,
      scriptPath: 'input/scripts/02-script/01-lantern-ridge.md',
      characterCatalog,
      locationCatalog: locationMerge.next,
      panelCount: 3,
    })
    const panelNotes = structured.beats.filter(beat => beat.type === 'panel-note')
    expect(panelNotes.map(beat => beat.location.key)).toEqual(['ridge-firepit', 'old-silver-mine', 'ridge-firepit'])
    expect(panelNotes[0]?.characterKeys).toEqual(['ranger-ruth', 'milo'])
    const narration = structured.beats.filter(beat => beat.type === 'narration')
    expect(narration).toHaveLength(1)
    expect(narration.every(beat => beat.speakerLabel === 'NARRATION')).toBe(true)
    const dialogue = structured.beats.filter(beat => beat.type === 'dialogue')
    expect(dialogue.map(beat => beat.speakerKey)).toEqual(['ranger-ruth', 'ranger-ruth'])
    expect(dialogue[0]?.text).toBe('This ridge was once a silver camp.')
    expect(structured.beats.filter(beat => beat.type === 'transition').map(beat => beat.location.key)).toEqual(['old-silver-mine', 'ridge-firepit'])
    expect(structured.scene.location.key).toBe('ridge-firepit')
    expect(structured.sourceSegments.filter(segment => segment.type === 'panel-note')).toHaveLength(3)
    expect(() => selfCheckRenderedScript({ rendered, scriptPath: 'x.md', characterCatalog, locationCatalog: locationMerge.next, panelCount: 4 })).toThrow('expected 4')
  })

  test('the treatment source loader reads page-marked markdown and derives the slug from the title', async () => {
    const project = await makeTreatmentProjectRoot()
    const source = await loadTreatmentSource(project.treatmentPath)
    expect(source.kind).toBe('markdown')
    expect(source.title).toBe('Lantern Ridge Treatment')
    expect(source.defaultSlug).toBe('lantern-ridge')
    expect(source.pageCount).toBe(1)
    expect(deriveTreatmentSlug('Treatment', 'camp-manzanita-treatment')).toBe('camp-manzanita-treatment')
    expect(deriveTreatmentSlug('Camp Manzanita: Treatment', 'x')).toBe('camp-manzanita')
    await expect(loadTreatmentSource('input/nope.docx')).rejects.toThrow('Unsupported treatment file')
  })
})
