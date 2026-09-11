import { existsSync } from 'node:fs'
import * as v from 'valibot'
import type { BlockingDrafterCharacterInput, BlockingDrafterLocationInput, BlockingLocationSpecification, BlockingPlanCallEstimate, BlockingPlanInputs, StructuredScriptData } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { buildBlockingDrafterPrompt, extractBracketPanelNotes, extractFixedAnchorSentence } from '../../comic-utils/blocking-plan-prompt'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { readLocationReferenceCatalog, requireCurrentLocationReference, resolveLocationCatalogEntry } from '../../comic-utils/location-reference'
import { getStructuredScriptPath } from '../../comic-utils/project-paths'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'

import { BLOCKING_PLAN_IMAGE_INPUT_UNITS, BLOCKING_PLAN_MAX_CALLS, BLOCKING_PLAN_OUTPUT_UNITS_PER_CALL } from './blocking-draft-defaults'
const STAGE = 'comic:blocking-plan'
export const collectSceneLocationKeys = (structuredScript: StructuredScriptData): string[] => {
  const keys: string[] = []
  const push = (key: string | undefined): void => { if (key && !keys.includes(key)) keys.push(key) }
  push(structuredScript.scene.location.key)
  for (const segment of structuredScript.sourceSegments) push(segment.location.key)
  return keys
}

export const estimateBlockingPlanCalls = (structuredScript: StructuredScriptData, options: { promptText?: string | undefined } = {}): BlockingPlanCallEstimate => {
  const locationCount = collectSceneLocationKeys(structuredScript).length
  const promptChars = options.promptText?.length ?? (JSON.stringify(structuredScript.sourceSegments).length + 6000)
  return {
    maxCalls: BLOCKING_PLAN_MAX_CALLS,
    outputUnitsPerCall: BLOCKING_PLAN_OUTPUT_UNITS_PER_CALL,
    inputUnitsPerCall: Math.ceil(promptChars / 4),
    imageInputUnitsPerCall: locationCount * BLOCKING_PLAN_IMAGE_INPUT_UNITS,
    locationCount,
    segmentCount: structuredScript.sourceSegments.length,
  }
}

export const loadBlockingPlanInputs = async (sceneSlug: string, options: { locationPlans?: BlockingPlanInputs['locationPlans']; requireEstablishingImages?: boolean | undefined } = {}): Promise<BlockingPlanInputs> => {
  const structuredScriptPath = getStructuredScriptPath(sceneSlug)
  if (!existsSync(structuredScriptPath)) throw ValidationError(`Structured script not found at ${structuredScriptPath}. Run "bun autoshow comic draft-scenes <script-path> --only structure" first.`, { stage: STAGE })
  const structuredScript = await parseJsonFile(structuredScriptPath, StructuredScriptDataSchema)
  const structuredScriptSha256 = sha256Bytes(new Uint8Array(await Bun.file(structuredScriptPath).arrayBuffer()))
  const catalog = loadCharacterCatalog()
  const locationCatalog = await readLocationReferenceCatalog()
  const locationKeys = collectSceneLocationKeys(structuredScript)
  const locations: BlockingDrafterLocationInput[] = []
  const locationSpecifications: Record<string, BlockingLocationSpecification> = {}
  const establishingImages: Array<{ locationKey: string; path: string }> = []
  for (const key of locationKeys) {
    const entry = resolveLocationCatalogEntry(key, locationCatalog)
    const geometry = options.locationPlans?.plans.find(plan => plan.locationKey === entry.key)
    locations.push({ key: entry.key, name: entry.name, specification: entry.specification, fixedAnchorSentence: extractFixedAnchorSentence(entry.specification), ...(geometry ? { geometry } : {}) })
    locationSpecifications[entry.key] = { key: entry.key, name: entry.name, specification: entry.specification }
    if (options.requireEstablishingImages) {
      const current = await requireCurrentLocationReference(entry.key)
      establishingImages.push({ locationKey: entry.key, path: current.views[0]!.imagePath })
    }
  }
  return { sceneSlug, structuredScript, structuredScriptSha256, catalog, locationKeys, locations, locationSpecifications, establishingImages, locationPlans: options.locationPlans }
}

const catalogCharacterInputs = (catalog: BlockingPlanInputs['catalog']): BlockingDrafterCharacterInput[] => catalog.characters.map(character => ({
  key: character.key,
  name: character.name,
  description: character.description,
  aliases: character.aliases,
  ...(character.variantOf ? { variantOf: character.variantOf } : {}),
  ...(character.distinguishFrom ? { distinguishFrom: character.distinguishFrom } : {}),
  ...(character.wardrobe ? { wardrobe: character.wardrobe } : {}),
}))

export const buildBlockingDrafterPromptFromInputs = (inputs: BlockingPlanInputs, options: { bindPanels?: v.InferOutput<typeof ScenePromptDataSchema>['panels'] | undefined; validationErrors?: readonly string[] | undefined } = {}): string => buildBlockingDrafterPrompt({
  sceneSlug: inputs.sceneSlug,
  sceneTitle: inputs.structuredScript.scene.title,
  segments: inputs.structuredScript.sourceSegments,
  locations: inputs.locations,
  characters: catalogCharacterInputs(inputs.catalog),
  panelNotes: extractBracketPanelNotes(inputs.structuredScript),
  bindPanels: options.bindPanels?.map(panel => ({ number: panel.number, description: panel.description, shotPlan: panel.shotPlan, characterKeys: panel.characterKeys, sourceSegmentIds: panel.sourceSegmentIds, locationKey: panel.locationKey })),
  validationErrors: options.validationErrors,
})
