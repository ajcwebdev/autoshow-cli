import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { BlockingPlan, BlockingScenePanelInput, BlockingValidationContext, CharacterKey, ScenePromptData, StructuredScriptData } from '~/types'
import { hashSourceSegmentText } from '~/cli/commands/process-steps/step-8-comic/comic-utils/blocking-plan-validation'
import { specificationHash } from '~/cli/commands/process-steps/step-8-comic/comic-utils/location-reference'
import { sha256Bytes } from '~/utils/value-helpers'

export const BLOCKING_FIXTURE_SCENE_SLUG = '01-mandatory-meeting-fixture'
export const BLOCKING_FIXTURE_ENSEMBLE_KEY = 'deck-crew'
export const BLOCKING_FIXTURE_CHARACTER_KEYS = ['peaches', 'seamus', 'gulp', 'geebee', 'duco', 'paddy', 'chat', 'bishop', 'ironhand-1', 'ironhand-2', 'ironhand-3'] as const

export const BLOCKING_FIXTURE_TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

export const BLOCKING_FIXTURE_CATALOG_CHARACTERS = [
  { key: 'peaches', name: 'Peaches', aliases: ['PEACHES', 'CAPTAIN PEACHES'], description: 'Peach-colored captain in a fitted command jacket.' },
  { key: 'seamus', name: 'Seamus', aliases: ['SEAMUS'], description: 'Tall first officer with a trimmed beard.' },
  { key: 'gulp', name: 'Gulp', aliases: ['GULP'], description: 'Stocky engineer in a dark navy hoodie.' },
  { key: 'geebee', name: 'Geebee', aliases: ['GEEBEE'], description: 'Wiry pilot with goggles pushed up.' },
  { key: 'duco', name: 'Duco', aliases: ['DUCO'], description: 'Broad mechanic in an orange coverall.' },
  { key: 'paddy', name: 'Paddy', aliases: ['PADDY'], description: 'Freckled deckhand in a green vest.' },
  { key: 'chat', name: 'Chat', aliases: ['CHAT'], description: 'A floating blue hologram above a projector base.' },
  { key: 'bishop', name: 'Bishop', aliases: ['BISHOP'], description: 'Older sharp-featured officer without glasses.' },
  { key: 'ironhand-1', name: 'Ironhand 1', aliases: ['IRONHAND 1', 'IRONHANDS #1'], description: 'Heavy security drone number one.' },
  { key: 'ironhand-2', name: 'Ironhand 2', aliases: ['IRONHAND 2', 'IRONHANDS #2'], description: 'Heavy security drone number two.' },
  { key: 'ironhand-3', name: 'Ironhand 3', aliases: ['IRONHAND 3', 'IRONHANDS #3'], description: 'Heavy security drone number three.' },
  { key: 'deck-crew', name: 'Deck Crew', aliases: ['DECK CREW', 'CREW EXTRAS'], description: 'Assorted background deck crew in gray work fatigues.' },
] as const

export const BLOCKING_FIXTURE_GROUP_ALIASES = [{ alias: 'IRONHANDS', characterKeys: ['ironhand-1', 'ironhand-2', 'ironhand-3'] }]

export const BLOCKING_FIXTURE_LOCATION_SPECIFICATIONS = {
  'cargo-bay': {
    key: 'cargo-bay',
    name: 'Cargo Bay',
    specification: 'The cargo bay is a long rectangular hold seen from the cargo-airlock end looking lengthwise toward a broad centered far main hatch on the far wall. A compact yellow hover grav lift is parked in the center lane. Matching left and right longitudinal catwalks run along both walls, referred to as the left catwalk and the right catwalk. Fixed access ladders descend near the cargo-airlock end on both sides. Mismatched shipping crates sit in sparse side banks. Fixed features only: centered far main hatch, near cargo-airlock threshold, center lane, compact yellow hover grav lift, left catwalk, right catwalk, near-end ladders on both walls, shipping crates.',
  },
  'seamus-quarters': {
    key: 'seamus-quarters',
    name: 'Seamus\'s Quarters',
    specification: 'Seamus\'s quarters are a narrow cabin seen looking down the central aisle toward a sealed sliding door in the middle of the rear wall. A single bunk runs lengthwise along the left wall, and a compact built-in desk and rolling chair fill the right foreground. Fixed visual anchors: left-wall single bunk, centered rear sliding door, open central aisle, right-side built-in desk, rolling chair.',
  },
} as const

