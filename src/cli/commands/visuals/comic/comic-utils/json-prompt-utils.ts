import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import { err, comicLog } from './comic-logger'
import { StructuredScriptDataSchema } from '../schemas/schemas'
import { BlockingPlanSchema } from '../schemas/blocking-plan-schemas'
import { getCharacterReferenceAliases, loadCharacterCatalog } from './character-reference-config'
import { getStructuredScriptPath, getDraftPromptPath } from './project-paths'
import { getBlockingPlanPath, getBlockingPromptPath } from './blocking-plan-paths'
import { buildScenePlanSection, SCENE_PLAN_SECTION_HEADING } from './blocking-plan-prompt'
import { readLocationPlans } from './location-plan-records'
import { formatRecapMontagePromptSection, resolveRecapMontageExpansions } from './recap-montage-utils'
import { buildBlockingDrafterPromptFromInputs, loadBlockingPlanInputs } from '../comic-commands/draft-scenes/generate-blocking-plan'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import type { BlockingPlan, RecapMontageExpansion, StructuredScriptData } from '~/types'

export const SCENE_PLAN_SECTION_MARKER = SCENE_PLAN_SECTION_HEADING

export const stripScenePlanSection = (content: string): string => {
  const index = content.indexOf(SCENE_PLAN_SECTION_MARKER)
  return index === -1 ? content : content.slice(0, index).replace(/\s+$/, '')
}

export const appendScenePlanSection = (content: string, plan: BlockingPlan): string =>
  `${stripScenePlanSection(content)}\n\n${buildScenePlanSection(plan)}`

export const readBlockingPlanIfPresent = async (sceneSlug: string): Promise<{ plan: BlockingPlan; planPath: string; planSha256: string } | undefined> => {
  const planPath = getBlockingPlanPath(sceneSlug)
  if (!existsSync(planPath)) return undefined
  const plan = await parseJsonFile(planPath, BlockingPlanSchema)
  const planSha256 = sha256Bytes(new Uint8Array(await Bun.file(planPath).arrayBuffer()))
  return { plan, planPath, planSha256 }
}


export const parseJsonFile = async <TSchema extends v.GenericSchema>(
  filePath: string,
  schema: TSchema
): Promise<v.InferOutput<TSchema>> => {
  try {
    const content = await Bun.file(filePath).text()
    const data = JSON.parse(content)
    return v.parse(schema, data)
  } catch (error) {
    if (v.isValiError(error)) {
      err(error)
      throw ValidationError(`Invalid data in ${filePath}`, {
      stage: 'comic:json-prompt',
      ...(error instanceof Error ? { cause: error } : {})
    })
    }
    throw error
  }
}

const formatValidCharacterNames = (characterNames: readonly string[]): string =>
  characterNames.map(name => `- ${name}`).join('\n')

const formatCharacterAliasGuidance = (aliases: Record<string, string>): string =>
  Object.entries(aliases)
    .map(([alias, character]) => `- ${alias} -> ${character}`)
    .join('\n')

const formatCharacterCanon = (catalog: ReturnType<typeof loadCharacterCatalog>): string =>
  catalog.characters.map(character => [
    `- ${character.key}: ${character.description}`,
    ...(character.sceneTextRules ?? []).map(rule => `  - ${rule.kind === 'required' ? 'REQUIRED' : 'FORBIDDEN'}: ${rule.description}`),
  ].join('\n')).join('\n')

const buildJsonPromptTemplate = (
  characterNames: readonly string[],
  aliases: Record<string, string>,
  characterCanon: string,
): string => {
  const exampleCharacterKey = characterNames[0]
  const exampleCharacterKeys = exampleCharacterKey ? JSON.stringify([exampleCharacterKey]) : '[]'
  const exampleSpeaker = exampleCharacterKey
    ? `{ "kind": "character", "characterKey": ${JSON.stringify(exampleCharacterKey)}, "offscreen": false }`
    : '{ "kind": "caption" }'

  return `# Convert Structured Script to Comic Panel JSON

Return only schemaVersion 4 scene JSON. Preserve beat order, exact dialogue, and every source segment ID. Convert direction, transition, and panel-note text into visual staging, never speech. Use \`delivery\` only as optional tone.

Copy each panel's \`locationKey\` exactly from its assigned source segments. A panel may contain source segments from exactly one location. Split the panel at every location transition; never combine segments carrying different location keys.

Set each panel's \`designReferences\` to an empty array during automated scene drafting. Reviewed projects may later attach safe project-relative immutable design references before rebuilding panel bundles.

Write an exhaustive prose \`shotPlan\` for every panel. It must explicitly specify camera distance, camera angle and position, composition, every visible character's position within the comic frame, depth, facing, pose, expression, eyeline, relationships to other characters and fixed location features, props, balloon placement, and exclusions.

Canonical character canon is non-negotiable and has highest visual precedence for identity, physical embodiment, projection/display medium, anatomy, costume, and character-specific required props. If source staging contradicts character canon, preserve the narrative action but reinterpret the contradictory depiction so it obeys canon. Never repeat the contradiction in a panel description or shotPlan. After character canon, precedence is: (1) the scene blocking plan's stage marks, camera setups, and canonical location geometry when a plan section is present, (2) script-authored action, staging, and framing that does not contradict character canon or the plan, (3) exact script cast, dialogue, and speaker requirements, and (4) inferred shot-plan details only where the script and the plan are silent.

When a \`## Scene blocking plan\` section is present below, every panel must also carry a \`blocking\` object citing \`cameraSetupId\` from the plan's camera setups, an optional \`stageStateId\` override, \`croppedOnStage\` entries (each with a reason) for on-stage characters the camera sees but the panel deliberately crops out, and \`axisBreak\` (null unless the panel deliberately crosses the action axis, in which case it cites one of the panel's own source segment ids with a reason). Omit \`blocking\` entirely when no plan section is present.

Canonical character descriptions and enforceable depiction rules:
${characterCanon}

\`panel.characterKeys\` is the sole authority for visible characters. Never infer or add visible characters from descriptions, dialogue text, or source segments. Include every script-required visible character, with no arbitrary per-panel cast-count ceiling. Keys must be unique and chosen only from this catalog:
${formatValidCharacterNames(characterNames)}

Resolve source aliases to keys, but never put aliases or display names into an identity field:
${formatCharacterAliasGuidance(aliases)}

\`\`\`json
{
  "schemaVersion": 4,
  "title": "SCENE TITLE FROM SCRIPT",
  "location": "LOCATION FROM SCRIPT HEADER",
  "panels": [
    {
      "number": 1,
      "description": "Visual staging only.",
      "shotPlan": "Exhaustive prose camera, composition, blocking, acting, eyeline, props, balloon placement, and exclusions plan.",
      "characterKeys": ${exampleCharacterKeys},
      "speech": [
        {
          "speaker": ${exampleSpeaker},
          "line": "Exact dialogue from the script"
        }
      ],
      "sourceSegmentIds": ["beat-0001"],
      "locationKey": "canonical-location-key",
      "designReferences": []
    }
  ]
}
\`\`\`

Speaker invariants: an on-screen character speaker must be in \`characterKeys\`; an offscreen character speaker must not be. Use \`{ "kind": "caption" }\` for narration and \`{ "kind": "voice", "label": "..." }\` for uncatalogued voices. Each panel may contain only one character's dialogue; split sequential speakers across panels. Every source segment ID must appear at least once.`
}

