import { describe, expect, test } from 'bun:test'
import { BLOCKING_DRAFTER_PINNED_SENTENCE, BLOCKING_FRAME_CONVENTION, buildBlockingDrafterPrompt, buildScenePlanSection, extractBracketPanelNotes, extractFixedAnchorSentence, SCENE_PLAN_PINNED_SENTENCE } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-prompt'
import { establishAxisSides } from '~/cli/commands/visuals/comic/comic-utils/blocking-plan-validation'
import { setupBlockingContractFixtures } from './comic-blocking-contract-fixtures'
import { BLOCKING_FIXTURE_SCENE_SLUG, BLOCKING_FIXTURE_SEGMENTS } from './fixtures/blocking/blocking-plan-fixture'
const { segmentOrder, fixturePlan, fixturePanels, context } = setupBlockingContractFixtures()


describe('blocking prompt builders', () => {
  test('the drafter prompt carries the pinned sentence, the frame convention, canon cues, and bracket notes', () => {
    const notes = extractBracketPanelNotes({ sourceSegments: [...BLOCKING_FIXTURE_SEGMENTS, { id: 'beat-0009', type: 'panel-note', text: 'BLOCKING: Peaches stays at the hatch for the whole meeting.', sourceSpans: [], location: BLOCKING_FIXTURE_SEGMENTS[0]!.location }, { id: 'beat-0010', type: 'panel-note', text: 'Wide shot of the bay.', sourceSpans: [], location: BLOCKING_FIXTURE_SEGMENTS[0]!.location }] })
    expect(notes).toEqual([{ sourceSegmentId: 'beat-0009', kind: 'BLOCKING', text: 'Peaches stays at the hatch for the whole meeting.' }])
    const fixed = extractFixedAnchorSentence(context().locationSpecifications['cargo-bay']!.specification)
    expect(fixed).toBe('Fixed features only: centered far main hatch, near cargo-airlock threshold, center lane, compact yellow hover grav lift, left catwalk, right catwalk, near-end ladders on both walls, shipping crates.')
    expect(extractFixedAnchorSentence('No anchors here.')).toBeNull()
    const prompt = buildBlockingDrafterPrompt({
      sceneSlug: BLOCKING_FIXTURE_SCENE_SLUG,
      segments: BLOCKING_FIXTURE_SEGMENTS,
      locations: [{ key: 'cargo-bay', name: 'Cargo Bay', specification: context().locationSpecifications['cargo-bay']!.specification, fixedAnchorSentence: fixed }],
      characters: [{ key: 'gulp', name: 'Gulp', description: 'Stocky engineer.', wardrobe: { colorTokens: ['hoodie: dark navy zip-up'], never: ['yellow prison jumpsuit'] }, distinguishFrom: [{ characterKey: 'geebee', cue: 'Gulp is the shorter one.' }], variantOf: undefined }],
      panelNotes: notes,
      validationErrors: ['Blocking plan anchor "magic desk" is not a substring of the "cargo-bay" specification'],
    })
    expect(BLOCKING_DRAFTER_PINNED_SENTENCE).toBe('A character the script stops mentioning has not left the room: keep every character on stage on the same mark until the script removes them.')
    expect(prompt).toContain(BLOCKING_DRAFTER_PINNED_SENTENCE)
    expect(prompt).toContain(BLOCKING_FRAME_CONVENTION)
    expect(prompt).toContain('+x is screen-right in the canonical establishing image and +y is depth away from the establishing camera')
    expect(prompt).toContain('Fixed anchors (every anchor key you emit must be a verbatim substring of this specification): Fixed features only:')
    expect(prompt).toContain('- Wardrobe tokens: hoodie: dark navy zip-up')
    expect(prompt).toContain('- Never wear: yellow prison jumpsuit')
    expect(prompt).toContain('- Distinguish from geebee: Gulp is the shorter one.')
    expect(prompt).toContain('- beat-0009 [BLOCKING]: Peaches stays at the hatch for the whole meeting.')
    expect(prompt).toContain('## Validation errors from the previous attempt (fix every one)')
    expect(prompt).toContain('- beat-0003 (dialogue, location cargo-bay) SEAMUS: Gulp, take a seat.')
    expect(prompt).not.toContain('## Bind mode: reviewed panels')
  })

  test('the scene plan section carries the pinned sentence, stage marks, and camera setups', () => {
    const section = buildScenePlanSection(establishAxisSides(fixturePlan(), fixturePanels(), { segmentOrder }))
    expect(SCENE_PLAN_PINNED_SENTENCE).toBe('The plan\'s stage marks are world truth: characterKeys must contain every on-stage character that the chosen camera sees and nobody who is not on stage, so choose a tighter camera setup rather than omitting people.')
    expect(section).toContain(SCENE_PLAN_PINNED_SENTENCE)
    expect(section).toContain('### Stage state meeting-open (location cargo-bay, starts at beat-0001)')
    expect(section).toContain('gulp at (-2, 6) facing 0° standing')
    expect(section).toContain('- wide-from-airlock (location cargo-bay): wide wide lens, eye elevation, at (0, 0) height 1.6 m looking toward (0, 8), heading 0° (nearest registered view: establishing)')
    expect(section).toContain('over the shoulder of seamus')
    expect(section).toContain('Action axis: peaches to gulp (established camera side: left)')
    expect(section).toContain('Extras: 6 deck-crew in a 2 by 3 m region centered at (4.5, 9), excluding children')
  })
})
