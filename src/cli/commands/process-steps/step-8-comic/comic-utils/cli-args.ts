import {
  IMAGE_GENERATION_QUALITIES,
} from '~/types'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { UsageError } from '~/utils/error-handler'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { parseHostedConcurrencyMode } from '~/cli/options/option-resolution/flag-readers'
import {
  validateImageSizeForModels,
} from './image-size'
import {
  parseImagePromptVariations,
} from '../comic-commands/generate-images/prompt-variations'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_SKETCH_PANELS_PER_IMAGE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  parseComicGridSpec,
  parsePanelSelector,
  validateComicGridOptions,
} from '../comic-commands/generate-images/comic-page-utils'
import { BLOCKING_HARD_CANDIDATE_STATUSES } from '../schemas/blocking-plan-schemas'
import type {
  BlockingHardCandidateStatus,
  ComicParsedArgs,
  ParsedDraftCommandArgs,
  ParsedGenerateBaseArgs,
  ParsedGenerateImagesArgs,
  ParsedImageModel,
  ParsedImageQuality,
  ParsedImageSize,
  ParsedLlmModel,
  ParsedReferenceSketchArgs,
  ParsedReviewNotesArgs,
  ParsedReviewSheetArgs,
} from '~/types'

export const DEFAULT_LLM_MODEL = 'gpt-5.6-sol'
export const DEFAULT_QA_MODEL = 'gpt-5.6-sol'

export const REFERENCE_SKETCH_COMMAND = 'reference-sketch'
export const DRAFT_SCENES_COMMAND = 'draft-scenes'
export const GENERATE_IMAGES_COMMAND = 'generate-images'
export const GENERATE_AUDIO_COMMAND = 'generate-audio'
export const REVIEW_NOTES_COMMAND = 'review-notes'
export const REVIEW_SHEET_COMMAND = 'review-sheet'

const DRAFT_SCENES_ONLY_VALUES = ['structure', 'prompt', 'blocking', 'scene', 'panel-prompts'] as const
const GENERATE_IMAGES_TARGET_VALUES = ['images', 'sketches', 'both'] as const

const IMAGE_QUALITY_OPTIONS = new Set<string>(IMAGE_GENERATION_QUALITIES)
const DRAFT_SCENES_ONLY_OPTIONS = new Set<string>(DRAFT_SCENES_ONLY_VALUES)
const GENERATE_IMAGES_TARGET_OPTIONS = new Set<string>(GENERATE_IMAGES_TARGET_VALUES)

const stringFlag = (parsed: ComicParsedArgs, name: string): string | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  const value = parsed.flags[name]
  return typeof value === 'string' ? value : undefined
}

const enabledFlag = (parsed: ComicParsedArgs, name: string): boolean | undefined => {
  if (!parsed.rawParsed.explicitFlags.has(name)) return undefined
  return parsed.flags[name] === true
}

const readScriptPath = (parsed: ComicParsedArgs): string | undefined => {
  const scriptPath = parsed.parameters['script-path']
  return typeof scriptPath === 'string' ? scriptPath : undefined
}

const isPositiveInteger = (value: string): boolean =>
  /^\d+$/.test(value) && Number(value) > 0

const parseConcurrencyValue = (value: string): number => {
  if (!isPositiveInteger(value)) {
    throw UsageError(`Invalid concurrency "${value}". Expected a positive integer like 1 or ${DEFAULT_CLI_CONCURRENCY}`)
  }
  return Number(value)
}

const parseImageModels = (value: string): ParsedImageModel[] => {
  const rawModels = value.split(',').map(model => model.trim())
  if (rawModels.some(model => model.length === 0)) {
    throw UsageError(
      `Invalid image model list "${value}". Expected one or more comma-separated image model ids from the central image registry.`
    )
  }

  const parsedModels: ParsedImageModel[] = []
  const seenModels = new Set<string>()
  for (const model of rawModels) {
    if (!findRegistryServiceForModel('image', model)) {
      throw UsageError(`Invalid image model "${model}". It is not present in the central image registry.`)
    }
    if (seenModels.has(model)) {
      throw UsageError(`Duplicate image model "${model}" is not allowed`)
    }
    seenModels.add(model)
    parsedModels.push(model as ParsedImageModel)
  }
  return parsedModels
}

const parseLlmModel = (value: string): ParsedLlmModel => {
  if (!findRegistryServiceForModel('llm', value)) {
    throw UsageError(`Invalid llm model "${value}". It is not present in the central LLM registry.`)
  }
  return value as ParsedLlmModel
}

