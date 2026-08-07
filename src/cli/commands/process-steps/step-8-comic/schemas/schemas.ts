import * as v from 'valibot'
import type { CharacterCatalogService, CharacterKey } from '~/types'
import { ValidationError } from '~/utils/error-handler'

const STRUCTURED_SCRIPT_BEAT_TYPES = ['narration', 'dialogue', 'direction', 'transition', 'panel-note'] as const
const CharacterKeySchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case character key'),
  v.transform(value => value as CharacterKey)
)
const CharacterReferenceImagePathSchema = v.pipe(
  v.string(),
  v.regex(/\.(?:png|webp|jpg|jpeg)$/i, 'Expected a PNG, WebP, JPG, or JPEG character image')
)
const CharacterSceneTextRuleSchema = v.strictObject({
  kind: v.picklist(['required', 'forbidden']),
  pattern: v.string(),
  description: v.string(),
})

const AuthoredCharacterDetailsSchema = v.strictObject({
  key: CharacterKeySchema,
  name: v.string(),
  aliases: v.array(v.string()),
  image: CharacterReferenceImagePathSchema,
  outlineSheet: CharacterReferenceImagePathSchema,
  description: v.string(),
  sceneTextRules: v.optional(v.array(CharacterSceneTextRuleSchema)),
})

const ScenePromptsSchema = v.object({
  Prefix: v.optional(v.string()),
  '1st Panel': v.string(),
  '2nd Panel': v.optional(v.string()),
  '3rd Panel': v.optional(v.string()),
})
const SketchPromptsSchema = v.object({ Prefix: v.optional(v.string()), Chunk: v.string() })
const CharacterSketchPromptsSchema = v.object({
  Prefix: v.optional(v.string()),
  Character: v.string(),
  Front: v.string(),
  'Three-Quarter': v.string(),
  Profile: v.string(),
})
const ImagePromptVariationsSchema = v.object({
  'animation-polish': v.string(),
  'cinematic-depth': v.string(),
})

const StructuredScriptMetadataEntrySchema = v.strictObject({
  label: v.string(), value: v.optional(v.string()), raw: v.string(),
})
const StructuredScriptMentionSchema = v.strictObject({
  raw: v.string(), characterKeys: v.array(CharacterKeySchema),
})
const StructuredScriptLocationSchema = v.strictObject({
  key: v.string(), raw: v.string(), type: v.optional(v.string()), place: v.optional(v.string()),
})
const StructuredScriptBeatSchema = v.strictObject({
  index: v.number(),
  type: v.picklist(STRUCTURED_SCRIPT_BEAT_TYPES),
  text: v.string(),
  characterKeys: v.array(CharacterKeySchema),
  rawMentions: v.array(StructuredScriptMentionSchema),
  speakerKey: v.optional(CharacterKeySchema),
  speakerLabel: v.optional(v.string()),
  delivery: v.optional(v.string()),
  location: StructuredScriptLocationSchema,
})
const StructuredScriptSourceSegmentSchema = v.strictObject({
  id: v.string(),
  type: v.picklist(STRUCTURED_SCRIPT_BEAT_TYPES),
  text: v.string(),
  rawMarkdown: v.optional(v.string()),
  beatIndex: v.optional(v.number()),
  speakerKey: v.optional(CharacterKeySchema),
  speakerLabel: v.optional(v.string()),
  delivery: v.optional(v.string()),
  location: StructuredScriptLocationSchema,
})

const ComicSpeakerSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('character'), characterKey: CharacterKeySchema, offscreen: v.boolean() }),
  v.strictObject({ kind: v.literal('caption') }),
  v.strictObject({ kind: v.literal('voice'), label: v.string() }),
])
const SpeechItemSchema = v.strictObject({
  speaker: ComicSpeakerSchema,
  line: v.string(),
  tone: v.optional(v.string()),
})
const DesignReferenceSchema = v.strictObject({
  key: v.pipe(v.string(), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase kebab-case design key')),
  sourcePath: v.pipe(v.string(), v.regex(/^input\/(?!.*(?:^|\/)\.\.(?:\/|$)).+\.(?:png|webp|jpg|jpeg)$/i, 'Expected a safe project-relative image path below input/')),
  usage: v.string(),
})
const PanelSchema = v.strictObject({
  number: v.number(),
  description: v.string(),
  shotPlan: v.string(),
  characterKeys: v.array(CharacterKeySchema),
  speech: v.array(SpeechItemSchema),
  sourceSegmentIds: v.array(v.string()),
  locationKey: v.string(),
  designReferences: v.optional(v.array(DesignReferenceSchema)),
})
const PanelBundlePanelSchema = v.strictObject({
  number: v.number(),
  description: v.string(),
  shotPlan: v.string(),
  characterKeys: v.array(CharacterKeySchema),
  speech: v.array(SpeechItemSchema),
  sourceSegmentIds: v.array(v.string()),
  sourceSegments: v.array(StructuredScriptSourceSegmentSchema),
  locationKey: v.string(),
  locationSnapshotId: v.string(),
  designReferences: v.optional(v.array(DesignReferenceSchema)),
  designSnapshotId: v.optional(v.string()),
  designReferenceKeys: v.optional(v.array(v.string())),
})
export const CharacterReferenceSchema = v.strictObject({
  schemaVersion: v.literal(3),
  characters: v.array(AuthoredCharacterDetailsSchema),
  groupAliases: v.array(v.strictObject({ alias: v.string(), characterKeys: v.array(CharacterKeySchema) })),
})
export const PromptsConfigSchema = v.object({
  'Scene Prompts': ScenePromptsSchema,
  'Sketch Prompts': SketchPromptsSchema,
  'Character Sketch Prompts': CharacterSketchPromptsSchema,
  'Image Prompt Variations': ImagePromptVariationsSchema,
})
export const StructuredScriptDataSchema = v.strictObject({
  schemaVersion: v.literal(3),
  scriptSlug: v.string(),
  sourceFile: v.string(),
  document: v.strictObject({
    heading: v.string(), label: v.optional(v.string()), title: v.string(), metadata: v.array(StructuredScriptMetadataEntrySchema),
  }),
  scene: v.strictObject({
    heading: v.string(), section: v.optional(v.string()), title: v.string(), location: StructuredScriptLocationSchema,
  }),
  characterKeys: v.array(CharacterKeySchema),
  beats: v.array(StructuredScriptBeatSchema),
  sourceSegments: v.array(StructuredScriptSourceSegmentSchema),
})
export const ScenePromptDataSchema = v.strictObject({
  schemaVersion: v.literal(4),
  title: v.string(),
  location: v.string(),
  panels: v.array(PanelSchema),
})
export const PanelBundleDataSchema = v.strictObject({
  schemaVersion: v.literal(4),
  snapshotId: v.string(),
  title: v.string(),
  location: v.string(),
  panels: v.array(PanelBundlePanelSchema),
})
export const STRUCTURED_SCRIPT_JSON_SCHEMA_NAME = 'structured_script_data_v3'
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' as const }] })
const characterArray = (keys: readonly string[]) => ({
  type: 'array' as const, items: { type: 'string' as const, enum: [...keys] },
})
const speakerJsonSchema = (keys: readonly string[]) => ({
  anyOf: [
    { type: 'object', properties: { kind: { type: 'string', enum: ['character'] }, characterKey: { type: 'string', enum: [...keys] }, offscreen: { type: 'boolean' } }, required: ['kind', 'characterKey', 'offscreen'], additionalProperties: false },
    { type: 'object', properties: { kind: { type: 'string', enum: ['caption'] } }, required: ['kind'], additionalProperties: false },
    { type: 'object', properties: { kind: { type: 'string', enum: ['voice'] }, label: { type: 'string' } }, required: ['kind', 'label'], additionalProperties: false },
  ],
})

export const buildStructuredScriptJsonSchema = (characterKeys: readonly string[]) => ({
  name: STRUCTURED_SCRIPT_JSON_SCHEMA_NAME,
  strict: true,
  schema: {
    type: 'object' as const,
    properties: {
      schemaVersion: { type: 'integer', enum: [3] }, scriptSlug: { type: 'string' }, sourceFile: { type: 'string' },
      document: { type: 'object', properties: {
        heading: { type: 'string' }, label: nullable({ type: 'string' }), title: { type: 'string' },
        metadata: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: nullable({ type: 'string' }), raw: { type: 'string' } }, required: ['label', 'value', 'raw'], additionalProperties: false } },
      }, required: ['heading', 'label', 'title', 'metadata'], additionalProperties: false },
      scene: { type: 'object', properties: {
        heading: { type: 'string' }, section: nullable({ type: 'string' }), title: { type: 'string' },
        location: { type: 'object', properties: { key: { type: 'string' }, raw: { type: 'string' }, type: nullable({ type: 'string' }), place: nullable({ type: 'string' }) }, required: ['key', 'raw', 'type', 'place'], additionalProperties: false },
      }, required: ['heading', 'section', 'title', 'location'], additionalProperties: false },
      characterKeys: characterArray(characterKeys),
      beats: { type: 'array', items: { type: 'object', properties: {
        index: { type: 'integer' }, type: { type: 'string', enum: [...STRUCTURED_SCRIPT_BEAT_TYPES] }, text: { type: 'string' },
        characterKeys: characterArray(characterKeys),
        rawMentions: { type: 'array', items: { type: 'object', properties: { raw: { type: 'string' }, characterKeys: characterArray(characterKeys) }, required: ['raw', 'characterKeys'], additionalProperties: false } },
        speakerKey: nullable({ type: 'string', enum: [...characterKeys] }), speakerLabel: nullable({ type: 'string' }), delivery: nullable({ type: 'string' }),
        location: { type: 'object', properties: { key: { type: 'string' }, raw: { type: 'string' }, type: nullable({ type: 'string' }), place: nullable({ type: 'string' }) }, required: ['key', 'raw', 'type', 'place'], additionalProperties: false },
      }, required: ['index', 'type', 'text', 'characterKeys', 'rawMentions', 'speakerKey', 'speakerLabel', 'delivery', 'location'], additionalProperties: false } },
      sourceSegments: { type: 'array', items: { type: 'object', properties: {
        id: { type: 'string' }, type: { type: 'string', enum: [...STRUCTURED_SCRIPT_BEAT_TYPES] }, text: { type: 'string' }, rawMarkdown: nullable({ type: 'string' }), beatIndex: nullable({ type: 'integer' }), speakerKey: nullable({ type: 'string', enum: [...characterKeys] }), speakerLabel: nullable({ type: 'string' }), delivery: nullable({ type: 'string' }),
        location: { type: 'object', properties: { key: { type: 'string' }, raw: { type: 'string' }, type: nullable({ type: 'string' }), place: nullable({ type: 'string' }) }, required: ['key', 'raw', 'type', 'place'], additionalProperties: false },
      }, required: ['id', 'type', 'text', 'rawMarkdown', 'beatIndex', 'speakerKey', 'speakerLabel', 'delivery', 'location'], additionalProperties: false } },
    },
    required: ['schemaVersion', 'scriptSlug', 'sourceFile', 'document', 'scene', 'characterKeys', 'beats', 'sourceSegments'], additionalProperties: false,
  },
})