const cargo = { key: 'cargo-bay', raw: 'INT. CARGO BAY - MORNING', type: 'INT', place: 'CARGO BAY - MORNING' }
const quarters = { key: 'seamus-quarters', raw: 'INT. SEAMUS\'S QUARTERS - CONTINUOUS', type: 'INT', place: 'SEAMUS\'S QUARTERS - CONTINUOUS' }

export const BLOCKING_FIXTURE_SEGMENTS: StructuredScriptData['sourceSegments'] = [
  { id: 'beat-0001', type: 'direction', text: 'The crew gathers in the cargo bay. Peaches stands at the centered far main hatch with Seamus beside her. Gulp, Geebee, Duco, Paddy, Chat, Bishop, and the Ironhands wait among the crates while deck crew mill about the right catwalk.', beatIndex: 1, sourceSpans: [], location: cargo },
  { id: 'beat-0002', type: 'dialogue', text: 'Mandatory meeting. Nobody leaves.', beatIndex: 2, speakerKey: 'peaches', speakerKeys: ['peaches'], speakerLabel: 'PEACHES', sourceSpans: [], location: cargo },
  { id: 'beat-0003', type: 'dialogue', text: 'Gulp, take a seat.', beatIndex: 3, speakerKey: 'seamus', speakerKeys: ['seamus'], speakerLabel: 'SEAMUS', sourceSpans: [], location: cargo },
  { id: 'beat-0004', type: 'direction', text: 'Gulp sits on a crate near the ladder. Bishop crosses to the grav lift and leans on it.', beatIndex: 4, sourceSpans: [], location: cargo },
  { id: 'beat-0005', type: 'dialogue', text: 'This lift is not going anywhere.', beatIndex: 5, speakerKey: 'bishop', speakerKeys: ['bishop'], speakerLabel: 'BISHOP', sourceSpans: [], location: cargo },
  { id: 'beat-0006', type: 'direction', text: 'Seamus sits at the desk in his quarters. Peaches leans in the doorway.', beatIndex: 6, sourceSpans: [], location: quarters },
  { id: 'beat-0007', type: 'dialogue', text: 'We need a better plan.', beatIndex: 7, speakerKey: 'seamus', speakerKeys: ['seamus'], speakerLabel: 'SEAMUS', sourceSpans: [], location: quarters },
  { id: 'beat-0008', type: 'dialogue', text: 'We need a better crew.', beatIndex: 8, speakerKey: 'peaches', speakerKeys: ['peaches'], speakerLabel: 'PEACHES', sourceSpans: [], location: quarters },
]

export const buildBlockingFixtureStructuredScript = (options: { segments?: StructuredScriptData['sourceSegments'] | undefined; canonicalPath?: string | undefined } = {}): StructuredScriptData => ({
  schemaVersion: 5,
  scriptSlug: BLOCKING_FIXTURE_SCENE_SLUG,
  sourceFile: options.canonicalPath ?? 'input/scripts/02-script/01-mandatory-meeting.md',
  sourceIdentity: { schemaVersion: 1, canonicalPath: options.canonicalPath ?? 'input/scripts/02-script/01-mandatory-meeting.md', scriptSlug: BLOCKING_FIXTURE_SCENE_SLUG, contentSha256: '0'.repeat(64), identityHash: '1'.repeat(64) },
  document: { heading: 'Episode 2', title: 'Episode 2', metadata: [] },
  scene: { heading: 'SCENE 1: "Mandatory Meeting"', section: 'SCENE 1', title: 'Mandatory Meeting', location: cargo, soundscape: { cues: [], ambientBeds: [] } },
  characterKeys: [...BLOCKING_FIXTURE_CHARACTER_KEYS, BLOCKING_FIXTURE_ENSEMBLE_KEY],
  beats: [],
  sourceSegments: options.segments ?? BLOCKING_FIXTURE_SEGMENTS,
})

