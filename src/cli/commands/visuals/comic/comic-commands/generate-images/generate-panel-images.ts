import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  ComicImageGenerationDependencies, DirectoryEntry, GeneratePanelImagesOptions,
  ImagePromptVariation, PageQaEntry,
  PanelRenderContext,
  PanelRenderResult
} from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { createImage } from '../../comic-image-services/comic-image-targets'
import {
  createImageRunStats
} from '../../comic-image-services/image-costs'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { shouldUseBlockingLayoutGuide } from '../../comic-utils/blocking-layout-guide'
import { getBlockingPanelLayoutGuidePath, getBlockingPlanPathForWorkspace } from '../../comic-utils/blocking-plan-paths'
import { DEFAULT_QA_MODEL } from '../../comic-utils/cli-args'
import { err } from '../../comic-utils/comic-logger'
import {
  extractPanelBundleData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  resolveReferenceImages,
  resolveScenePanelDirectories
} from '../../comic-utils/panel-prompt-utils'
import { getPanelPromptsDirectory, getPanelsDirectory, getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { loadPromptsConfig } from '../../comic-utils/scene-utils'
import { runComicImageWorkItems } from './comic-image-work-items'
import { judgeComicPage } from './comic-page-qa'
import { selectComicPanels } from './comic-page-utils'
import { preparePanelPrompt, preparePanelRepairRequest } from './comic-panel-request-preparation'
import { presentPanelRepairResult, recordPanelRepairResult } from './comic-panel-result-presentation'
import { failedQaRepairEvidenceFromError, generateWithQaRepair } from './panel-qa-pipeline'

const renderSinglePanel = async (
  panelEntry: DirectoryEntry,
  ctx: PanelRenderContext
): Promise<PanelRenderResult> => {
  const resultStats = createImageRunStats()
  const qaEntries: Array<{ directory: string; entry: PageQaEntry }> = []
  const { sceneSlug, sceneDirectory, options, variations } = ctx


  try {
    const prepared = await preparePanelPrompt(panelEntry, sceneDirectory)
    await mkdir(getPanelsDirectory(sceneSlug), { recursive: true })

    for (const variation of variations) {
      for (const model of options.models) {
        const request = await preparePanelRepairRequest(prepared, ctx, variation, model)
        const repairResult = await generateWithQaRepair(request)

        recordPanelRepairResult(resultStats, qaEntries, options, repairResult, dirname(request.outputPath))

        await presentPanelRepairResult(repairResult, request, ctx, variation, resultStats)
      }
    }
  } catch (error) {
    const failure = failedQaRepairEvidenceFromError(error)
    if (failure) recordPanelRepairResult(resultStats, qaEntries, options, failure, failure.outputDirectory)
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

export { resolveEpisodeLabel } from './comic-panel-result-presentation'