export const buildSceneJsonSchema = (characterKeys: readonly string[]) => ({
  name: 'scene_prompt_data_v4', strict: true,
  schema: { type: 'object' as const, properties: {
    schemaVersion: { type: 'integer', enum: [4] }, title: { type: 'string' }, location: { type: 'string' },
    panels: { type: 'array', items: { type: 'object', properties: {
      number: { type: 'integer' }, description: { type: 'string' }, shotPlan: { type: 'string' }, characterKeys: characterArray(characterKeys), sourceSegmentIds: { type: 'array', items: { type: 'string' } }, locationKey: { type: 'string' },
      designReferences: { type: 'array', items: { type: 'object', properties: { key: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }, sourcePath: { type: 'string', pattern: '^input/.+\\.(?:png|webp|jpg|jpeg)$' }, usage: { type: 'string' } }, required: ['key', 'sourcePath', 'usage'], additionalProperties: false } },
      speech: { type: 'array', items: { type: 'object', properties: { speaker: speakerJsonSchema(characterKeys), line: { type: 'string' }, tone: nullable({ type: 'string' }) }, required: ['speaker', 'line', 'tone'], additionalProperties: false } },
    }, required: ['number', 'description', 'shotPlan', 'characterKeys', 'speech', 'sourceSegmentIds', 'locationKey', 'designReferences'], additionalProperties: false } },
  }, required: ['schemaVersion', 'title', 'location', 'panels'], additionalProperties: false },
})

