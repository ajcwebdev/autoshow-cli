import { mkdtemp, mkdir, rename, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import type { CharacterSketchCommandOptions, CharacterSketchView, ImageGenerationQuality, ImageGenerationSize } from '~/types'
import { comicLog, err, formatCompactCost, formatDuration, suppressSharedPipelineLogs } from '../../comic-utils/comic-logger'
import {
  CHARACTER_SKETCH_VIEWS,
  checksumFile,
  createCharacterSketchGenerationId,
  getCharacterSketchImagePathForDirectory,
  getCharacterSketchManifestPath,
  readCharacterSketchManifest,
  requireCurrentCharacterSketch,
  withCharacterSketchManifestLock,
} from '../process-scenes/character-utils'
import { combineCharacterSketchSheet, selectCharacterSketchSheetSources } from './character-sketch-sheet'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { createImageRunStats, updateImageRunStatsWithCostFallback } from '../../comic-image-services/image-costs'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { loadPromptsConfig } from '../../comic-utils/scene-utils'
import { runWithConcurrency } from '~/utils/run-with-concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'

const DEFAULT_IMAGE_SIZE: ImageGenerationSize = '1024x1536'
const DEFAULT_CHARACTER_SKETCH_QUALITY: ImageGenerationQuality = 'medium'
const VIEW_PROMPT_KEYS: Record<CharacterSketchView, 'Front' | 'Three-Quarter' | 'Profile'> = {
  front: 'Front', 'three-quarter': 'Three-Quarter', profile: 'Profile',
}

const buildPrompt = (
  name: string,
  description: string,
  view: CharacterSketchView,
  prompts: Awaited<ReturnType<typeof loadPromptsConfig>>['Character Sketch Prompts'],
  revisionNotes?: string,
  generationInstructions?: string,
  bootstrap = false,
): string => [
  generationInstructions
    ? (bootstrap
        ? 'Create a new reusable character reference from the written specification. Use the supplied image only as a visual-style reference; do not copy its subject, identity, anatomy, clothing, pose, or props.'
        : 'Create a reusable character reference that preserves the supplied character identity while following the catalog rendering instructions.')
    : prompts.Prefix?.trim(),
  generationInstructions ? undefined : prompts.Character.trim(),
  `Character: ${name}\nNotes: ${description}`,
  revisionNotes ? `Revision notes: ${revisionNotes}` : undefined,
  generationInstructions ? `Rendering instructions: ${generationInstructions.trim()}` : undefined,
  prompts[VIEW_PROMPT_KEYS[view]].trim(),
  generationInstructions
    ? 'Requirements:\n- Use a plain white or warm-white background with no setting.\n- Preserve the specified anatomy, proportions, clothing silhouette, palette, and distinctive features consistently across views.\n- Show the full character clearly in frame.\n- Do not add labels, captions, borders, inset images, extra figures, or alternate views.'
    : 'Requirements:\n- Output black-and-white outline art only.\n- Use a plain white background.\n- Preserve identity, proportions, clothing silhouette, and distinctive features.\n- Show the full character clearly in frame.',
].filter(Boolean).join('\n\n')

export type CharacterSketchCommandDependencies = {
  requestImage?: typeof createImage
  writeImage?: typeof writeGeneratedImage
  composeSheet?: typeof combineCharacterSketchSheet
  createGenerationId?: () => string
}

export const characterSketchCommand = async (
  options: CharacterSketchCommandOptions = {},
  dependencies: CharacterSketchCommandDependencies = {},
): Promise<void> => {
  if (!options.character) throw CLIUsageError('--character is required')
  if ((options.imageModels?.length ?? 1) !== 1) throw CLIUsageError('comic reference-sketch accepts exactly one --image-model')

  suppressSharedPipelineLogs()
  const catalog = loadCharacterCatalog()
  const key = catalog.requireKey(options.character)
  const character = catalog.get(key)
  const model = options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL
  if (!model) throw CLIUsageError('comic reference-sketch --character requires one image model')
  const size = options.size ?? DEFAULT_IMAGE_SIZE
  const quality = options.quality ?? DEFAULT_CHARACTER_SKETCH_QUALITY
  validateImageSizeForModels(size, [model])

  const current = options.revise ? await requireCurrentCharacterSketch(key, character) : null
  const bootstrap = !existsSync(character.sourcePath)
  if (bootstrap && options.revise) throw CLIUsageError(`Cannot revise character "${key}" before its first reference has been generated`)
  if (bootstrap && !character.generationReferencePath) {
    throw ValidationError(`Character "${key}" has no source image or generationReference`, { stage: 'comic:character-sketch' })
  }
  const usesSingleReference = character.sourcePath === character.outlineSheetPath
  const referenceCount = options.revise && !usesSingleReference ? 2 : 1
  validateReferenceImageCount(model, referenceCount, `character-sketch ${options.revise ? 'revision' : 'generation'}`)
  const stableReferencePath = bootstrap ? character.generationReferencePath! : character.sourcePath
  const stableReferenceSha256 = await checksumFile(stableReferencePath)

  const requestImage = dependencies.requestImage ?? createImage
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const composeSheet = dependencies.composeSheet ?? combineCharacterSketchSheet
  const generationId = dependencies.createGenerationId?.() ?? createCharacterSketchGenerationId()
  await mkdir(catalog.root, { recursive: true })
  const temporaryDirectory = await mkdtemp(join(catalog.root, '.character-sketch-tmp-'))
  const startTime = Date.now()
  comicLog.header('comic reference-sketch --character', [`character=${key}`, `generation=${generationId}`])
  comicLog.line('config', [`model=${model}`, `size=${size}`, `quality=${quality}`, options.revise ? 'revise=true' : undefined])

  try {
    const prompts = (await loadPromptsConfig())['Character Sketch Prompts']
    const stats = createImageRunStats()
    const tasks = CHARACTER_SKETCH_VIEWS.map(view => async () => {
      const outputPath = getCharacterSketchImagePathForDirectory(temporaryDirectory, view)
      const references = options.revise && !usesSingleReference
        ? [character.sourcePath, character.outlineSheetPath]
        : [stableReferencePath]
      const requestStart = Date.now()
      const response = await requestImage(buildPrompt(character.name, character.description, view, prompts, options.notes, character.generationInstructions, bootstrap), references, model, size, quality)
      const duration = Date.now() - requestStart
      stats.totalDurationMs += duration
      await writeImage(outputPath, response.result.imageBase64, response.result.mimeType)
      const { costLabel } = updateImageRunStatsWithCostFallback(model, stats, quality, size)
      stats.imagesGenerated++
      comicLog.output('generated', 'character-sketch', [`view=${view}`, `refs=${references.length}`, `cost=${costLabel}`, `duration=${formatDuration(duration)}`])
    })
    await runWithConcurrency(options.concurrency ?? DEFAULT_CLI_CONCURRENCY, tasks)

    const sheetSelection = selectCharacterSketchSheetSources(temporaryDirectory)
    await composeSheet(sheetSelection)
    const stagedSheet = sheetSelection.outputPath
    const sheetSha256 = await checksumFile(stagedSheet)

    await withCharacterSketchManifestLock(async () => {
      if (await checksumFile(stableReferencePath) !== stableReferenceSha256 || (bootstrap && existsSync(character.sourcePath))) {
        throw ValidationError(`The source or generation reference for "${key}" changed during generation; the new sheet was not registered.`, { stage: 'comic:character-sketch' })
      }
      if (options.revise) {
        const latest = await requireCurrentCharacterSketch(key, character)
        if (!current || latest.generationId !== current.generationId || latest.sheetSha256 !== current.sheetSha256) {
          throw ValidationError(`The registered outline sheet for "${key}" changed during revision; retry against the current sheet.`, { stage: 'comic:character-sketch' })
        }
      }

      const manifest = await readCharacterSketchManifest(catalog.root)
      const prior = manifest.sketches.find(sketch => sketch.characterKey === key)
      const registration = {
        characterKey: key,
        generationId,
        origin: options.revise ? 'revision' as const : 'generated' as const,
        sourceImage: character.image,
        outlineSheet: character.outlineSheet,
        sourceSha256: usesSingleReference ? sheetSha256 : stableReferenceSha256,
        sheetSha256,
        model,
        createdAt: new Date().toISOString(),
        ...(prior ? { priorGenerationId: prior.generationId } : {}),
      }
      const nextManifest = {
        schemaVersion: 1 as const,
        sketches: [...manifest.sketches.filter(sketch => sketch.characterKey !== key), registration],
      }
      const manifestPath = getCharacterSketchManifestPath(catalog.root)
      const manifestTemporaryPath = `${manifestPath}.tmp-${crypto.randomUUID()}`
      const sheetBackupPath = `${character.outlineSheetPath}.backup-${crypto.randomUUID()}`
      const hadSheet = await Bun.file(character.outlineSheetPath).exists()
      await mkdir(dirname(character.outlineSheetPath), { recursive: true })
      await Bun.write(manifestTemporaryPath, `${JSON.stringify(nextManifest, null, 2)}\n`)
      let sheetPromoted = false
      try {
        if (hadSheet) await rename(character.outlineSheetPath, sheetBackupPath)
        await rename(stagedSheet, character.outlineSheetPath)
        sheetPromoted = true
        await rename(manifestTemporaryPath, manifestPath)
        if (hadSheet) await rm(sheetBackupPath, { force: true }).catch(() => undefined)
      } catch (promotionError) {
        await rm(manifestTemporaryPath, { force: true }).catch(() => undefined)
        if (sheetPromoted) await rm(character.outlineSheetPath, { force: true }).catch(() => undefined)
        if (hadSheet) {
          await rename(sheetBackupPath, character.outlineSheetPath).catch(rollbackError => {
            throw InfraError(`Character sketch promotion failed and rollback also failed for "${key}": ${String(rollbackError)}`, { stage: 'comic:character-sketch' })
          })
        }
        throw promotionError
      }
    })

    comicLog.summary([`generated=${stats.imagesGenerated}`, `cost=${formatCompactCost(stats.totalCost)}`, `duration=${formatDuration(Date.now() - startTime)}`])
    comicLog.outputDirectory(relative(process.cwd(), dirname(character.outlineSheetPath)) || dirname(character.outlineSheetPath))
  } catch (error) {
    err('Character sketch generation failed:', error instanceof Error ? error.message : String(error))
    throw InfraError(`Character sketch generation ${generationId} failed; the registered outline sheet was not changed`, { stage: 'comic:character-sketch', cause: error instanceof Error ? error : undefined })
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}