export const citationFor = (structuredScript: Pick<StructuredScriptData, 'sourceSegments'>, sourceSegmentId: string) => {
  const segment = structuredScript.sourceSegments.find(item => item.id === sourceSegmentId)
  if (!segment) throw new Error(`fixture segment ${sourceSegmentId} is missing`)
  return { sourceSegmentId, sourceSegmentSha256: hashSourceSegmentText(segment.text) }
}

const standing = (characterKey: string, x: number, y: number, facingDeg: number) => ({ characterKey, position: { x, y }, facingDeg, posture: 'standing' as const, seatAnchorKey: null, wardrobe: 'canonical', wardrobeCitation: null })

export const buildBlockingFixturePlan = (structuredScript: Pick<StructuredScriptData, 'sourceSegments'> = buildBlockingFixtureStructuredScript(), structuredScriptSha256 = sha256Bytes(`${JSON.stringify(structuredScript, null, 2)}\n`)): BlockingPlan => {
  const cite = (id: string) => citationFor(structuredScript, id)
  const meetingOpen = [
    standing('peaches', 0, 12, 180),
    standing('seamus', 1.2, 12, 270),
    standing('gulp', -2, 6, 0),
    standing('geebee', -3, 5, 30),
    standing('duco', 2, 6, 340),
    standing('paddy', 3, 5, 330),
    standing('chat', -1, 4, 0),
    standing('bishop', 1, 4, 0),
    standing('ironhand-1', -4, 3, 20),
    standing('ironhand-2', 4, 3, 340),
    standing('ironhand-3', 0, 2.5, 0),
  ]
  const extras = [{ ensembleKey: BLOCKING_FIXTURE_ENSEMBLE_KEY, region: { x: 4.5, y: 9, width: 2, depth: 3 }, count: 6, variety: ['mixed ages', 'varied heights'], exclude: ['children'], props: ['clipboards'] }]
  return {
    schemaVersion: 1,
    sceneSlug: BLOCKING_FIXTURE_SCENE_SLUG,
    structuredScriptSha256,
    generatedBy: { mode: 'import', model: null },
    locations: [
      {
        locationKey: 'cargo-bay',
        specificationSha256: specificationHash(BLOCKING_FIXTURE_LOCATION_SPECIFICATIONS['cargo-bay'].specification),
        geometrySource: 'specification',
        anchors: [
          { key: 'centered far main hatch', position: { x: 0, y: 14 }, footprint: { width: 4, depth: 0.3 }, wall: 'rear', facingDeg: 180, longAxis: 'x' },
          { key: 'grav lift', position: { x: 0, y: 7 }, footprint: { width: 1.5, depth: 2.5 }, wall: 'floor', facingDeg: 180, longAxis: 'y' },
          { key: 'left catwalk', position: { x: -6, y: 8 }, footprint: { width: 1, depth: 14 }, wall: 'left', facingDeg: 90, longAxis: 'y' },
          { key: 'right catwalk', position: { x: 6, y: 8 }, footprint: { width: 1, depth: 14 }, wall: 'right', facingDeg: 270, longAxis: 'y' },
          { key: 'shipping crates', position: { x: 4, y: 4 }, footprint: { width: 2, depth: 2 }, wall: null, facingDeg: null, longAxis: null },
        ],
        suppressedAnchors: [],
        dressing: [{ key: 'folding chairs', description: 'A ragged row of temporary folding chairs facing the hatch.', position: { x: 0, y: 5 }, citation: cite('beat-0001') }],
        cameraCells: [],
      },
      {
        locationKey: 'seamus-quarters',
        specificationSha256: specificationHash(BLOCKING_FIXTURE_LOCATION_SPECIFICATIONS['seamus-quarters'].specification),
        geometrySource: 'specification',
        anchors: [
          { key: 'single bunk', position: { x: -1.5, y: 2.5 }, footprint: { width: 0.9, depth: 2 }, wall: 'left', facingDeg: 90, longAxis: 'y' },
          { key: 'sliding door', position: { x: 0, y: 5 }, footprint: { width: 1, depth: 0.2 }, wall: 'rear', facingDeg: 180, longAxis: 'x' },
          { key: 'built-in desk', position: { x: 1.5, y: 1.5 }, footprint: { width: 0.7, depth: 1.4 }, wall: 'right', facingDeg: 270, longAxis: 'y' },
          { key: 'rolling chair', position: { x: 0.9, y: 1.5 }, footprint: { width: 0.5, depth: 0.5 }, wall: null, facingDeg: 90, longAxis: null },
        ],
        suppressedAnchors: [],
        dressing: [],
        cameraCells: [],
      },
    ],
    stageStates: [
      { id: 'meeting-open', locationKey: 'cargo-bay', startsAt: cite('beat-0001'), characters: meetingOpen, extras, actionAxis: { from: 'peaches', to: 'gulp', establishedSide: null }, dressing: 'Folding chairs face the hatch.', moves: [] },
      {
        id: 'gulp-sits',
        locationKey: 'cargo-bay',
        startsAt: cite('beat-0004'),
        characters: meetingOpen.map(mark => mark.characterKey === 'gulp'
          ? { ...mark, position: { x: 4, y: 4.8 }, facingDeg: 270, posture: 'seated' as const, seatAnchorKey: 'shipping crates' }
          : mark.characterKey === 'bishop'
            ? { ...mark, position: { x: 0.9, y: 6 }, facingDeg: 270, posture: 'leaning' as const }
            : mark),
        extras,
        actionAxis: { from: 'peaches', to: 'gulp', establishedSide: null },
        dressing: 'Folding chairs face the hatch.',
        moves: [
          { type: 'sit', characterKey: 'gulp', citation: cite('beat-0004') },
          { type: 'cross', characterKey: 'bishop', citation: cite('beat-0004') },
        ],
      },
      {
        id: 'quarters-talk',
        locationKey: 'seamus-quarters',
        startsAt: cite('beat-0006'),
        characters: [
          { characterKey: 'seamus', position: { x: 0.9, y: 1.5 }, facingDeg: 90, posture: 'seated', seatAnchorKey: 'rolling chair', wardrobe: 'canonical', wardrobeCitation: null },
          { characterKey: 'peaches', position: { x: 0, y: 4.6 }, facingDeg: 180, posture: 'leaning', seatAnchorKey: null, wardrobe: 'canonical', wardrobeCitation: null },
        ],
        extras: [],
        actionAxis: { from: 'seamus', to: 'peaches', establishedSide: null },
        dressing: null,
        moves: [],
      },
    ],
    cameraSetups: [
      { id: 'wide-from-airlock', locationKey: 'cargo-bay', position: { x: 0, y: 0 }, heightM: 1.6, target: { x: 0, y: 8 }, lens: 'wide', framing: 'wide', elevation: 'eye', overShoulderOf: null },
      { id: 'reverse-from-hatch', locationKey: 'cargo-bay', position: { x: 0, y: 13.5 }, heightM: 1.6, target: { x: 0, y: 5 }, lens: 'normal', framing: 'medium-wide', elevation: 'eye', overShoulderOf: null },
      { id: 'side-from-right-catwalk', locationKey: 'cargo-bay', position: { x: 5.2, y: 8 }, heightM: 2.4, target: { x: -2, y: 8 }, lens: 'wide', framing: 'wide', elevation: 'high', overShoulderOf: null },
      { id: 'ots-seamus-on-peaches', locationKey: 'cargo-bay', position: { x: 3.2, y: 12.9 }, heightM: 1.7, target: { x: 0, y: 12 }, lens: 'long', framing: 'medium', elevation: 'eye', overShoulderOf: 'seamus' },
      { id: 'quarters-from-door', locationKey: 'seamus-quarters', position: { x: -0.45, y: 5.3 }, heightM: 1.6, target: { x: 0.9, y: 1.5 }, lens: 'normal', framing: 'medium', elevation: 'eye', overShoulderOf: 'peaches' },
      { id: 'quarters-from-desk', locationKey: 'seamus-quarters', position: { x: 1.4, y: 0.4 }, heightM: 1.3, target: { x: 0, y: 4.6 }, lens: 'wide', framing: 'medium', elevation: 'low', overShoulderOf: null },
    ],
  }
}