const parseImageQuality = (value: string): ParsedImageQuality => {
  if (!IMAGE_QUALITY_OPTIONS.has(value)) {
    throw UsageError(`Invalid quality "${value}". Expected one of: low, medium, high, auto`)
  }
  return value as ParsedImageQuality
}

const parseMaxRepairs = (value: string): number => {
  if (!/^\d+$/.test(value)) {
    throw UsageError(`Invalid max repairs "${value}". Expected a non-negative integer.`)
  }
  return Number(value)
}

const assignSharedImageOptions = (
  parsed: ComicParsedArgs,
  output: ParsedGenerateBaseArgs | ParsedReferenceSketchArgs
): void => {
  const imageModel = stringFlag(parsed, 'image-model')
  const size = stringFlag(parsed, 'size')
  const quality = stringFlag(parsed, 'quality')
  if (imageModel !== undefined) output.imageModels = parseImageModels(imageModel)
  if (size !== undefined) output.size = size as ParsedImageSize
  if (quality !== undefined) output.quality = parseImageQuality(quality)
}

export const coerceAndValidateDraftScenes = (parsed: ComicParsedArgs): ParsedDraftCommandArgs => {
  const scriptPath = readScriptPath(parsed)
  const output: ParsedDraftCommandArgs = { showHelp: false, scriptPath: scriptPath as string }
  const llmModel = stringFlag(parsed, 'llm-model')
  const only = stringFlag(parsed, 'only')
  const concurrency = stringFlag(parsed, 'concurrency')
  const concurrencyMode = stringFlag(parsed, 'concurrency-mode')
  if (enabledFlag(parsed, 'price') === true) output.price = true
  if (llmModel !== undefined) output.llmModel = parseLlmModel(llmModel)
  if (only !== undefined) {
    if (!DRAFT_SCENES_ONLY_OPTIONS.has(only)) {
      throw UsageError(`Invalid only "${only}". Expected one of: ${DRAFT_SCENES_ONLY_VALUES.join(', ')}`)
    }
    output.only = only as NonNullable<ParsedDraftCommandArgs['only']>
  }
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  output.concurrencyMode = parseHostedConcurrencyMode(concurrencyMode)
  const blocking = enabledFlag(parsed, 'blocking')
  if (blocking !== undefined) output.blocking = blocking
  const blockingPlan = stringFlag(parsed, 'blocking-plan')
  if (parsed.rawParsed.explicitFlags.has('blocking-plan') && !blockingPlan) throw UsageError('--blocking-plan requires a plan JSON file path')
  if (blockingPlan !== undefined) output.blockingPlan = blockingPlan
  if (enabledFlag(parsed, 'rebind') === true) output.rebind = true
  if (enabledFlag(parsed, 'reconcile-from-directives') === true) output.reconcileFromDirectives = true
  if (output.reconcileFromDirectives) {
    if (output.only !== undefined) throw UsageError('--reconcile-from-directives cannot be combined with --only; it is a standalone no-provider pass over the reviewed scene')
    if (output.rebind) throw UsageError('--reconcile-from-directives cannot be combined with --rebind')
    if (output.blockingPlan !== undefined) throw UsageError('--reconcile-from-directives cannot be combined with --blocking-plan')
  }
  if (output.rebind && output.only !== 'blocking') throw UsageError('--rebind requires --only blocking')
  if (output.rebind && output.blockingPlan !== undefined) throw UsageError('--rebind cannot be combined with --blocking-plan')
  if (output.blockingPlan !== undefined && output.only !== undefined && output.only !== 'blocking') throw UsageError('--blocking-plan only applies to the blocking stage; use --only blocking or a full run')
  if (output.blocking === false && (output.only === 'blocking' || output.blockingPlan !== undefined || output.rebind)) throw UsageError('--no-blocking cannot be combined with --only blocking, --blocking-plan, or --rebind')
  return output
}

export const coerceAndValidateReviewNotes = (parsed: ComicParsedArgs): ParsedReviewNotesArgs => {
  const scriptPath = readScriptPath(parsed)
  if (!scriptPath?.trim()) throw UsageError(`comic ${REVIEW_NOTES_COMMAND} requires <script-path>.`)
  const notes = stringFlag(parsed, 'notes')
  if (!notes?.trim()) throw UsageError(`comic ${REVIEW_NOTES_COMMAND} requires --notes <path> pointing at a Markdown file with ### Panel NN headings`)
  return { showHelp: false, scriptPath, notes }
}