const assertKnownUniqueKeys = (values: readonly string[], catalog: CharacterCatalogService, context: string): void => {
  const seen = new Set<string>()
  for (const value of values) {
    catalog.requireKey(value)
    if (seen.has(value)) throw ValidationError(`Duplicate character key "${value}" in ${context}`, { stage: 'comic:schema' })
    seen.add(value)
  }
}

const positiveDepictionText = (value: string): string => value
  .split(/(?<=[.!?;])\s+/)
  .filter(sentence => !/^\s*(?:exclude|never|no\b|do not\b|don't\b|without\b)/iu.test(sentence))
  .join(' ')

export const validateStructuredScriptCharacters = (data: v.InferOutput<typeof StructuredScriptDataSchema>, catalog: CharacterCatalogService): void => {
  assertKnownUniqueKeys(data.characterKeys, catalog, 'structured script characterKeys')
  for (const beat of data.beats) {
    assertKnownUniqueKeys(beat.characterKeys, catalog, `beat ${beat.index} characterKeys`)
    if (beat.speakerKey) catalog.requireKey(beat.speakerKey)
    for (const mention of beat.rawMentions) assertKnownUniqueKeys(mention.characterKeys, catalog, `beat ${beat.index} mention`)
  }
  for (const segment of data.sourceSegments) if (segment.speakerKey) catalog.requireKey(segment.speakerKey)
}

export const validateSceneCharacters = (data: v.InferOutput<typeof ScenePromptDataSchema>, catalog: CharacterCatalogService): void => {
  for (const panel of data.panels) {
    if (!panel.shotPlan.trim()) throw ValidationError(`Panel ${panel.number} shotPlan must be exhaustive prose, not blank`, { stage: 'comic:schema' })
    assertKnownUniqueKeys(panel.characterKeys, catalog, `panel ${panel.number} characterKeys`)
    const designKeys = panel.designReferences?.map(reference => reference.key) ?? []
    if (new Set(designKeys).size !== designKeys.length) throw ValidationError(`Duplicate design reference key in panel ${panel.number}`, { stage: 'comic:schema' })
    for (const reference of panel.designReferences ?? []) if (!reference.usage.trim()) throw ValidationError(`Panel ${panel.number} design reference "${reference.key}" usage must not be blank`, { stage: 'comic:schema' })
    if (new Set(panel.sourceSegmentIds).size !== panel.sourceSegmentIds.length) {
      throw ValidationError(`Duplicate source segment ID in panel ${panel.number} sourceSegmentIds`, { stage: 'comic:schema' })
    }
    const visible = new Set(panel.characterKeys)
    const visualText = `${panel.description}\n${panel.shotPlan}`.normalize('NFKC').replace(/[\u2018\u2019]/g, "'")
    for (const characterKey of panel.characterKeys) {
      const character = catalog.get(catalog.requireKey(characterKey))
      for (const rule of character.sceneTextRules ?? []) {
        const testedText = rule.kind === 'forbidden' ? positiveDepictionText(visualText) : visualText
        const matches = new RegExp(rule.pattern, 'iu').test(testedText)
        if ((rule.kind === 'required' && !matches) || (rule.kind === 'forbidden' && matches)) {
          const expectation = rule.kind === 'required' ? 'must satisfy' : 'must not violate'
          throw ValidationError(
            `Panel ${panel.number} depiction of "${characterKey}" ${expectation} canonical rule: ${rule.description}`,
            { stage: 'comic:schema' }
          )
        }
      }
    }
    for (const item of panel.speech) {
      if (item.speaker.kind !== 'character') continue
      catalog.requireKey(item.speaker.characterKey)
      if (item.speaker.offscreen && visible.has(item.speaker.characterKey)) {
        throw ValidationError(`Panel ${panel.number} offscreen speaker "${item.speaker.characterKey}" must not appear in characterKeys`, { stage: 'comic:schema' })
      }
      if (!item.speaker.offscreen && !visible.has(item.speaker.characterKey)) {
        throw ValidationError(`Panel ${panel.number} on-screen speaker "${item.speaker.characterKey}" must appear in characterKeys`, { stage: 'comic:schema' })
      }
    }
  }
}
