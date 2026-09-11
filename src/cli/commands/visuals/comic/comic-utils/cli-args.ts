import { parseHostedConcurrencyMode } from '~/cli/options/option-resolution/flag-readers'
import type {
  ComicParsedArgs,
  ParsedDraftCommandArgs,
  ParsedGenerateImagesArgs,
  ParsedReferenceSketchArgs,
  ParsedReviewNotesArgs,
  ParsedReviewSheetArgs
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { assignSharedImageOptions, enabledFlag, parseConcurrencyValue, parseLlmModel, parseMaxRepairs, readScriptPath, stringFlag } from './comic-argument-readers'
import { applyComicBlockingHardKeys, applyComicContinuityPolicy, applyComicQaOnlyPolicy, applyComicRevisionPolicy, finalizeComicImageOptions, validateComicImageTarget } from './comic-image-option-policies'
import { coerceComicImageScalars } from './comic-image-scalar-options'
import {
  validateImageSizeForModels,
} from './image-size'

export { DEFAULT_LLM_MODEL, DEFAULT_QA_MODEL } from './comic-argument-defaults'

export const REFERENCE_SKETCH_COMMAND = 'reference-sketch'
export const DRAFT_SCENES_COMMAND = 'draft-scenes'
export const GENERATE_IMAGES_COMMAND = 'generate-images'
export const GENERATE_AUDIO_COMMAND = 'generate-audio'
export const REVIEW_COMMAND = 'review'
export const REVIEW_NOTES_COMMAND = 'review-notes'
export const REVIEW_SHEET_COMMAND = 'review-sheet'

const DRAFT_SCENES_ONLY_VALUES = ['structure', 'prompt', 'blocking', 'scene', 'panel-prompts'] as const

const DRAFT_SCENES_ONLY_OPTIONS = new Set<string>(DRAFT_SCENES_ONLY_VALUES)

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

export const coerceAndValidateReviewNotes = (parsed: ComicParsedArgs, commandName = REVIEW_NOTES_COMMAND): ParsedReviewNotesArgs => {
  const scriptPath = readScriptPath(parsed)
  if (!scriptPath?.trim()) throw UsageError(`comic ${commandName} requires <script-path>.`)
  const notes = stringFlag(parsed, 'notes')
  if (!notes?.trim()) throw UsageError(`comic ${commandName} requires --notes <path> pointing at a Markdown file with ### Panel NN headings`)
  return { showHelp: false, scriptPath, notes }
}

export const coerceAndValidateReviewSheet = (parsed: ComicParsedArgs, commandName = REVIEW_SHEET_COMMAND): ParsedReviewSheetArgs => {
  const scriptPath = readScriptPath(parsed)
  if (!scriptPath?.trim()) throw UsageError(`comic ${commandName} requires <script-path>.`)
  const output: ParsedReviewSheetArgs = { showHelp: false, scriptPath }
  if (enabledFlag(parsed, 'export-doc') === true) output.exportDoc = true
  return output
}

export const coerceAndValidateReview = (parsed: ComicParsedArgs): ParsedReviewNotesArgs | ParsedReviewSheetArgs => {
  if (parsed.rawParsed.explicitFlags.has('notes')) {
    if (parsed.rawParsed.explicitFlags.has('export-doc')) {
      throw UsageError('comic review --notes cannot be combined with --export-doc. Omit --notes to export the review sheet.')
    }
    return coerceAndValidateReviewNotes(parsed, REVIEW_COMMAND)
  }
  return coerceAndValidateReviewSheet(parsed, REVIEW_COMMAND)
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
  const state = coerceComicImageScalars(parsed)
  validateComicImageTarget(state)
  applyComicQaOnlyPolicy(state)
  applyComicBlockingHardKeys(state)
  applyComicContinuityPolicy(state)
  applyComicRevisionPolicy(state)
  return finalizeComicImageOptions(state)
}
