import type { Dirent } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { err, comicLog } from '../../comic-utils/comic-logger'
import { getPanelPromptsDirectory, getPanelsDirectory } from '../../comic-utils/project-paths'
import { createImage } from '../../comic-image-services/comic-image-targets'
import {
  createImageRunStats,
  updateImageRunStatsWithCostFallback,
} from '../../comic-image-services/image-costs'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import {
  extractPanelBundleData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  normalizePromptBundle,
  resolvePrimaryCharacterReferences,
  resolveReferenceImages,
  resolveScenePanelDirectories,
} from '../../comic-utils/panel-prompt-utils'
import { buildComicPagePrompt, selectComicPanels } from './comic-page-utils'
import { getPanelComicImagePath, loadPromptsConfig } from '../../comic-utils/scene-utils'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import {
  applyImagePromptVariation,
  getImagePromptVariationLabel,
} from './prompt-variations'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type {
  ComicImageGenerationDependencies,
  GeneratePanelImagesOptions,
  ImagePromptVariation,
  ImageRunStats,
  PromptsConfig,
} from '~/types'
import {
  judgeComicPage,
  writePageQaReports,
  type PageQaEntry,
} from './comic-page-qa'
import { DEFAULT_QA_MODEL } from '../../comic-utils/cli-args'
import { DEFAULT_IMAGE_MODEL } from '../../comic-utils/image-size'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { generateWithQaRepair } from './panel-qa-pipeline'

export interface PanelRenderContext {
  sceneSlug: string
  sceneDirectory: string
  options: GeneratePanelImagesOptions
  variations: ImagePromptVariation[]
  useVariationOutputPaths: boolean
  useModelSpecificFilenames: boolean
  prompts?: PromptsConfig | undefined
  requestImage: NonNullable<ComicImageGenerationDependencies['requestImage']>
  writeImage: typeof writeGeneratedImage
  judge: NonNullable<ComicImageGenerationDependencies['judgePage']>
  qaEnabled: boolean
  judgeModel: string
  maxRepairs: number
  nextHostedIndex: () => number
}

export interface PanelRenderResult {
  stats: ImageRunStats
  qaEntries: Array<{ directory: string; entry: PageQaEntry }>
  error?: unknown | undefined
}

export const renderSinglePanel = async (
  panelEntry: Dirent,
  ctx: PanelRenderContext
): Promise<PanelRenderResult> => {
  const resultStats = createImageRunStats()
  const qaEntries: Array<{ directory: string; entry: PageQaEntry }> = []
  const { sceneSlug, sceneDirectory, options, variations, useVariationOutputPaths, useModelSpecificFilenames, prompts, requestImage, writeImage, judge, qaEnabled, judgeModel, maxRepairs, nextHostedIndex } = ctx

  try {
    const panelNumber = getPanelNumberFromName(panelEntry.name)!
    const panelDirectory = join(sceneDirectory, panelEntry.name)
    const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
    const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
    const promptContent = await Bun.file(join(panelDirectory, promptFilename)).text()

    if (!promptContent.trim()) {
      throw ValidationError(`Prompt bundle "${promptFilename}" is empty`, { stage: 'comic:generate-images' })
    }

    const normalizedPrompt = normalizePromptBundle(promptContent)
    if (!normalizedPrompt) {
      throw ValidationError(`Prompt bundle "${promptFilename}" became empty after normalization`, { stage: 'comic:generate-images' })
    }

    const bundleData = extractPanelBundleData(promptContent)
    const primaryCharacterReferenceState = resolvePrimaryCharacterReferences(
      panelDirectory,
      panelEntries,
      bundleData,
    )
    if (primaryCharacterReferenceState.missingPrimaryCharacterRefs.length > 0) {
      throw InfraError(
        `Missing character reference images in ${panelEntry.name}: ` +
        `${primaryCharacterReferenceState.missingPrimaryCharacterRefs.join(', ')}. ` +
        `Re-run "bun autoshow comic draft-scenes <script-path> --only panel-prompts" ` +
        `after generating any missing character sketches.`,
        { stage: 'comic:generate-images' }
      )
    }

    await mkdir(getPanelsDirectory(sceneSlug), { recursive: true })

    for (const variation of variations) {
      for (const model of options.models) {
        const outputPath = getPanelComicImagePath(
          sceneSlug,
          panelNumber,
          useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
          useVariationOutputPaths ? variation : undefined,
          options.runId
        )
        const resolvedReferences = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model)
        const referenceImages = resolvedReferences.all
        const contractPrompt = buildComicPagePrompt(bundleData, resolvedReferences.characterReferences ?? [], resolvedReferences.locationReferences ?? [], resolvedReferences.designReferences ?? [])
        const promptForVariation = prompts
          ? applyImagePromptVariation(contractPrompt, variation, prompts)
          : contractPrompt

        const canonicalExists = await Bun.file(outputPath).exists()
        const outputExists = !options.force && canonicalExists

        const repairResult = await generateWithQaRepair({
          kind: 'panel',
          itemNumber: panelNumber,
          outputPath,
          canonicalExists,
          outputExists,
          force: Boolean(options.force),
          model,
          promptForVariation,
          referenceImages,
          bundleData,
          resolvedReferences,
          sceneSlug,
          options,
          requestImage,
          writeImage,
          judge,
          qaEnabled,
          judgeModel,
          maxRepairs,
          nextHostedIndex,
        })

        resultStats.imagesGenerated += repairResult.imagesGenerated
        resultStats.totalDurationMs += repairResult.totalDurationMs
        resultStats.totalInputTokens += repairResult.totalInputTokens
        resultStats.totalOutputTokens += repairResult.totalOutputTokens
        resultStats.totalCost += repairResult.totalCostUsd
        for (const costEntry of repairResult.costEntries) {
          updateImageRunStatsWithCostFallback(costEntry.model, resultStats, options.quality, options.size)
        }

        if (repairResult.status === 'skipped') {
          resultStats.imagesSkipped++
          comicLog.output('skipped', 'panel', [
            `id=panel-${String(panelNumber).padStart(2, '0')}`,
            `panel=${panelNumber}`,
            `model=${model}`,
            useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
            `refs=${referenceImages.length}`,
            `path=${outputPath}`,
          ])
          if (repairResult.qaEntry) {
            qaEntries.push({ directory: dirname(outputPath), entry: repairResult.qaEntry })
          }
          continue
        }

        if (repairResult.qaEntry) {
          qaEntries.push({ directory: dirname(outputPath), entry: repairResult.qaEntry })
        }

        comicLog.output('generated', 'panel', [
          `id=panel-${String(panelNumber).padStart(2, '0')}`,
          `panel=${panelNumber}`,
          `model=${model}`,
          useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
          `refs=${referenceImages.length}`,
          `path=${outputPath}`,
        ])
      }
    }
  } catch (error) {
    err(`Failed to generate ${sceneSlug}/${panelEntry.name}:`, error instanceof Error ? error.message : String(error))
    return { stats: resultStats, qaEntries, error }
  }

  return { stats: resultStats, qaEntries }
}

