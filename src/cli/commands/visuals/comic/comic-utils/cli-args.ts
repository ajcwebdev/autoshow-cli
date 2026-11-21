import { REFERENCE_LOCATION_ONLY_FLAGS } from '~/cli/flags/reference-option-contract'
import { parseHostedConcurrencyMode } from '~/cli/options/option-resolution/flag-readers'
import type {
  ComicParsedArgs,
  ParsedDraftCommandArgs,
  ParsedDraftTreatmentArgs,
  ParsedGenerateImagesArgs,
  ParsedReferenceSketchArgs,
  ParsedReviewArgs
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assignSharedImageRenderOptions, enabledFlag, parseComicLlmSelector, parseConcurrencyValue, readScriptPath, readSingleComicImageSelector, stringFlag } from './comic-argument-readers'
import { finalizeComicImageOptions, validateComicImageTarget } from './comic-image-option-policies'
import { parsePanelSelector } from '../comic-commands/generate-images/comic-page-utils'
import { coerceComicImageScalars } from './comic-image-scalar-options'
import {
  validateImageSizeForModels,
} from './image-size'
import {
  DEFAULT_TREATMENT_CATALOG_POLICY,
  DEFAULT_TREATMENT_PANEL_COUNT,
  DEFAULT_TREATMENT_SCENE_NUMBER,
  DEFAULT_TREATMENT_VOICE_PACING,
  MAX_TREATMENT_PANEL_COUNT,
  TREATMENT_CATALOG_POLICIES,
  TREATMENT_VOICE_PACINGS
} from '../comic-commands/draft-treatment/treatment-defaults'

export { DEFAULT_LLM_MODEL } from './comic-argument-defaults'

export const REFERENCE_SKETCH_COMMAND = 'reference-sketch'
export const DRAFT_SCENES_COMMAND = 'draft-scenes'
export const DRAFT_TREATMENT_COMMAND = 'draft-treatment'
export const GENERATE_IMAGES_COMMAND = 'generate-images'
export const GENERATE_AUDIO_COMMAND = 'generate-audio'
export const REVIEW_COMMAND = 'review'

import { DRAFT_SCENES_ONLY_VALUES, RETIRED_PREPARE_ONLY_VALUES } from '~/cli/flags/comic-stage-contract'

const DRAFT_SCENES_ONLY_OPTIONS = new Set<string>(DRAFT_SCENES_ONLY_VALUES)
const RETIRED_PREPARE_ONLY_OPTIONS = new Set<string>(RETIRED_PREPARE_ONLY_VALUES)

const TWO_DIGIT_PATTERN = /^\d{2}$/
const KEBAB_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TREATMENT_CATALOG_POLICY_OPTIONS = new Set<string>(TREATMENT_CATALOG_POLICIES)
const TREATMENT_VOICE_PACING_OPTIONS = new Set<string>(TREATMENT_VOICE_PACINGS)

export const parsePanelRange = (value: string): ParsedDraftTreatmentArgs['panelRange'] => {
  const match = value.match(/^(\d+)(?:-(\d+))?$/)
  if (!match) throw UsageError(`Invalid panel count "${value}". Expected an integer from 1 through ${MAX_TREATMENT_PANEL_COUNT} or a range such as 20-25.`)
  const minimum = Number(match[1])
  const maximum = match[2] === undefined ? minimum : Number(match[2])
  if (minimum < 1 || maximum > MAX_TREATMENT_PANEL_COUNT) throw UsageError(`Invalid panel count "${value}". Expected an integer from 1 through ${MAX_TREATMENT_PANEL_COUNT} or a range such as 20-25.`)
  if (minimum > maximum) throw UsageError(`Invalid panel count "${value}". The range minimum must not exceed its maximum.`)
  return { minimum, maximum }
}

export const parsePanelCount = (value: string): number => {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_TREATMENT_PANEL_COUNT) {
    throw UsageError(`Invalid panel count "${value}". Expected an integer from 1 through ${MAX_TREATMENT_PANEL_COUNT}.`)
  }
  return Number(value)
}

const listFlag = (parsed: ComicParsedArgs, name: string): string[] => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return []
  const value = parsed.flags[name]
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  return values.flatMap(item => String(item).split(',')).map(item => item.trim()).filter(Boolean)
}

const assertPanelCountCombination = (output: ParsedDraftCommandArgs): void => {
  if (output.panelCount === undefined) return
  if (output.only !== undefined && output.only !== 'scene') throw UsageError('--panel-count only applies to the scene stage; use --only scene or a full run')
}

