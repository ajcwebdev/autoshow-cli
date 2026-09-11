import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { DirectoryEntry, GeneratePanelImagesOptions, GenerateWithQaRepairInput, ImagePromptVariation, PanelRenderContext } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { describeBlockingLayoutGuideMarkers, shouldUseBlockingLayoutGuide } from '../../comic-utils/blocking-layout-guide'
import { getBlockingPanelLayoutGuidePath } from '../../comic-utils/blocking-plan-paths'
import {
  extractPanelBundleData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  normalizePromptBundle,
  resolvePrimaryCharacterReferences,
  resolveReferenceImages
} from '../../comic-utils/panel-prompt-utils'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { buildComicPagePrompt } from './comic-page-utils'
import {
  applyImagePromptVariation
} from './prompt-variations'

export const preparePanelPrompt = async (panelEntry: DirectoryEntry, sceneDirectory: string) => {
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
  return { panelNumber, panelDirectory, panelEntries, bundleData }
}

export const preparePanelRepairRequest = async (prepared: Awaited<ReturnType<typeof preparePanelPrompt>>, ctx: PanelRenderContext, variation: ImagePromptVariation, model: GeneratePanelImagesOptions['models'][number]): Promise<GenerateWithQaRepairInput> => {
  const { panelNumber, panelDirectory, panelEntries, bundleData } = prepared
  const { sceneSlug, options, useVariationOutputPaths, useModelSpecificFilenames, prompts, requestImage, writeImage, judge, requestRepairComparison, qaEnabled, judgeModel, maxRepairs, nextHostedIndex } = ctx
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

  return {
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
  }
}