export const generatePanelImages = async (
  sceneSlug: string,
  options: GeneratePanelImagesOptions,
  dependencies: ComicImageGenerationDependencies = {},
) => {
  const stats = createImageRunStats()
  const useModelSpecificFilenames = options.models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined
  const requestImage = dependencies.requestImage ?? (async input => await createImage(input.normalizedPrompt, input.referenceImages, input.model, input.size, input.quality))
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const judge = dependencies.judgePage ?? judgeComicPage
  const qaEnabled = options.qa ?? true
  const judgeModel = options.qaModel ?? DEFAULT_QA_MODEL
  const maxRepairs = options.maxRepairs ?? 2
  let hostedRequestIndex = 0
  const nextHostedIndex = () => hostedRequestIndex++

  const prompts = useVariationOutputPaths ? await loadPromptsConfig() : undefined
  const sceneDirectory = getPanelPromptsDirectory(sceneSlug)

  const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
  let panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)

  if (options.panels !== undefined) {
    const panelSources = panelDirectories.map(entry => ({
      panelNumber: getPanelNumberFromName(entry.name)!,
      entry,
    }))
    const selected = selectComicPanels(
      panelSources,
      options.panels,
      undefined,
      sceneSlug,
    )
    panelDirectories = selected.map(s => s.entry)
  }

  for (const panelEntry of panelDirectories) {
    if (!getPanelNumberFromName(panelEntry.name)) {
      throw ValidationError(`Invalid panel directory name "${panelEntry.name}"`, { stage: 'comic:generate-images' })
    }
  }

  // Preflight validation
  const preflightFailures: string[] = []
  for (const panelEntry of panelDirectories) {
    const panelDirectory = join(sceneDirectory, panelEntry.name)
    try {
      const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
      const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
      const bundleData = extractPanelBundleData(await Bun.file(join(panelDirectory, promptFilename)).text())
      for (const model of options.models) {
        const references = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model)
        if (qaEnabled && maxRepairs > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, references.all.length + 1, `QA edits for ${panelEntry.name}`)
        const missing = await Promise.all(references.all.map(async path => await Bun.file(path).exists() ? null : path))
        preflightFailures.push(...missing.filter((path): path is string => path !== null))
      }
    } catch (error) {
      preflightFailures.push(`${panelEntry.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (preflightFailures.length > 0) {
    throw ValidationError(`Image preflight failed before any provider calls:\n- ${Array.from(new Set(preflightFailures)).join('\n- ')}`, { stage: 'comic:generate-images' })
  }

  const renderContext: PanelRenderContext = {
    sceneSlug,
    sceneDirectory,
    options,
    variations,
    useVariationOutputPaths,
    useModelSpecificFilenames,
    prompts,
    requestImage,
    writeImage,
    judge,
    qaEnabled,
    judgeModel,
    maxRepairs,
    nextHostedIndex,
  }

  const results = await mapWithConcurrency(options.concurrency, panelDirectories, async panelEntry => await renderSinglePanel(panelEntry, renderContext))

  const qaEntriesByDirectory = new Map<string, PageQaEntry[]>()
  let errorCount = 0

  for (const res of results) {
    if (res.error) errorCount++
    stats.imagesGenerated += res.stats.imagesGenerated
    stats.imagesSkipped += res.stats.imagesSkipped
    stats.totalDurationMs += res.stats.totalDurationMs
    stats.totalInputTokens += res.stats.totalInputTokens
    stats.totalOutputTokens += res.stats.totalOutputTokens
    stats.totalCost += res.stats.totalCost
    for (const { directory, entry } of res.qaEntries) {
      const entries = qaEntriesByDirectory.get(directory) ?? []
      entries.push(entry)
      qaEntriesByDirectory.set(directory, entries)
    }
  }

  if (qaEnabled) {
    for (const [directory, entries] of qaEntriesByDirectory) {
      await writePageQaReports(directory, entries)
    }
  }

  if (errorCount > 0) {
    throw InfraError(`${errorCount} image generation task(s) failed`, { stage: 'comic:generate-images' })
  }

  return stats
}
