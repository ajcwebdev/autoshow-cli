import type { DirectoryEntry } from '~/types'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { FinalImageEstimateRequest, FinalImageInventory, FinalImageOutputInventory, FinalImagePageInventory, FinalImagePanelInventory, ImageGenerationModel, PanelDirectoryInventory } from '~/types'
import {
  chunkComicGridPanels,
  chunkComicPagePanels,
  buildComicPagePromptData,
  selectComicPanels,
} from '../comic-commands/generate-images/comic-page-utils'
import { readReusablePageQaEntry } from '../comic-commands/generate-images/comic-page-qa'
import {
  applyReferenceImageLimits,
  extractPanelBundleData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  PANEL_DIRECTORY_PATTERN,
  resolveDesignReferencesAcrossPanels,
  resolveLocationReferencesAcrossPanels,
  resolvePrimaryCharacterReferencesAcrossPanels,
  resolveGroupedReferenceImages,
  resolveReferenceImages,
} from './panel-prompt-utils'
import { validateReferenceImageCount } from './reference-capabilities'
import { DEFAULT_IMAGE_MODEL } from './image-size'
import { getPanelPromptsDirectory } from './project-paths'
import {
  getPageComicImagePath,
  getPanelComicImagePath,
} from './scene-utils'
import { shouldUseBlockingLayoutGuide } from './blocking-layout-guide'

const readPricePanelInput = async (
  panelPromptsDir: string,
  panelNumber: number,
) => {
  const panelDirectory = join(panelPromptsDir, `panel-${String(panelNumber).padStart(2, '0')}`)
  const entries = await readdir(panelDirectory, { withFileTypes: true })
  const promptFilename = getPromptBundleFilename(panelDirectory, entries)
  const bundleData = extractPanelBundleData(await Bun.file(join(panelDirectory, promptFilename)).text())
  return { panelDirectory, entries, bundleData }
}

export const validatePriceReferenceGroup = async (
  panelPromptsDir: string,
  panelNumbers: readonly number[],
  models: readonly ImageGenerationModel[],
  blockingLayoutGuide = false,
): Promise<number> => {
  const panels = await Promise.all(panelNumbers.map(number => readPricePanelInput(panelPromptsDir, number)))
  const primary = resolvePrimaryCharacterReferencesAcrossPanels(panels, { composeDerived: false })
  const locations = resolveLocationReferencesAcrossPanels(panels)
  const designs = resolveDesignReferencesAcrossPanels(panels)
  const blockingLayoutGuideCount = blockingLayoutGuide && panels.length === 1 && shouldUseBlockingLayoutGuide(panels[0]?.bundleData.blocking) ? 1 : 0
  const locationPlaceholders = locations.map((_, index) => `__location-${index + 1}__`)
  const designPlaceholders = designs.map((_, index) => `__design-${index + 1}__`)
  const blockingLayoutPlaceholders = Array.from({ length: blockingLayoutGuideCount }, (_, index) => `__blocking-layout-${index + 1}__`)

  for (const model of models) {
    applyReferenceImageLimits(
      [...primary.primaryCharacterRefs, ...locationPlaceholders, ...designPlaceholders, ...blockingLayoutPlaceholders],
      [],
      [...locationPlaceholders, ...designPlaceholders],
      primary.missingPrimaryCharacterRefs,
      model,
    )
  }
  return primary.primaryCharacterRefs.length + locations.length + designs.length + blockingLayoutGuideCount
}

