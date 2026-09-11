import * as v from 'valibot'
import type { LocationReferenceCatalog, TreatmentDraft, TreatmentDraftValidationContext } from '~/types'
import { normalizeCharacterLookup } from '../../comic-utils/character-catalog-validation'
import { resolveLocationCatalogEntry } from '../../comic-utils/location-reference'
import { TREATMENT_SCHEMA_NAME } from './treatment-defaults'

export const TREATMENT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const TREATMENT_SLUGLINE_PATTERN = /^(?:INT|EXT|INT\/EXT)\.\s+\S[^-]*?\s+-\s+(?:(?:EARLY|LATE)\s+)?(?:DAY|NIGHT|MORNING|AFTERNOON|EVENING|DAWN|DUSK|CONTINUOUS|LATER)$/i

export const FORBIDDEN_SPOKEN_START_PATTERN = /^(?:INT\.|EXT\.|INT\/EXT\.|\[|\*)/i

const KebabKeySchema = v.pipe(v.string(), v.regex(TREATMENT_KEY_PATTERN, 'Expected a lowercase kebab-case key'))

export const TreatmentDraftSchema = v.strictObject({
  schemaVersion: v.literal(1),
  title: v.string(),
  sceneTitle: v.string(),
  styleInstructions: v.string(),
  characters: v.array(v.strictObject({
    key: KebabKeySchema,
    name: v.string(),
    aliases: v.array(v.string()),
    description: v.string(),
    wardrobe: v.strictObject({
      colorTokens: v.array(v.string()),
      never: v.array(v.string()),
    }),
  })),
  locations: v.array(v.strictObject({
    key: KebabKeySchema,
    name: v.string(),
    slugline: v.string(),
    aliases: v.array(v.string()),
    specification: v.string(),
  })),
  panels: v.array(v.strictObject({
    number: v.number(),
    locationKey: v.string(),
    panelNote: v.string(),
    narration: v.nullable(v.string()),
    dialogue: v.array(v.strictObject({
      characterKey: v.string(),
      line: v.string(),
    })),
    sourceExcerpt: v.string(),
  })),
})

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' as const }] })

const stringArray = { type: 'array' as const, items: { type: 'string' as const } }

export const buildTreatmentJsonSchema = () => ({
  name: TREATMENT_SCHEMA_NAME,
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      schemaVersion: { type: 'integer', enum: [1] },
      title: { type: 'string' },
      sceneTitle: { type: 'string' },
      styleInstructions: { type: 'string' },
      characters: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
            name: { type: 'string' },
            aliases: stringArray,
            description: { type: 'string' },
            wardrobe: {
              type: 'object',
              properties: { colorTokens: stringArray, never: stringArray },
              required: ['colorTokens', 'never'],
              additionalProperties: false,
            },
          },
          required: ['key', 'name', 'aliases', 'description', 'wardrobe'],
          additionalProperties: false,
        },
      },
      locations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
            name: { type: 'string' },
            slugline: { type: 'string' },
            aliases: stringArray,
            specification: { type: 'string' },
          },
          required: ['key', 'name', 'slugline', 'aliases', 'specification'],
          additionalProperties: false,
        },
      },
      panels: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            number: { type: 'integer' },
            locationKey: { type: 'string' },
            panelNote: { type: 'string' },
            narration: nullable({ type: 'string' }),
            dialogue: {
              type: 'array',
              items: {
                type: 'object',
                properties: { characterKey: { type: 'string' }, line: { type: 'string' } },
                required: ['characterKey', 'line'],
                additionalProperties: false,
              },
            },
            sourceExcerpt: { type: 'string' },
          },
          required: ['number', 'locationKey', 'panelNote', 'narration', 'dialogue', 'sourceExcerpt'],
          additionalProperties: false,
        },
      },
    },
    required: ['schemaVersion', 'title', 'sceneTitle', 'styleInstructions', 'characters', 'locations', 'panels'],
    additionalProperties: false,
  },
})

export const canonicalSlugline = (value: string): string => value
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase()

export const buildTreatmentLocationCatalogPreview = (
  existing: LocationReferenceCatalog | undefined,
  locations: TreatmentDraft['locations']
): LocationReferenceCatalog => {
  const existingKeys = new Set((existing?.locations ?? []).map(entry => entry.key))
  return {
    schemaVersion: 1,
    styleImage: existing?.styleImage ?? '',
    locations: [
      ...(existing?.locations ?? []),
      ...locations
        .filter(location => !existingKeys.has(location.key))
        .map(location => ({
          key: location.key,
          name: location.name.trim() || location.key,
          aliases: [canonicalSlugline(location.slugline), ...location.aliases.map(alias => alias.trim()).filter(Boolean)],
          specification: location.specification.trim() || 'pending',
          sourceScripts: [],
        })),
    ],
  }
}