const formatPromptExcerpt = (text: string): string => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

const formatSourceSegmentChecklist = (structuredScript: StructuredScriptData): string => {
  return structuredScript.sourceSegments
    .map(segment => {
      const beat = segment.beatIndex ? `, beat ${segment.beatIndex}` : ''
      return `- ${segment.id} (${segment.type}${beat}): ${formatPromptExcerpt(segment.text)}`
    })
    .join('\n')
}

const formatStructuredScriptPrompt = (
  structuredScript: StructuredScriptData,
  recapMontageExpansions: RecapMontageExpansion[]
): string => {
  const recapMontageSection = formatRecapMontagePromptSection(recapMontageExpansions)
  const catalog = loadCharacterCatalog()

  return [
    '# Structured Script JSON',
    '',
    '```json',
    JSON.stringify(structuredScript, null, 2),
    '```',
    '',
    '---',
    '',
    buildJsonPromptTemplate(catalog.characterKeys, getCharacterReferenceAliases(), formatCharacterCanon(catalog)),
    '',
    '## Required Source Segment ID Checklist',
    'Before returning JSON, verify that every exact ID below appears in at least one panel `sourceSegmentIds` array.',
    '',
    formatSourceSegmentChecklist(structuredScript),
    ...(recapMontageSection ? ['', recapMontageSection] : []),
  ].join('\n')
}

const writeBlockingDrafterPrompt = async (sceneSlug: string): Promise<string | undefined> => {
  const outputPath = getBlockingPromptPath(sceneSlug)
  try {
    const locationPlans = await readLocationPlans()
    const inputs = await loadBlockingPlanInputs(sceneSlug, { locationPlans, requireEstablishingImages: false })
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, buildBlockingDrafterPromptFromInputs(inputs))
    comicLog.line('blocking-prompt generated', [`file=${basename(outputPath)}`, `locations=${inputs.locationKeys.length}`])
    return outputPath
  } catch (error) {
    comicLog.line('blocking-prompt skipped', [`reason=${error instanceof Error ? error.message : String(error)}`])
    return undefined
  }
}

export const generateJsonPrompt = async (
  sceneSlug: string
): Promise<{ filesProcessed: number; sourceSegments: number; recapMontages: number }> => {
  const stats = { filesProcessed: 0 }

  try {
    const structuredScriptPath = getStructuredScriptPath(sceneSlug)
    const structuredScript = await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
    const recapMontageExpansions = await resolveRecapMontageExpansions(structuredScript)

    const outputPath = getDraftPromptPath(sceneSlug)
    await mkdir(dirname(outputPath), { recursive: true })
    const existingPlan = await readBlockingPlanIfPresent(sceneSlug)
    const basePrompt = formatStructuredScriptPrompt(structuredScript, recapMontageExpansions)
    const combinedContent = existingPlan ? appendScenePlanSection(basePrompt, existingPlan.plan) : basePrompt

    await Bun.write(outputPath, combinedContent)
    stats.filesProcessed++
    comicLog.line('draft-prompt generated', [
      `file=${basename(outputPath)}`,
      `sourceSegments=${structuredScript.sourceSegments.length}`,
      recapMontageExpansions.length > 0 ? `recapMontages=${recapMontageExpansions.length}` : undefined,
      existingPlan ? `blockingPlan=${existingPlan.planSha256.slice(0, 12)}` : undefined,
    ])
    if (await writeBlockingDrafterPrompt(sceneSlug)) stats.filesProcessed++
    return {
      ...stats,
      sourceSegments: structuredScript.sourceSegments.length,
      recapMontages: recapMontageExpansions.length,
    }
  } catch (error) {
    err(
      `Failed to process ${sceneSlug}:`,
      error instanceof Error ? error.message : String(error)
    )
    throw error
  }
}