const isCurrentPassingQaReusable = async (
  request: FinalImageEstimateRequest,
  panels: Awaited<ReturnType<typeof readPricePanelInput>>[],
  itemNumber: number,
  outputPath: string,
  model: ImageGenerationModel,
): Promise<boolean> => {
  if (request.force || !request.qa.enabled || !existsSync(outputPath)) return false
  const first = panels[0]
  if (!first) return false
  const grouped = request.mode === 'page'
  const references = grouped
    ? resolveGroupedReferenceImages(panels.map(panel => ({ panelDirectory: panel.panelDirectory, panelEntries: panel.entries, bundleData: panel.bundleData })), model)
    : resolveReferenceImages(first.panelDirectory, first.entries, first.bundleData, model)
  const current = {
    pageNumber: itemNumber,
    pagePath: outputPath,
    panelData: grouped ? buildComicPagePromptData(panels.map(panel => panel.bundleData)) : first.bundleData,
    identityCards: references.primaryCharacterRefs,
    locationSheets: references.secondaryRefs,
    designSheets: references.designReferences?.map(reference => reference.path),
    characterReferences: references.characterReferences,
    locationReferences: references.locationReferences,
    designReferences: references.designReferences,
    ...(!grouped && references.rosterCharacterReferences?.length ? { rosterCards: references.rosterCharacterReferences } : {}),
    ...(request.blockingHardKeys?.length ? { blockingHardKeys: request.blockingHardKeys } : {}),
    model: request.qa.judgeModel,
  }
  const entry = await readReusablePageQaEntry(outputPath, request.qa.judgeModel, current)
  return entry !== undefined && !entry.hardFailure
}

export const resolveFinalImageOutputPathParts = (
  request: FinalImageEstimateRequest,
  model: ImageGenerationModel,
  variation: FinalImageEstimateRequest['variations'][number],
): { model?: ImageGenerationModel; variation?: typeof variation } => ({
  ...(request.variationsSpecified
    ? { model, variation }
    : request.models.length > 1
      ? { model }
      : {}),
})

const buildPageOutputInventory = async (
  request: Extract<FinalImageEstimateRequest, { mode: 'page' }>,
  pageNumber: number,
  panelNumbers: readonly number[],
  panelPromptsDir: string,
): Promise<FinalImageOutputInventory[]> => {
  const panels = await Promise.all(panelNumbers.map(number => readPricePanelInput(panelPromptsDir, number)))
  return await Promise.all(request.models.flatMap(model => request.variations.map(async variation => {
    const pathParts = resolveFinalImageOutputPathParts(request, model, variation)
    const outputPath = getPageComicImagePath(
      request.sceneSlug,
      pageNumber,
      [...panelNumbers],
      pathParts.model,
      pathParts.variation,
      request.runId,
    )
    return {
      model,
      variation,
      outputPath,
      exists: existsSync(outputPath),
      qaReportReusable: await isCurrentPassingQaReusable(request, panels, pageNumber, outputPath, model),
    }
  })))
}

const buildPageInventory = async (
  request: Extract<FinalImageEstimateRequest, { mode: 'page' }>,
  panelPromptsDir: string,
  panelNumbers: readonly number[],
): Promise<FinalImagePageInventory> => {
  const selectedPanels = selectComicPanels(
    panelNumbers.map(panelNumber => ({ panelNumber })),
    request.selection,
    undefined,
    request.sceneSlug,
  )
  const chunks = chunkComicPagePanels(selectedPanels, request.panelsPerImage)
  const pages = []

  for (const chunk of chunks) {
    const referenceCount = await validatePriceReferenceGroup(
      panelPromptsDir,
      chunk.panelNumbers,
      request.models,
      request.blockingLayoutGuide,
    )
    if (request.qa.enabled && request.qa.maxRepairs > 0) {
      validateReferenceImageCount(
        DEFAULT_IMAGE_MODEL,
        referenceCount + 1,
        `QA edits for page ${chunk.pageNumber}`,
      )
    }
    pages.push({
      pageNumber: chunk.pageNumber,
      panelNumbers: chunk.panelNumbers,
      referenceCount,
      outputs: await buildPageOutputInventory(request, chunk.pageNumber, chunk.panelNumbers, panelPromptsDir),
    })
  }

  return { mode: 'page', panelPromptsDir, pages }
}

const selectPanelDirectories = (
  request: Extract<FinalImageEstimateRequest, { mode: 'panel' | 'grid' }>,
  panelDirectories: readonly PanelDirectoryInventory[],
): PanelDirectoryInventory[] => {
  if (!request.selectionSpecified) return [...panelDirectories]
  return selectComicPanels(
    panelDirectories.map(panel => ({
      panelNumber: panel.panelNumber,
      directoryName: panel.directoryName,
    })),
    request.selection,
    undefined,
    request.sceneSlug,
  )
}

