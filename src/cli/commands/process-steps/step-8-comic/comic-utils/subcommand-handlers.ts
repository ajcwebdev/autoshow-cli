import { referenceSketchCommand } from '../comic-commands/reference-sketch/reference-sketch-command'
import { draftScenesCommand } from '../comic-commands/draft-scenes/draft-scenes-command'
import { generateImagesCommand } from '../comic-commands/generate-images/generate-images-command'
import { reviewNotesCommand } from '../comic-commands/review/review-notes-command'
import { reviewSheetCommand } from '../comic-commands/review/review-sheet-command'
import {
  coerceAndValidateDraftScenes,
  coerceAndValidateGenerateImages,
  coerceAndValidateReferenceSketch,
  coerceAndValidateReviewNotes,
  coerceAndValidateReviewSheet,
} from './cli-args'
import { resolveComicScriptReference, resolveSceneSlug } from './project-paths'
import {
  estimateCharacterSketchPrice,
  estimateDraftScenesPrice,
  estimateGenerateImagesPrice,
  estimateLocationReferencePrice,
} from './price-estimate'
import { UsageError, rethrowAsUsage } from '~/utils/error-handler'
import { withCharacterCatalog } from './character-reference-config'
import { runComicCreditPreflight } from './credit-preflight'
import type { CliCommandHandler } from '~/types'
import { generateComicAudio } from '../comic-commands/generate-audio/generate-audio-command'
import { generateComicSlideshow } from '../comic-commands/generate-slideshow/generate-slideshow-command'
import { createHostedConcurrencyCoordinator } from '~/cli/commands/process-steps/hosted-concurrency-coordinator'
import * as l from '~/utils/app-logger/app-logger'

const resolveComicScriptReferenceOrUsage = (scriptReference: string): Promise<string> =>
  rethrowAsUsage(() => resolveComicScriptReference(scriptReference))

export const handleReferenceSketch: CliCommandHandler = async (ctx) => {
  const { showHelp: _showHelp, price, ...parsedOptions } = rethrowAsUsage(() =>
    coerceAndValidateReferenceSketch(ctx)
  )
  const options = {
    ...parsedOptions,
    hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: parsedOptions.concurrencyMode ?? 'ramp' })
  }
  if (price) {
    if (parsedOptions.location) await estimateLocationReferencePrice(options)
    else await withCharacterCatalog(async () => await estimateCharacterSketchPrice(options))
    l.report.result({ command: 'comic reference-sketch', price: true, target: parsedOptions.location ? 'location' : 'character' }, 'Comic reference sketch price complete')
    return
  }
  if (parsedOptions.location) await referenceSketchCommand(options)
  else await withCharacterCatalog(async () => await referenceSketchCommand(options))
  l.report.result({ command: 'comic reference-sketch', price: false, target: parsedOptions.location ? 'location' : 'character' }, 'Comic reference sketch complete')
}

export const handleDraftScenes: CliCommandHandler = async (ctx) => {
  const parsed = rethrowAsUsage(() => coerceAndValidateDraftScenes(ctx))
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const options = {
    ...parsed,
    scriptPath,
    sceneSlug,
    hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: parsed.concurrencyMode ?? 'ramp' })
  }
  if (parsed.price) await estimateDraftScenesPrice(options)
  else await withCharacterCatalog(async () => await draftScenesCommand(options))
  l.report.result({ command: 'comic draft-scenes', price: parsed.price === true, sceneSlug }, parsed.price ? 'Comic draft price complete' : 'Comic draft complete')
}

export const handleGenerateImages: CliCommandHandler = async (ctx) => {
  const parsed = rethrowAsUsage(() => coerceAndValidateGenerateImages(ctx))
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const options = {
    ...parsed,
    scriptPath,
    sceneSlug,
    hostedConcurrencyCoordinator: createHostedConcurrencyCoordinator({ mode: parsed.concurrencyMode ?? 'ramp' })
  }
  if (parsed.price) {
    if (parsed.creditPreflight) await runComicCreditPreflight({ price: true })
    await estimateGenerateImagesPrice(options)
    l.report.result({ command: 'comic generate-images', price: true, sceneSlug }, 'Comic image price complete')
    return
  }
  if (parsed.creditPreflight) await runComicCreditPreflight({})
  await generateImagesCommand(options)
  l.report.result({ command: 'comic generate-images', price: false, sceneSlug }, 'Comic image generation complete')
}

export const handleReviewNotes: CliCommandHandler = async (ctx) => {
  const parsed = rethrowAsUsage(() => coerceAndValidateReviewNotes(ctx))
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const result = await withCharacterCatalog(async () => await reviewNotesCommand({ scriptPath, sceneSlug, notesPath: parsed.notes }))
  l.report.result({ command: 'comic review-notes', price: false, sceneSlug }, 'Comic review notes complete')
  return void result
}

export const handleReviewSheet: CliCommandHandler = async (ctx) => {
  const parsed = rethrowAsUsage(() => coerceAndValidateReviewSheet(ctx))
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const result = await reviewSheetCommand({ scriptPath, sceneSlug, ...(parsed.exportDoc ? { exportDoc: true } : {}) })
  l.report.result({ command: 'comic review-sheet', price: false, sceneSlug }, 'Comic review sheet complete')
  return void result
}

export const handleGenerateAudio: CliCommandHandler = async (ctx) => {
  const scriptReference = ctx.parameters['script-path']
  if (typeof scriptReference !== 'string' || !scriptReference.trim()) throw UsageError('comic generate-audio requires <script-path>.')
  const scriptPath = await resolveComicScriptReferenceOrUsage(scriptReference)
  await generateComicAudio(ctx, scriptPath)
  l.report.result({ command: 'comic generate-audio', price: ctx.flags['price'] === true, scriptPath }, ctx.flags['price'] === true ? 'Comic audio price complete' : 'Comic audio complete')
}

export const handleGenerateSlideshow: CliCommandHandler = async (ctx) => {
  const scriptReference = ctx.parameters['script-path']
  if (typeof scriptReference !== 'string' || !scriptReference.trim()) throw UsageError('comic generate-slideshow requires <script-path>.')
  const scriptPath = await resolveComicScriptReferenceOrUsage(scriptReference)
  await generateComicSlideshow(ctx, scriptPath)
  l.report.result({ command: 'comic generate-slideshow', price: ctx.flags['price'] === true, scriptPath }, ctx.flags['price'] === true ? 'Comic slideshow price complete' : 'Comic slideshow complete')
}