const parseDraftScenesOnly = (only: string): NonNullable<ParsedDraftCommandArgs['only']> => {
  if (RETIRED_PREPARE_ONLY_OPTIONS.has(only)) {
    throw UsageError(`--only ${only} was merged into the local prepare stage; use --only prepare to build metadata/structured-script.json and metadata/draft-prompt.md together`)
  }
  if (!DRAFT_SCENES_ONLY_OPTIONS.has(only)) {
    throw UsageError(`Invalid only "${only}". Expected one of: ${DRAFT_SCENES_ONLY_VALUES.join(', ')}`)
  }
  return only as NonNullable<ParsedDraftCommandArgs['only']>
}

export const coerceAndValidateDraftScenes = (parsed: ComicParsedArgs): ParsedDraftCommandArgs => {
  const scriptPath = readScriptPath(parsed)
  const output: ParsedDraftCommandArgs = { showHelp: false, scriptPath: scriptPath as string }
  const llmModel = stringFlag(parsed, 'provider')
  const only = stringFlag(parsed, 'only')
  const concurrency = stringFlag(parsed, 'provider-concurrency')
  const concurrencyMode = stringFlag(parsed, 'concurrency-mode')
  if (enabledFlag(parsed, 'price') === true) output.price = true
  if (only !== undefined) output.only = parseDraftScenesOnly(only)
  if (output.only === 'prepare' && parsed.rawParsed.explicitFlags.has('provider')) {
    throw UsageError('--provider cannot be combined with --only prepare; the prepare stage is local and makes no provider call')
  }
  if (llmModel !== undefined) output.llmModel = parseComicLlmSelector(llmModel, 'provider')
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  output.concurrencyMode = parseHostedConcurrencyMode(concurrencyMode)
  const panelCount = stringFlag(parsed, 'panel-count')
  if (panelCount !== undefined) output.panelCount = parsePanelCount(panelCount)
  assertPanelCountCombination(output)
  return output
}

export const coerceAndValidateDraftTreatment = (parsed: ComicParsedArgs): ParsedDraftTreatmentArgs => {
  const treatmentPath = parsed.parameters['treatment-path']
  if (typeof treatmentPath !== 'string' || !treatmentPath.trim()) throw UsageError(`comic ${DRAFT_TREATMENT_COMMAND} requires <treatment-path>.`)
  const output: ParsedDraftTreatmentArgs = {
    showHelp: false,
    treatmentPath,
    panelRange: { minimum: DEFAULT_TREATMENT_PANEL_COUNT, maximum: DEFAULT_TREATMENT_PANEL_COUNT },
    voicePacing: DEFAULT_TREATMENT_VOICE_PACING,
    scene: DEFAULT_TREATMENT_SCENE_NUMBER,
    speakers: [],
    catalogPolicy: DEFAULT_TREATMENT_CATALOG_POLICY,
  }
  if (enabledFlag(parsed, 'price') === true) output.price = true
  const panelCount = stringFlag(parsed, 'panel-count')
  if (panelCount !== undefined) output.panelRange = parsePanelRange(panelCount)
  const voicePacing = stringFlag(parsed, 'voice-pacing')
  if (voicePacing !== undefined) {
    if (!TREATMENT_VOICE_PACING_OPTIONS.has(voicePacing)) throw UsageError(`Invalid voice pacing "${voicePacing}". Expected one of: ${TREATMENT_VOICE_PACINGS.join(', ')}`)
    output.voicePacing = voicePacing as ParsedDraftTreatmentArgs['voicePacing']
  }
  const episode = stringFlag(parsed, 'episode')
  if (episode !== undefined) {
    if (!TWO_DIGIT_PATTERN.test(episode)) throw UsageError(`Invalid episode "${episode}". Expected a two-digit number such as 02.`)
    output.episode = episode
  }
  const scene = stringFlag(parsed, 'scene')
  if (scene !== undefined) {
    if (!TWO_DIGIT_PATTERN.test(scene)) throw UsageError(`Invalid scene "${scene}". Expected a two-digit number such as 01.`)
    output.scene = scene
  }
  const slug = stringFlag(parsed, 'slug')
  if (slug !== undefined) {
    if (!KEBAB_KEY_PATTERN.test(slug)) throw UsageError(`Invalid slug "${slug}". Expected lowercase kebab-case such as camp-manzanita.`)
    output.slug = slug
  }
  const speakers = listFlag(parsed, 'speaker')
  for (const speaker of speakers) {
    if (!KEBAB_KEY_PATTERN.test(speaker)) throw UsageError(`Invalid speaker "${speaker}". Expected a lowercase kebab-case character key such as papa-bear.`)
  }
  output.speakers = [...new Set(speakers)]
  const styleSeed = stringFlag(parsed, 'style-seed')
  if (styleSeed !== undefined) {
    if (styleSeed.includes('/') || styleSeed.includes('\\') || styleSeed.startsWith('.') || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/.test(styleSeed)) {
      throw UsageError(`Invalid style seed "${styleSeed}". Expected a PNG filename under the characters root such as camp-manzanita--style-seed.png.`)
    }
    output.styleSeed = styleSeed
  }
  const catalogPolicy = stringFlag(parsed, 'catalog-policy')
  if (catalogPolicy !== undefined) {
    if (!TREATMENT_CATALOG_POLICY_OPTIONS.has(catalogPolicy)) throw UsageError(`Invalid catalog policy "${catalogPolicy}". Expected one of: ${TREATMENT_CATALOG_POLICIES.join(', ')}`)
    output.catalogPolicy = catalogPolicy as ParsedDraftTreatmentArgs['catalogPolicy']
  }
  if (enabledFlag(parsed, 'force') === true) output.force = true
  const llmModel = stringFlag(parsed, 'provider')
  if (llmModel !== undefined) output.llmModel = parseComicLlmSelector(llmModel, 'provider')
  output.concurrencyMode = parseHostedConcurrencyMode(stringFlag(parsed, 'concurrency-mode'))
  return output
}