const buildPanelInventory = async (
  request: Extract<FinalImageEstimateRequest, { mode: 'panel' | 'grid' }>,
  panelPromptsDir: string,
  panelDirectories: readonly PanelDirectoryInventory[],
): Promise<FinalImagePanelInventory> => {
  const selectedPanels = selectPanelDirectories(request, panelDirectories)
  const panels = []

  for (const panel of selectedPanels) {
    const source = await readPricePanelInput(panelPromptsDir, panel.panelNumber)
    const referenceCount = await validatePriceReferenceGroup(
      panelPromptsDir,
      [panel.panelNumber],
      request.models,
      request.blockingLayoutGuide,
    )
    if (request.qa.enabled && request.qa.maxRepairs > 0) {
      validateReferenceImageCount(
        DEFAULT_IMAGE_MODEL,
        referenceCount + 1,
        `QA edits for panel ${panel.panelNumber}`,
      )
    }
    panels.push({
      ...panel,
      referenceCount,
      variations: await Promise.all(request.variations.map(async variation => {
        const outputs = await Promise.all(request.models.map(async model => {
          const pathParts = resolveFinalImageOutputPathParts(request, model, variation)
          const path = getPanelComicImagePath(
            request.sceneSlug,
            panel.panelNumber,
            pathParts.model,
            pathParts.variation,
            request.runId,
          )
          return { exists: existsSync(path), qaReusable: await isCurrentPassingQaReusable(request, [source], panel.panelNumber, path, model) }
        }))
        return { variation, allModelsExist: outputs.every(output => output.exists), qaReusable: outputs.every(output => output.qaReusable), pendingQaCount: outputs.filter(output => !output.qaReusable).length }
      })),
    })
  }

  return {
    mode: request.mode,
    panelPromptsDir,
    panels,
    gridPages: request.mode === 'grid'
      ? buildGridInventory(request, selectedPanels.map(panel => panel.panelNumber))
      : [],
  }
}

const buildGridInventory = (
  request: Extract<FinalImageEstimateRequest, { mode: 'grid' }>,
  panelNumbers: readonly number[],
): FinalImagePanelInventory['gridPages'] => {
  return chunkComicGridPanels(
    panelNumbers.map(panelNumber => ({ panelNumber })),
    request.grid,
  ).map(chunk => ({
    pageNumber: chunk.pageNumber,
    panelNumbers: chunk.panelNumbers,
    outputs: request.models.flatMap(model => request.variations.map(variation => {
      const pathParts = resolveFinalImageOutputPathParts(request, model, variation)
      const outputPath = getPageComicImagePath(
        request.sceneSlug,
        chunk.pageNumber,
        chunk.panelNumbers,
        pathParts.model,
        pathParts.variation,
        request.runId,
      )
      return {
        model,
        variation,
        outputPath,
        exists: existsSync(outputPath),
        qaReportReusable: false,
      }
    })),
  }))
}

const listPanelDirectories = (entries: readonly DirectoryEntry[]): PanelDirectoryInventory[] => {
  return entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => ({
      directoryName: entry.name,
      panelNumber: getPanelNumberFromName(entry.name),
    }))
    .filter((panel): panel is PanelDirectoryInventory => panel.panelNumber !== null)
    .sort((left, right) => left.directoryName < right.directoryName ? -1 : left.directoryName > right.directoryName ? 1 : 0)
}

export const loadFinalImageEstimateInventory = async (
  request: FinalImageEstimateRequest,
): Promise<FinalImageInventory> => {
  const panelPromptsDir = getPanelPromptsDirectory(request.sceneSlug)
  if (!existsSync(panelPromptsDir)) return { status: 'missing-prompts' }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelDirectories = listPanelDirectories(entries)
  if (panelDirectories.length === 0) return { status: 'empty' }

  if (request.mode === 'page') {
    const panelNumbers = panelDirectories
      .map(panel => panel.panelNumber)
      .sort((left, right) => left - right)
    return {
      status: 'ready',
      inventory: await buildPageInventory(request, panelPromptsDir, panelNumbers),
    }
  }

  return {
    status: 'ready',
    inventory: await buildPanelInventory(request, panelPromptsDir, panelDirectories),
  }
}