export const BLOCKING_FIXTURE_WIDE_CAST = ['peaches', 'seamus', 'gulp', 'geebee', 'duco', 'paddy', 'chat', 'bishop', 'ironhand-3', BLOCKING_FIXTURE_ENSEMBLE_KEY]

export const buildBlockingFixtureScenePanels = (): BlockingScenePanelInput[] => [
  { number: 1, locationKey: 'cargo-bay', sourceSegmentIds: ['beat-0001'], characterKeys: BLOCKING_FIXTURE_WIDE_CAST, blocking: { cameraSetupId: 'wide-from-airlock', croppedOnStage: [], axisBreak: null } },
  { number: 2, locationKey: 'cargo-bay', sourceSegmentIds: ['beat-0002'], characterKeys: ['peaches', 'gulp', 'geebee', 'duco', 'paddy', 'chat', 'bishop', 'ironhand-1', 'ironhand-2', 'ironhand-3'], blocking: { cameraSetupId: 'reverse-from-hatch', croppedOnStage: [], axisBreak: { sourceSegmentId: 'beat-0002', reason: 'Peaches turns to address the whole bay.' } } },
  { number: 3, locationKey: 'cargo-bay', sourceSegmentIds: ['beat-0003'], characterKeys: ['peaches', 'seamus'], blocking: { cameraSetupId: 'ots-seamus-on-peaches', croppedOnStage: [], axisBreak: null } },
  { number: 4, locationKey: 'cargo-bay', sourceSegmentIds: ['beat-0004', 'beat-0005'], characterKeys: ['peaches', 'gulp', 'geebee', 'duco', 'paddy', 'chat', 'bishop', 'ironhand-3', BLOCKING_FIXTURE_ENSEMBLE_KEY], blocking: { cameraSetupId: 'wide-from-airlock', croppedOnStage: [{ characterKey: 'seamus', reason: 'Seamus is cropped by the right frame edge.' }], axisBreak: null } },
  { number: 5, locationKey: 'seamus-quarters', sourceSegmentIds: ['beat-0006', 'beat-0007'], characterKeys: ['seamus', 'peaches'], blocking: { cameraSetupId: 'quarters-from-door', croppedOnStage: [], axisBreak: null } },
  { number: 6, locationKey: 'seamus-quarters', sourceSegmentIds: ['beat-0008'], characterKeys: ['peaches', 'seamus'], blocking: { cameraSetupId: 'quarters-from-desk', croppedOnStage: [], axisBreak: { sourceSegmentId: 'beat-0008', reason: 'The reverse from the desk deliberately crosses the line as Peaches answers.' } } },
]

