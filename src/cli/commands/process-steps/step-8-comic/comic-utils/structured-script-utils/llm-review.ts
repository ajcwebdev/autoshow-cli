import * as v from 'valibot'
import { buildStructuredScriptJsonSchema, STRUCTURED_SCRIPT_JSON_SCHEMA_NAME, StructuredScriptDataSchema } from '../../schemas/schemas'
import { runComicStructuredLlm } from './run-structured-llm'
import type { LlmModel, StructuredScriptData, StructuredScriptReviewResponse } from '~/types'
import { getCharacterAliasGuidance } from './structured-script-constants'
import { getCharacterKeys } from '../character-reference-config'
import { normalizeStructuredScriptData } from './structured-data-normalization'
import { isRecord } from '~/utils/value-helpers'
import { extractLlmJsonPayload } from '../llm-json-payload'

const parseStructuredScriptReviewResponse = (
  content: string,
  options: { lenient: boolean }
): unknown => {
  return JSON.parse(options.lenient ? extractLlmJsonPayload(content, 'comic:structured-review') : content)
}

const deleteNullProperty = (value: Record<string, unknown>, key: string): void => {
  if (value[key] === null) {
    delete value[key]
  }
}

const stripStructuredScriptNullableOptionals = (data: unknown): unknown => {
  if (!isRecord(data)) {
    return data
  }

  const document = data['document']
  if (isRecord(document)) {
    deleteNullProperty(document, 'label')

    if (Array.isArray(document['metadata'])) {
      for (const entry of document['metadata']) {
        if (isRecord(entry)) {
          deleteNullProperty(entry, 'value')
        }
      }
    }
  }

  const scene = data['scene']
  if (isRecord(scene)) {
    deleteNullProperty(scene, 'section')

    const location = scene['location']
    if (isRecord(location)) {
      deleteNullProperty(location, 'type')
      deleteNullProperty(location, 'place')
    }
  }

  const beats = data['beats']
  if (Array.isArray(beats)) {
    for (const beat of beats) {
      if (isRecord(beat)) {
        deleteNullProperty(beat, 'speakerKey')
        deleteNullProperty(beat, 'speakerLabel')
        deleteNullProperty(beat, 'delivery')
        deleteNullProperty(beat, 'speakerKeys')
        const location = beat['location']
        if (isRecord(location)) {
          deleteNullProperty(location, 'type')
          deleteNullProperty(location, 'place')
        }
      }
    }
  }

  const sourceSegments = data['sourceSegments']
  if (Array.isArray(sourceSegments)) {
    for (const sourceSegment of sourceSegments) {
      if (isRecord(sourceSegment)) {
        deleteNullProperty(sourceSegment, 'rawMarkdown')
        deleteNullProperty(sourceSegment, 'beatIndex')
        deleteNullProperty(sourceSegment, 'speakerKey')
        deleteNullProperty(sourceSegment, 'speakerLabel')
        deleteNullProperty(sourceSegment, 'delivery')
        deleteNullProperty(sourceSegment, 'speakerKeys')
        const location = sourceSegment['location']
        if (isRecord(location)) {
          deleteNullProperty(location, 'type')
          deleteNullProperty(location, 'place')
        }
      }
    }
  }

  return data
}

const formatStructuredScriptReviewPrompt = (
  sourceMarkdown: string,
  provisional: StructuredScriptData,
  characterNames: readonly string[]
): string => {
  return [
    'Review the structured script JSON against the original markdown script and correct any mistakes.',
    '',
    'Requirements:',
    '- Return only JSON that matches the provided schema.',
    '- Preserve exact dialogue and scene text from the markdown script.',
    '- Do not invent metadata, beats, characters, locations, or transitions that are not present.',
    '- Use only these beat types: narration, dialogue, direction, transition, panel-note.',
    '- Use `panel-note` for bracketed staging or panel layout notes from the script (e.g. "[Wide shot: ...]", "[3-4 panels showing...]"). Preserve the text exactly, without the outer brackets.',
    '- Keep parenthetical delivery notes attached to the following dialogue in `delivery` when they describe line delivery.',
    '- Use a `direction` beat for standalone parenthetical interruptions like `(beat)` when they sit between dialogue lines.',
    '- Keep `speakerLabel` as the original bold label and `speakerKey` as the canonical character key when unambiguous.',
    '- Keep `rawMentions` limited to exact character mentions present in each beat text.',
    '- Keep `sourceSegments` as deterministic source coverage records; do not paraphrase or omit source segment text.',
    '- Preserve `scene.soundscape` exactly. Sound directives, cue IDs, anchors, source spans, and required/optional policy are derived locally and must never be invented or changed.',
    '- Preserve the parser-assigned `location` object on every beat and source segment exactly. Location keys are resolved locally from the canonical catalog and must never be guessed or changed.',
    '- Keep beat indexes sequential starting at 1.',
    '- Keep `scriptSlug` and `sourceFile` aligned to the source file shown below.',
    `- Resolve character aliases to canonical names: ${getCharacterAliasGuidance()}.`,
    '',
    `Allowed canonical character keys: ${characterNames.join(', ')}`,
    '',
    'Original script markdown:',
    '```md',
    sourceMarkdown.trim(),
    '```',
    '',
    'Current structured script JSON:',
    '```json',
    JSON.stringify(provisional, null, 2),
    '```',
  ].join('\n')
}

export const reviewStructuredScriptWithLlm = async (
  sourceMarkdown: string,
  provisional: StructuredScriptData,
  model: LlmModel,
  scheduling: Parameters<typeof runComicStructuredLlm>[3] = {}
): Promise<{ structuredScript: StructuredScriptData; response: StructuredScriptReviewResponse; durationMs: number }> => {
  const characterNames = getCharacterKeys()
  const prompt = formatStructuredScriptReviewPrompt(sourceMarkdown, provisional, characterNames)
  const requestStart = Date.now()
  const { text, metadata } = await runComicStructuredLlm(prompt, {
    schemaName: STRUCTURED_SCRIPT_JSON_SCHEMA_NAME,
    valibotSchema: StructuredScriptDataSchema,
    jsonSchema: buildStructuredScriptJsonSchema(characterNames).schema,
  }, model, scheduling)
  const durationMs = Date.now() - requestStart

  const parsed = stripStructuredScriptNullableOptionals(
    parseStructuredScriptReviewResponse(text, { lenient: true })
  )

  const normalized = normalizeStructuredScriptData(
    v.parse(StructuredScriptDataSchema, parsed),
    {
      scriptSlug: provisional.scriptSlug,
      sourceFile: provisional.sourceFile,
      sourceIdentity: provisional.sourceIdentity,
      sourceSegments: provisional.sourceSegments,
      beatLocations: provisional.beats.map(beat => beat.location),
      sceneLocation: provisional.scene.location,
      sceneSoundscape: provisional.scene.soundscape,
    }
  )

  return {
    structuredScript: v.parse(StructuredScriptDataSchema, normalized),
    response: {
      model: metadata.providerReturnedModel ?? metadata.llmModel,
      text,
      usage: {
        input_tokens: metadata.inputTokenCount,
        output_tokens: metadata.outputTokenCount,
        total_tokens: metadata.inputTokenCount + metadata.outputTokenCount,
      },
    },
    durationMs,
  }
}