export const coerceAndValidateReviewSheet = (parsed: ComicParsedArgs): ParsedReviewSheetArgs => {
  const scriptPath = readScriptPath(parsed)
  if (!scriptPath?.trim()) throw UsageError(`comic ${REVIEW_SHEET_COMMAND} requires <script-path>.`)
  const output: ParsedReviewSheetArgs = { showHelp: false, scriptPath }
  if (enabledFlag(parsed, 'export-doc') === true) output.exportDoc = true
  return output
}

export const coerceAndValidateReferenceSketch = (parsed: ComicParsedArgs): ParsedReferenceSketchArgs => {
  const output: ParsedReferenceSketchArgs = { showHelp: false }
  const character = stringFlag(parsed, 'character')
  const location = stringFlag(parsed, 'location')
  const view = stringFlag(parsed, 'view')
  const llmModel = stringFlag(parsed, 'llm-model')
  const qaModel = stringFlag(parsed, 'qa-model')
  const maxRepairs = stringFlag(parsed, 'max-repairs')
  const notes = stringFlag(parsed, 'notes')
  const concurrency = stringFlag(parsed, 'concurrency')
  const concurrencyMode = stringFlag(parsed, 'concurrency-mode')
  if (character !== undefined) output.character = character
  if (location !== undefined) output.location = location
  if (view !== undefined) {
    if (view !== 'establishing' && view !== 'reverse' && view !== 'side') {
      throw UsageError(`Invalid location view "${view}". Expected one of: establishing, reverse, side`)
    }
    output.view = view
  }
  if (llmModel !== undefined) output.llmModel = parseLlmModel(llmModel)
  if (qaModel !== undefined) output.qaModel = parseLlmModel(qaModel)
  const qa = enabledFlag(parsed, 'qa')
  if (qa !== undefined) output.qa = qa
  if (maxRepairs !== undefined) output.maxRepairs = parseMaxRepairs(maxRepairs)
  if (enabledFlag(parsed, 'revise') === true) output.revise = true
  if (notes !== undefined) output.notes = notes
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  output.concurrencyMode = parseHostedConcurrencyMode(concurrencyMode)
  if (enabledFlag(parsed, 'price') === true) output.price = true
  assignSharedImageOptions(parsed, output)

  if (output.imageModels && output.imageModels.length !== 1) {
    throw UsageError('comic reference-sketch accepts exactly one --image-model')
  }
  if (Number(Boolean(output.character)) + Number(Boolean(output.location)) !== 1) {
    throw UsageError('Exactly one of --character or --location is required')
  }
  if (output.character && output.view) throw UsageError('--view is only valid with --location')
  validateImageSizeForModels(output.size, output.imageModels)
  if (output.revise && !output.notes) throw UsageError('--notes is required when using --revise')
  if (output.notes && !output.revise) throw UsageError('--notes requires --revise')
  return output
}

