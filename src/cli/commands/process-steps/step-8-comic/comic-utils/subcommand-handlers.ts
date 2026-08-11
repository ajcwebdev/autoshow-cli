import { referenceSketchCommand } from '../comic-commands/reference-sketch/reference-sketch-command'
import { draftScenesCommand } from '../comic-commands/draft-scenes/draft-scenes-command'
import { generateImagesCommand } from '../comic-commands/generate-images/generate-images-command'
import {
  coerceAndValidateDraftScenes,
  coerceAndValidateGenerateImages,
  coerceAndValidateReferenceSketch,
} from './cli-args'
import { resolveComicScriptReference, resolveSceneSlug } from './project-paths'
import {
  estimateCharacterSketchPrice,
  estimateDraftScenesPrice,
  estimateGenerateImagesPrice,
  estimateLocationReferencePrice,
} from './price-estimate'
import { CLIUsageError, rethrowAsUsage } from '~/utils/error-handler'
import { withCharacterCatalog } from './character-reference-config'
import type { CliCommandHandler } from '~/types'
import { generateComicAudio } from '../comic-commands/generate-audio/generate-audio-command'

const resolveComicScriptReferenceOrUsage = (scriptReference: string): Promise<string> =>
  rethrowAsUsage(() => resolveComicScriptReference(scriptReference))

export const handleReferenceSketch: CliCommandHandler = async (ctx) => {
  const { showHelp: _showHelp, price, ...options } = rethrowAsUsage(() =>
    coerceAndValidateReferenceSketch(ctx)
  )
  if (price) {
    if (options.location) await estimateLocationReferencePrice(options)
    else await withCharacterCatalog(async () => await estimateCharacterSketchPrice(options))
    return
  }
  if (options.location) await referenceSketchCommand(options)
  else await withCharacterCatalog(async () => await referenceSketchCommand(options))
}

export const handleDraftScenes: CliCommandHandler = async (ctx) => {
  const parsed = rethrowAsUsage(() => coerceAndValidateDraftScenes(ctx))
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const options = { ...parsed, scriptPath, sceneSlug }
  if (parsed.price) await estimateDraftScenesPrice(options)
  else await withCharacterCatalog(async () => await draftScenesCommand(options))
}

export const handleGenerateImages: CliCommandHandler = async (ctx) => {
  const parsed = rethrowAsUsage(() => coerceAndValidateGenerateImages(ctx))
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const options = { ...parsed, scriptPath, sceneSlug }
  if (parsed.price) {
    await estimateGenerateImagesPrice(options)
    return
  }
  await generateImagesCommand(options)
}

export const handleGenerateAudio: CliCommandHandler = async (ctx) => {
  const scriptReference = ctx.parameters['script-path']
  if (typeof scriptReference !== 'string' || !scriptReference.trim()) throw CLIUsageError('comic generate-audio requires <script-path>.')
  const scriptPath = await resolveComicScriptReferenceOrUsage(scriptReference)
  await generateComicAudio(ctx, scriptPath)
}