const registerLookup = (
  owners: Map<string, string>,
  label: string,
  key: string,
): string | undefined => {
  const normalized = normalizeCharacterLookup(label)
  if (!normalized) return undefined
  const owner = owners.get(normalized)
  if (owner !== undefined && owner !== key) return owner
  owners.set(normalized, key)
  return undefined
}

export const panelVoice = (panel: Pick<TreatmentDraft['panels'][number], 'narration' | 'dialogue'>): string | undefined => {
  const speakers = [...new Set(panel.dialogue.map(line => line.characterKey))]
  if (speakers.length > 0) return speakers.length === 1 ? `speaker:${speakers[0]}` : 'speaker:mixed'
  return panel.narration?.trim() ? 'narration' : undefined
}

export const countVoiceSwitches = (panels: ReadonlyArray<Pick<TreatmentDraft['panels'][number], 'narration' | 'dialogue'>>): number => {
  let switches = 0
  let previous: string | undefined
  for (const panel of panels) {
    const voice = panelVoice(panel)
    if (!voice) continue
    if (previous !== undefined && voice !== previous) switches += 1
    previous = voice
  }
  return switches
}

export const maxVoiceSwitchesFor = (panelCount: number): number => Math.max(2, Math.floor(panelCount / 3))

export const validateTreatmentDraft = (draft: TreatmentDraft, context: TreatmentDraftValidationContext): string[] => {
  const issues: string[] = []
  if (!draft.title.trim()) issues.push('title must not be blank')
  if (!draft.sceneTitle.trim()) issues.push('sceneTitle must not be blank')
  if (!draft.styleInstructions.trim()) issues.push('styleInstructions must not be blank')

  const existingCharacterKeys = new Set(context.existingCharacters.characters.map(character => character.key))
  const owners = new Map<string, string>()
  for (const character of context.existingCharacters.characters) {
    registerLookup(owners, character.key, character.key)
    registerLookup(owners, character.name, character.key)
    for (const alias of character.aliases) registerLookup(owners, alias, character.key)
  }
  for (const group of context.existingCharacters.groupAliases) registerLookup(owners, group.alias, `group:${group.alias}`)

  const draftCharacterKeys = new Set<string>()
  draft.characters.forEach((character, index) => {
    const label = `characters[${index}] (${character.key || 'missing key'})`
    if (draftCharacterKeys.has(character.key)) issues.push(`${label}: duplicate character key`)
    draftCharacterKeys.add(character.key)
    if (!character.name.trim()) issues.push(`${label}: name must not be blank`)
    if (!character.description.trim()) issues.push(`${label}: description must not be blank`)
    if (character.wardrobe.colorTokens.filter(token => token.trim()).length === 0) issues.push(`${label}: wardrobe.colorTokens needs at least one non-blank token`)
    if (existingCharacterKeys.has(character.key)) {
      if (context.catalogPolicy === 'fail') issues.push(`${label}: key already exists in the character catalog; choose a new key or rerun with --catalog-policy skip-existing`)
      return
    }
    const keyOwner = registerLookup(owners, character.key, character.key)
    if (keyOwner) issues.push(`${label}: key collides with the name or alias of "${keyOwner}"`)
    const nameOwner = registerLookup(owners, character.name, character.key)
    if (nameOwner) issues.push(`${label}: display name "${character.name}" collides with "${nameOwner}"; names must identify exactly one character`)
    if (context.catalogPolicy === 'fail') {
      for (const alias of character.aliases) {
        const aliasOwner = registerLookup(owners, alias, character.key)
        if (aliasOwner) issues.push(`${label}: alias "${alias}" collides with "${aliasOwner}"`)
      }
    }
  })

  const existingLocationKeys = new Set((context.existingLocations?.locations ?? []).map(location => location.key))
  const draftLocationKeys = new Set<string>()
  const preview = buildTreatmentLocationCatalogPreview(context.existingLocations, draft.locations)
  draft.locations.forEach((location, index) => {
    const label = `locations[${index}] (${location.key || 'missing key'})`
    if (draftLocationKeys.has(location.key)) issues.push(`${label}: duplicate location key`)
    draftLocationKeys.add(location.key)
    if (!location.name.trim()) issues.push(`${label}: name must not be blank`)
    if (!location.specification.trim()) issues.push(`${label}: specification must not be blank`)
    const slugline = canonicalSlugline(location.slugline)
    if (!TREATMENT_SLUGLINE_PATTERN.test(slugline)) {
      issues.push(`${label}: slugline "${location.slugline}" must read like "EXT. PLACE - NIGHT": an INT. or EXT. prefix, a place with no dash inside it, one " - " separator, then one time word such as DAY or NIGHT`)
      return
    }
    if (existingLocationKeys.has(location.key)) {
      if (context.catalogPolicy === 'fail') issues.push(`${label}: key already exists in the location catalog; choose a new key or rerun with --catalog-policy skip-existing`)
      return
    }
    try {
      const resolved = resolveLocationCatalogEntry(slugline, preview)
      if (resolved.key !== location.key) issues.push(`${label}: slugline "${slugline}" resolves to location "${resolved.key}" instead of "${location.key}"; make the place wording unique`)
    } catch (error) {
      issues.push(`${label}: slugline "${slugline}" cannot be resolved uniquely: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  const knownCharacterKeys = new Set([...existingCharacterKeys, ...draftCharacterKeys])
  const speakerSet = new Set(context.speakers)
  for (const speaker of context.speakers) {
    if (!knownCharacterKeys.has(speaker)) issues.push(`--speaker ${speaker} is not defined in characters and does not exist in the character catalog`)
  }

  const { minimum, maximum } = context.panelRange
  if (draft.panels.length < minimum || draft.panels.length > maximum) {
    issues.push(minimum === maximum
      ? `panels: expected exactly ${minimum} panels, received ${draft.panels.length}`
      : `panels: expected between ${minimum} and ${maximum} panels, received ${draft.panels.length}`)
  }
  const knownLocationKeys = new Set([...existingLocationKeys, ...draftLocationKeys])
  draft.panels.forEach((panel, index) => {
    const expected = index + 1
    const label = `panels[${index}]`
    if (panel.number !== expected) issues.push(`${label}: number must be ${expected}, received ${panel.number}`)
    if (!panel.panelNote.trim()) issues.push(`${label}: panelNote must not be blank`)
    const narration = panel.narration?.trim() ?? ''
    if (!narration && panel.dialogue.length === 0) issues.push(`${label}: needs narration or at least one dialogue line`)
    if (context.voicePacing === 'exclusive' && narration && panel.dialogue.length > 0) issues.push(`${label}: carries both narration and dialogue; give each panel one voice and move the narration to its own bridging panel`)
    if (new Set(panel.dialogue.map(line => line.characterKey)).size > 1) issues.push(`${label}: dialogue mixes more than one speaker; split the panel so each panel carries one speaker`)
    if (narration && FORBIDDEN_SPOKEN_START_PATTERN.test(narration)) issues.push(`${label}: narration must not begin with INT., EXT., a bracket, or an asterisk`)
    if (!knownLocationKeys.has(panel.locationKey)) issues.push(`${label}: locationKey "${panel.locationKey}" is not one of the defined locations`)
    panel.dialogue.forEach((line, lineIndex) => {
      const lineLabel = `${label}.dialogue[${lineIndex}]`
      const text = line.line.trim()
      if (!text) issues.push(`${lineLabel}: line must not be blank`)
      if (!speakerSet.has(line.characterKey)) {
        issues.push(`${lineLabel}: characterKey "${line.characterKey}" is not an allowed speaker (${context.speakers.length > 0 ? context.speakers.join(', ') : 'none'}); fold the quote into narration`)
      } else if (!knownCharacterKeys.has(line.characterKey)) {
        issues.push(`${lineLabel}: characterKey "${line.characterKey}" is not defined in characters`)
      }
      if (text && FORBIDDEN_SPOKEN_START_PATTERN.test(text)) issues.push(`${lineLabel}: line must not begin with INT., EXT., a bracket, or an asterisk`)
    })
  })

  if (context.voicePacing === 'exclusive' && draft.panels.length > 0) {
    const switches = countVoiceSwitches(draft.panels)
    const cap = maxVoiceSwitchesFor(draft.panels.length)
    if (switches > cap) issues.push(`panels: the voice changes ${switches} times across ${draft.panels.length} panels; keep it to at most ${cap} by grouping consecutive panels into longer narration and speech runs`)
  }
  return issues
}