export const coerceAndValidateGenerateImages = (parsed: ComicParsedArgs): ParsedGenerateImagesArgs => {
  const scriptPath = readScriptPath(parsed)
  const output: ParsedGenerateBaseArgs = { showHelp: false, scriptPath: scriptPath as string }
  const qaModel = stringFlag(parsed, 'qa-model')
  const maxRepairs = stringFlag(parsed, 'max-repairs')
  const targetValue = stringFlag(parsed, 'target')
  const concurrency = stringFlag(parsed, 'concurrency')
  const concurrencyMode = stringFlag(parsed, 'concurrency-mode')
  const panels = stringFlag(parsed, 'panels')
  const panelsPerImage = stringFlag(parsed, 'panels-per-image')
  const grid = stringFlag(parsed, 'grid')
  const variation = stringFlag(parsed, 'variation')
  const qaOnly = enabledFlag(parsed, 'qa-only') === true
  const blockingHardKeys = stringFlag(parsed, 'blocking-hard-keys')
  const blockingLayoutGuide = enabledFlag(parsed, 'blocking-layout-guide') === true
  if (blockingLayoutGuide) output.blockingLayoutGuide = true
  if (enabledFlag(parsed, 'bloopers') === true) output.bloopers = true
  if (enabledFlag(parsed, 'stop-on-provider-error') === true) output.stopOnProviderError = true
  if (enabledFlag(parsed, 'credit-preflight') === true) output.creditPreflight = true
  const continuityQa = enabledFlag(parsed, 'continuity-qa') === true
  const continuityOnly = enabledFlag(parsed, 'continuity-only') === true
  const labels = stringFlag(parsed, 'labels')
  const trustedAnchorPanel = stringFlag(parsed, 'trusted-anchor-panel')
  const revisionPlan = stringFlag(parsed, 'revision-plan')
  const comparisonPasses = stringFlag(parsed, 'comparison-passes')
  const promote = stringFlag(parsed, 'promote')
  if (enabledFlag(parsed, 'price') === true) output.price = true
  const qa = enabledFlag(parsed, 'qa')
  if (qa !== undefined) output.qa = qa
  if (qaOnly) output.qaOnly = true
  if (revisionPlan !== undefined) output.revisionPlan = revisionPlan
  if (comparisonPasses !== undefined) output.comparisonPasses = parseMaxRepairs(comparisonPasses)
  if (promote !== undefined) {
    if (promote !== 'clear-winners') throw UsageError(`Invalid revision promotion policy "${promote}". Expected clear-winners`)
    output.promote = promote
  }
  if (qaModel !== undefined) {
    const qaService = findRegistryServiceForModel('llm', qaModel)
    if (qaService !== 'openai' && qaService !== 'gemini') {
      throw UsageError(`Invalid QA model "${qaModel}". QA currently supports OpenAI and Gemini vision-capable LLMs.`)
    }
    output.qaModel = qaModel as ParsedLlmModel
  }
  if (maxRepairs !== undefined) output.maxRepairs = parseMaxRepairs(maxRepairs)
  if (targetValue !== undefined) {
    if (!GENERATE_IMAGES_TARGET_OPTIONS.has(targetValue)) {
      throw UsageError(`Invalid target "${targetValue}". Expected one of: ${GENERATE_IMAGES_TARGET_VALUES.join(', ')}`)
    }
    output.target = targetValue as NonNullable<ParsedGenerateBaseArgs['target']>
  }
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  output.concurrencyMode = parseHostedConcurrencyMode(concurrencyMode)
  if (panels !== undefined) output.panels = parsePanelSelector(panels)
  if (panelsPerImage !== undefined) {
    if (!isPositiveInteger(panelsPerImage)) {
      throw UsageError(`Invalid panels per image "${panelsPerImage}". Expected a positive integer like 1 or ${DEFAULT_SKETCH_PANELS_PER_IMAGE}`)
    }
    output.panelsPerImage = Number(panelsPerImage)
  }
  if (grid !== undefined) output.grid = parseComicGridSpec(grid)
  if (variation !== undefined) output.variations = parseImagePromptVariations(variation)
  if (enabledFlag(parsed, 'force') === true) output.force = true
  assignSharedImageOptions(parsed, output)

  const target = output.target ?? 'images'
  const targetRunsFinalImages = target === 'images' || target === 'both'
  if ((output.qa !== undefined || output.qaModel || output.maxRepairs !== undefined) && !targetRunsFinalImages) {
    throw UsageError('QA options only apply when --target is images or both')
  }
  if (output.grid && output.panelsPerImage === undefined) {
    throw UsageError('--grid requires --panels-per-image 1')
  }

  if (qaOnly) {
    if (target !== 'images') throw UsageError('--qa-only requires --target images')
    if (output.qa === false) throw UsageError('--qa-only cannot be combined with --no-qa')
    if (output.maxRepairs !== undefined && output.maxRepairs !== 0) throw UsageError('--qa-only requires --max-repairs 0')
    if (output.panelsPerImage !== undefined && output.panelsPerImage !== 1) throw UsageError('--qa-only requires --panels-per-image 1')
    if (output.grid) throw UsageError('--qa-only cannot be combined with --grid')
    if (output.variations !== undefined) throw UsageError('--qa-only cannot be combined with --variation')
    if (output.force) throw UsageError('--qa-only cannot be combined with --force')
    if (output.imageModels !== undefined || output.size !== undefined || output.quality !== undefined) throw UsageError('--qa-only does not accept image-generation options')
    if (blockingLayoutGuide) throw UsageError('--qa-only cannot be combined with --blocking-layout-guide')
    output.qa = true
    output.maxRepairs = 0
    output.panelsPerImage = 1
  }

  if (blockingHardKeys !== undefined) {
    const keys = blockingHardKeys.split(',').map(key => key.trim()).filter(key => key.length > 0)
    if (keys.length === 0) throw UsageError(`Invalid blocking hard key list "${blockingHardKeys}". Expected a comma list of: ${BLOCKING_HARD_CANDIDATE_STATUSES.join(', ')}`)
    for (const key of keys) {
      if (!(BLOCKING_HARD_CANDIDATE_STATUSES as readonly string[]).includes(key)) {
        throw UsageError(`Invalid blocking hard key "${key}". Expected one of: ${BLOCKING_HARD_CANDIDATE_STATUSES.join(', ')}`)
      }
    }
    output.blockingHardKeys = [...new Set(keys)] as BlockingHardCandidateStatus[]
  }

  if (continuityOnly && !continuityQa) throw UsageError('--continuity-only requires --continuity-qa')
  if (continuityQa && !qaOnly) throw UsageError('--continuity-qa requires --qa-only')
  if (labels !== undefined && !continuityQa) throw UsageError('--labels requires --continuity-qa')
  if (trustedAnchorPanel !== undefined && !continuityQa) throw UsageError('--trusted-anchor-panel requires --continuity-qa')
  if (continuityQa) output.continuityQa = true
  if (continuityOnly) output.continuityOnly = true
  if (labels !== undefined) output.labels = labels
  if (trustedAnchorPanel !== undefined) {
    if (!isPositiveInteger(trustedAnchorPanel)) {
      throw UsageError(`Invalid trusted anchor panel "${trustedAnchorPanel}". Expected a positive integer like 1`)
    }
    output.trustedAnchorPanel = Number(trustedAnchorPanel)
  }

  if (revisionPlan !== undefined) {
    if (qaOnly) throw UsageError('--revision-plan cannot be combined with --qa-only')
    if (target !== 'images') throw UsageError('--revision-plan requires --target images')
    if (output.panelsPerImage !== undefined && output.panelsPerImage !== 1) throw UsageError('--revision-plan requires --panels-per-image 1')
    if (output.grid) throw UsageError('--revision-plan cannot be combined with --grid')
    if (output.variations !== undefined) throw UsageError('--revision-plan cannot be combined with --variation')
    if (output.force) throw UsageError('--revision-plan cannot be combined with --force')
    if (blockingLayoutGuide) throw UsageError('--revision-plan cannot be combined with --blocking-layout-guide')
    if (output.qa === false) throw UsageError('--revision-plan cannot be combined with --no-qa')
    if (output.maxRepairs !== undefined && output.maxRepairs !== 0) throw UsageError('--revision-plan requires --max-repairs 0')
    if (output.imageModels !== undefined && (output.imageModels.length !== 1 || output.imageModels[0] !== 'gpt-image-2')) throw UsageError('--revision-plan supports only --image-model gpt-image-2')
    if (output.qaModel !== undefined && output.qaModel !== 'gemini-3.1-pro-preview') throw UsageError('--revision-plan supports only --qa-model gemini-3.1-pro-preview')
    if (output.comparisonPasses !== 2) throw UsageError('--revision-plan requires --comparison-passes 2')
    if (output.promote !== 'clear-winners') throw UsageError('--revision-plan requires --promote clear-winners')
    output.imageModels = ['gpt-image-2']
    output.qaModel = 'gemini-3.1-pro-preview'
    output.qa = true
    output.maxRepairs = 0
    output.panelsPerImage = 1
  } else if (comparisonPasses !== undefined || promote !== undefined) {
    throw UsageError('--comparison-passes and --promote require --revision-plan')
  }

  output.qa ??= true
  output.qaModel ??= DEFAULT_QA_MODEL as ParsedLlmModel
  output.maxRepairs ??= qaOnly || revisionPlan !== undefined ? 0 : 2
  if (output.variations !== undefined && !targetRunsFinalImages) {
    throw UsageError('--variation only applies when --target is images or both')
  }
  if (blockingLayoutGuide && !targetRunsFinalImages) throw UsageError('--blocking-layout-guide only applies when --target is images or both')
  if (blockingLayoutGuide && !output.grid && (output.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE) !== 1) throw UsageError('--blocking-layout-guide requires --panels-per-image 1')
  validateImageSizeForModels(output.size, output.imageModels)
  validateComicGridOptions(output.grid, {
    target,
    size: output.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: output.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  })
  return output as ParsedGenerateImagesArgs
}