export const buildBlockingFixtureScene = (options: { withBlocking?: boolean | undefined } = {}): ScenePromptData => ({
  schemaVersion: 4,
  title: 'Mandatory Meeting',
  location: 'INT. CARGO BAY - MORNING',
  panels: buildBlockingFixtureScenePanels().map(panel => ({
    number: panel.number,
    description: `Panel ${panel.number} staging.`,
    shotPlan: `Panel ${panel.number} shot plan using camera ${panel.blocking?.cameraSetupId ?? 'unset'}.`,
    characterKeys: [...panel.characterKeys] as CharacterKey[],
    speech: [],
    sourceSegmentIds: [...panel.sourceSegmentIds],
    locationKey: panel.locationKey,
    designReferences: [],
    ...(options.withBlocking && panel.blocking ? { blocking: panel.blocking } : {}),
  })),
})

const aliasTable = (): Array<{ pattern: RegExp; keys: CharacterKey[] }> => {
  const table: Array<{ pattern: RegExp; keys: CharacterKey[] }> = []
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  for (const character of BLOCKING_FIXTURE_CATALOG_CHARACTERS) {
    for (const label of [character.key, character.name, ...character.aliases]) table.push({ pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escape(label)}(?![\\p{L}\\p{N}])`, 'iu'), keys: [character.key as CharacterKey] })
  }
  for (const group of BLOCKING_FIXTURE_GROUP_ALIASES) table.push({ pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escape(group.alias)}(?![\\p{L}\\p{N}])`, 'iu'), keys: group.characterKeys as CharacterKey[] })
  return table
}