export const coerceAndValidateReview = (parsed: ComicParsedArgs): ParsedReviewArgs => {
  const scriptPath = readScriptPath(parsed)
  if (!scriptPath?.trim()) throw UsageError(`comic ${REVIEW_COMMAND} requires <script-path>.`)
  const output: ParsedReviewArgs = { showHelp: false, scriptPath }
  if (enabledFlag(parsed, 'export-doc') === true) output.exportDoc = true
  const run = stringFlag(parsed, 'run')
  if (parsed.rawParsed.explicitFlags.has('run') && !run?.trim()) throw UsageError('--run requires an image run ID reported by comic generate-images')
  if (run !== undefined) output.run = run.trim()
  const use = enabledFlag(parsed, 'use') === true
  if (use && output.run === undefined) throw UsageError('--use requires --run <image-run-id>; name the image run whose candidates should become the selected panels')
  if (use) output.use = true
  const panels = stringFlag(parsed, 'panels')
  if (panels !== undefined) {
    if (!use) throw UsageError('--panels requires --run <image-run-id> --use')
    output.panels = parsePanelSelector(panels)
  }
  return output
}

const assertReferenceSketchCombination = (output: ParsedReferenceSketchArgs): void => {
  if (Number(Boolean(output.character)) + Number(Boolean(output.location)) !== 1) {
    throw UsageError('Exactly one of --character or --location is required')
  }
  if (output.character && output.view) throw UsageError('--view is only valid with --location')
  validateImageSizeForModels(output.size, output.imageModels)
  if (output.revise && !output.notes) throw UsageError('--notes is required when using --revise')
  if (output.notes && !output.revise) throw UsageError('--notes requires --revise')
}

export const coerceAndValidateReferenceSketch = (parsed: ComicParsedArgs): ParsedReferenceSketchArgs => {
  if (stringFlag(parsed, 'character')) {
    const unsupported = REFERENCE_LOCATION_ONLY_FLAGS.find(name => parsed.rawParsed.explicitFlags.has(name))
    if (unsupported) throw UsageError(`--${unsupported} is only valid with --location`)
  }
  const output: ParsedReferenceSketchArgs = { showHelp: false }
  const character = stringFlag(parsed, 'character')
  const location = stringFlag(parsed, 'location')
  const view = stringFlag(parsed, 'view')
  const llmModel = stringFlag(parsed, 'llm-provider')
  const notes = stringFlag(parsed, 'notes')
  const concurrency = stringFlag(parsed, 'provider-concurrency')
  const concurrencyMode = stringFlag(parsed, 'concurrency-mode')
  if (character !== undefined) output.character = character
  if (location !== undefined) output.location = location
  if (view !== undefined) {
    if (view !== 'establishing' && view !== 'reverse' && view !== 'side') {
      throw UsageError(`Invalid location view "${view}". Expected one of: establishing, reverse, side`)
    }
    output.view = view
  }
  if (llmModel !== undefined) output.llmModel = parseComicLlmSelector(llmModel, 'llm-provider')
  if (enabledFlag(parsed, 'revise') === true) output.revise = true
  if (notes !== undefined) output.notes = notes
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  output.concurrencyMode = parseHostedConcurrencyMode(concurrencyMode)
  if (enabledFlag(parsed, 'price') === true) output.price = true
  const imageModel = readSingleComicImageSelector(parsed, REFERENCE_SKETCH_COMMAND)
  if (imageModel !== undefined) output.imageModels = [imageModel]
  assignSharedImageRenderOptions(parsed, output)

  assertReferenceSketchCombination(output)
  return output
}

export const coerceAndValidateGenerateImages = (parsed: ComicParsedArgs): ParsedGenerateImagesArgs => {
  const output = coerceComicImageScalars(parsed)
  validateComicImageTarget(output)
  return finalizeComicImageOptions(output)
}
