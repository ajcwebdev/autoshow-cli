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
  if (!parsed.scriptPath) {
    throw CLIUsageError('Missing script path. Usage: bun autoshow comic draft-scenes <script-path>')
  }
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const options = { ...parsed, scriptPath, sceneSlug }
  if (parsed.price) await estimateDraftScenesPrice(options)
  else await withCharacterCatalog(async () => await draftScenesCommand(options))
}

export const handleGenerateImages: CliCommandHandler = async (ctx) => {
  const parsed = rethrowAsUsage(() => coerceAndValidateGenerateImages(ctx))
  if (!parsed.scriptPath) {
    throw CLIUsageError('Missing script path. Usage: bun autoshow comic generate-images <script-path>')
  }
  const scriptPath = await resolveComicScriptReferenceOrUsage(parsed.scriptPath)
  const sceneSlug = resolveSceneSlug(scriptPath)
  const options = { ...parsed, scriptPath, sceneSlug }
  if (parsed.price) {
    await estimateGenerateImagesPrice(options)
    return
  }
  await generateImagesCommand(options)
}
