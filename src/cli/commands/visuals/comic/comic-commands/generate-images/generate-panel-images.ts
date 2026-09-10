import type { DirectoryEntry } from '~/types'
import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { err, comicLog } from '../../comic-utils/comic-logger'
import { getPanelPromptsDirectory, getPanelsDirectory, getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { getBlockingPanelLayoutGuidePath, getBlockingPlanPathForWorkspace } from '../../comic-utils/blocking-plan-paths'
import { describeBlockingLayoutGuideMarkers, shouldUseBlockingLayoutGuide } from '../../comic-utils/blocking-layout-guide'
import { sha256Bytes } from '~/utils/value-helpers'
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
import {
  applyImagePromptVariation,
  getImagePromptVariationLabel,
} from './prompt-variations'
import { InfraError, ValidationError } from '~/utils/error-handler'
import type {
  ComicImageGenerationDependencies,
  GeneratePanelImagesOptions,
  ImagePromptVariation,
  GenerateWithQaRepairResult,
  PageQaEntry,
  PanelRenderContext,
  PanelRenderResult,
} from '~/types'
import { judgeComicPage } from './comic-page-qa'
import { DEFAULT_QA_MODEL } from '../../comic-utils/cli-args'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { failedQaRepairEvidenceFromError, generateWithQaRepair } from './panel-qa-pipeline'
import { captureBloopers } from '../../comic-utils/blooper-ledger'
import { runComicImageWorkItems } from './comic-image-work-items'

/** Episode label for the blooper tree: the leading numeric group of the scene slug, else the slug itself. */
export const resolveEpisodeLabel = (sceneSlug: string): string => /^(\d+)-/u.exec(sceneSlug)?.[1] ?? sceneSlug

const renderSinglePanel = async (
  panelEntry: DirectoryEntry,
  ctx: PanelRenderContext
): Promise<PanelRenderResult> => {
  const resultStats = createImageRunStats()
  const qaEntries: Array<{ directory: string; entry: PageQaEntry }> = []
  const { sceneSlug, sceneDirectory, options, variations, useVariationOutputPaths, useModelSpecificFilenames, prompts, requestImage, writeImage, judge, requestRepairComparison, qaEnabled, judgeModel, maxRepairs, nextHostedIndex } = ctx
  const recordRepairResult = (repairResult: GenerateWithQaRepairResult, outputDirectory: string): void => {
    resultStats.imagesGenerated += repairResult.imagesGenerated
    resultStats.totalDurationMs += repairResult.totalDurationMs
    resultStats.totalInputTokens += repairResult.totalInputTokens
    resultStats.totalOutputTokens += repairResult.totalOutputTokens
    resultStats.totalInputImageTokens += repairResult.imageInputUnits
    resultStats.totalInputTextTokens += repairResult.textInputUnits
    resultStats.totalOutputImageTokens += repairResult.imageOutputUnits
    resultStats.totalCost += repairResult.totalCostUsd
    for (const costEntry of repairResult.costEntries) updateImageRunStatsWithCostFallback(costEntry.model, resultStats, options.quality, options.size)
    if (repairResult.qaEntry) qaEntries.push({ directory: outputDirectory, entry: repairResult.qaEntry })
  }

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
        const useBlockingLayoutGuide = options.blockingLayoutGuide === true && shouldUseBlockingLayoutGuide(bundleData.blocking)
        const reservedSlots = (qaEnabled && maxRepairs > 0 ? 1 : 0) + (useBlockingLayoutGuide ? 1 : 0)
        const resolvedReferences = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model, { reserveSlots: reservedSlots })
        const blockingLayoutPath = useBlockingLayoutGuide ? getBlockingPanelLayoutGuidePath(sceneSlug, panelNumber) : undefined
        const referenceImages = blockingLayoutPath ? [...resolvedReferences.all, blockingLayoutPath] : resolvedReferences.all
        const blockingLayoutReference = blockingLayoutPath && bundleData.blocking
          ? { markerLegend: describeBlockingLayoutGuideMarkers(bundleData.blocking) }
          : undefined
        const contractPrompt = buildComicPagePrompt(bundleData, resolvedReferences.characterReferences ?? [], resolvedReferences.locationReferences ?? [], resolvedReferences.designReferences ?? [], blockingLayoutReference)
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
          requestRepairComparison,
          qaEnabled,
          judgeModel,
          maxRepairs,
          ...(options.blockingHardKeys?.length ? { blockingHardKeys: options.blockingHardKeys } : {}),
          nextHostedIndex,
        })

        recordRepairResult(repairResult, dirname(outputPath))

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
          continue
        }

        if (options.bloopers) {
          await captureBloopers({
            sceneSlug,
            episode: resolveEpisodeLabel(sceneSlug),
            runId: options.runId,
            panelNumber,
            promotedPath: outputPath,
            attemptsDirectory: join(dirname(outputPath), 'attempts', `panel-${String(panelNumber).padStart(2, '0')}`),
            imageModel: model,
          })
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
    const failure = failedQaRepairEvidenceFromError(error)
    if (failure) recordRepairResult(failure, failure.outputDirectory)
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

  const preflightFailures: string[] = []
  const blockingPlanPath = getBlockingPlanPathForWorkspace(getSceneOutputDirectory(sceneSlug))
  const blockingPlanSha256 = existsSync(blockingPlanPath) ? sha256Bytes(new Uint8Array(await Bun.file(blockingPlanPath).arrayBuffer())) : null
  for (const panelEntry of panelDirectories) {
    const panelDirectory = join(sceneDirectory, panelEntry.name)
    try {
      const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
      const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
      const bundleData = extractPanelBundleData(await Bun.file(join(panelDirectory, promptFilename)).text())
      if (bundleData.planSha256 !== undefined && bundleData.planSha256 !== blockingPlanSha256) {
        preflightFailures.push(`Panel bundle plan hash ${bundleData.planSha256} does not match metadata/blocking-plan.json ${blockingPlanSha256 ?? 'missing'}; rerun draft-scenes --only panel-prompts`)
      }
      for (const model of options.models) {
        const useBlockingLayoutGuide = options.blockingLayoutGuide === true && shouldUseBlockingLayoutGuide(bundleData.blocking)
        const reservedSlots = (qaEnabled && maxRepairs > 0 ? 1 : 0) + (useBlockingLayoutGuide ? 1 : 0)
        const references = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model, { reserveSlots: reservedSlots })
        const blockingLayoutPath = useBlockingLayoutGuide ? getBlockingPanelLayoutGuidePath(sceneSlug, getPanelNumberFromName(panelEntry.name)!) : undefined
        const allReferences = blockingLayoutPath ? [...references.all, blockingLayoutPath] : references.all
        validateReferenceImageCount(model, allReferences.length + (qaEnabled && maxRepairs > 0 ? 1 : 0), `Image and QA references for ${panelEntry.name}`)
        const missing = await Promise.all(allReferences.map(async path => await Bun.file(path).exists() ? null : path))
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
    requestRepairComparison: dependencies.requestRepairComparison,
    qaEnabled,
    judgeModel,
    maxRepairs,
    nextHostedIndex,
  }

  return await runComicImageWorkItems({
    concurrency: options.concurrency,
    items: panelDirectories,
    render: async panelEntry => await renderSinglePanel(panelEntry, renderContext),
    stats,
    qaEnabled,
    qaHardFailure: {
      message: count => `${count} panel QA hard failure(s); generated artifacts and QA reports were preserved.`,
      stage: 'comic:panel-qa',
    },
    ...(options.stopOnProviderError === true ? { stopOnProviderError: true } : {}),
    describeItem: panelEntry => panelEntry.name,
    itemFailure: { message: count => `${count} image generation task(s) failed`, stage: 'comic:generate-images' }
  })
}