export const createBlockingFixtureCatalogStub = (): BlockingValidationContext['catalog'] => {
  const table = aliasTable()
  return {
    characterKeys: BLOCKING_FIXTURE_CATALOG_CHARACTERS.map(character => character.key as CharacterKey),
    detectMentions: (text: string) => table.filter(entry => entry.pattern.test(text)).map(entry => ({ raw: entry.keys.join(','), characterKeys: [...entry.keys] })),
  }
}

export const buildBlockingFixtureValidationContext = (structuredScript: StructuredScriptData = buildBlockingFixtureStructuredScript()): BlockingValidationContext => ({
  structuredScript,
  locationSpecifications: BLOCKING_FIXTURE_LOCATION_SPECIFICATIONS,
  catalog: createBlockingFixtureCatalogStub(),
})

export const writeBlockingFixtureInputRoot = async (root: string): Promise<{ charactersRoot: string; locationsRoot: string; establishingImages: Record<string, string> }> => {
  const charactersRoot = join(root, 'input', 'characters')
  const locationsRoot = join(root, 'input', 'locations')
  await mkdir(charactersRoot, { recursive: true })
  await mkdir(locationsRoot, { recursive: true })
  for (const character of BLOCKING_FIXTURE_CATALOG_CHARACTERS) await Bun.write(join(charactersRoot, `${character.key}.png`), BLOCKING_FIXTURE_TINY_PNG)
  await Bun.write(join(charactersRoot, 'characters-reference.json'), JSON.stringify({
    schemaVersion: 3,
    characters: BLOCKING_FIXTURE_CATALOG_CHARACTERS.map(character => ({ key: character.key, name: character.name, aliases: [...character.aliases], image: `${character.key}.png`, outlineSheet: `${character.key}.png`, description: character.description })),
    groupAliases: BLOCKING_FIXTURE_GROUP_ALIASES,
  }, null, 2))
  const establishingImages: Record<string, string> = {}
  const sketches: unknown[] = []
  for (const location of Object.values(BLOCKING_FIXTURE_LOCATION_SPECIFICATIONS)) {
    const imagePath = join(locationsRoot, `${location.key}--reference.png`)
    const bytes = Buffer.concat([BLOCKING_FIXTURE_TINY_PNG, Buffer.from(location.key)])
    await Bun.write(imagePath, bytes)
    establishingImages[location.key] = imagePath
    sketches.push({ locationKey: location.key, specificationSha256: specificationHash(location.specification), views: [{ view: 'establishing', generationId: `${location.key}-fixture`, image: `${location.key}--reference.png`, imageSha256: sha256Bytes(new Uint8Array(bytes)), model: 'gpt-image-2', createdAt: '2026-01-01T00:00:00.000Z' }] })
  }
  await Bun.write(join(locationsRoot, 'locations-reference.json'), JSON.stringify({
    schemaVersion: 1,
    styleImage: 'input/characters/peaches.png',
    locations: Object.values(BLOCKING_FIXTURE_LOCATION_SPECIFICATIONS).map(location => ({ key: location.key, name: location.name, aliases: [], specification: location.specification, sourceScripts: ['scripts/02-script/01-mandatory-meeting.md'] })),
  }, null, 2))
  await Bun.write(join(locationsRoot, 'location-sketches.json'), JSON.stringify({ schemaVersion: 2, sketches }, null, 2))
  return { charactersRoot, locationsRoot, establishingImages }
}
