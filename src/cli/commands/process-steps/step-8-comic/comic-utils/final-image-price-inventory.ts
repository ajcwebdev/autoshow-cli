import type { DirectoryEntry } from '~/types'
import { existsSync, readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { FinalImageEstimateRequest, FinalImageInventory, FinalImageOutputInventory, FinalImagePageInventory, FinalImagePanelInventory, ImageGenerationModel, PanelDirectoryInventory } from '~/types'
import {
  chunkComicGridPanels,
  chunkComicPagePanels,
  selectComicPanels,
} from '../comic-commands/generate-images/comic-page-utils'
import { PAGE_QA_REPORT_SCHEMA_VERSION } from '../comic-commands/generate-images/comic-page-qa'
import {
  applyReferenceImageLimits,
  extractPanelBundleData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  PANEL_DIRECTORY_PATTERN,
  resolveDesignReferencesAcrossPanels,
  resolveLocationReferencesAcrossPanels,
  resolvePrimaryCharacterReferencesAcrossPanels,
} from './panel-prompt-utils'
import { validateReferenceImageCount } from './reference-capabilities'
import { DEFAULT_IMAGE_MODEL } from './image-size'
import { getPanelPromptsDirectory } from './project-paths'
import {
  getPageComicImagePath,
  getPanelComicImagePath,
} from './scene-utils'
import { isRecord } from '~/utils/value-helpers'

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
): Promise<number> => {
  const panels = await Promise.all(panelNumbers.map(number => readPricePanelInput(panelPromptsDir, number)))
  const primary = resolvePrimaryCharacterReferencesAcrossPanels(panels, { composeDerived: false })
  const locations = resolveLocationReferencesAcrossPanels(panels)
  const designs = resolveDesignReferencesAcrossPanels(panels)
  const locationPlaceholders = locations.map((_, index) => `__location-${index + 1}__`)
  const designPlaceholders = designs.map((_, index) => `__design-${index + 1}__`)

  for (const model of models) {
    applyReferenceImageLimits(
      [...primary.primaryCharacterRefs, ...locationPlaceholders, ...designPlaceholders],
      [],
      [...locationPlaceholders, ...designPlaceholders],
      primary.missingPrimaryCharacterRefs,
      model,
    )
  }
  return primary.primaryCharacterRefs.length + locations.length + designs.length
}

const isReusablePageQaReport = (
  reportPath: string,
  outputPath: string,
  judgeModel: string,
): boolean => {
  if (!existsSync(reportPath)) return false

  try {
    const report: unknown = JSON.parse(readFileSync(reportPath, 'utf8'))
    if (!isRecord(report) || report['schemaVersion'] !== PAGE_QA_REPORT_SCHEMA_VERSION) return false
    const pages = report['pages']
    return Array.isArray(pages) && pages.some(entry => (
      isRecord(entry)
      && entry['outputFile'] === basename(outputPath)
      && entry['judgeModel'] === judgeModel
    ))
  } catch {
    return false
  }
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

const buildPageOutputInventory = (
  request: Extract<FinalImageEstimateRequest, { mode: 'page' }>,
  pageNumber: number,
  panelNumbers: readonly number[],
): FinalImageOutputInventory[] => request.models.flatMap(model => (
  request.variations.map(variation => {
    const pathParts = resolveFinalImageOutputPathParts(request, model, variation)
    const outputPath = getPageComicImagePath(
      request.sceneSlug,
      pageNumber,
      [...panelNumbers],
      pathParts.model,
      pathParts.variation,
    )
    const reportPath = join(dirname(outputPath), 'page-qa-report.json')
    return {
      model,
      variation,
      outputPath,
      exists: existsSync(outputPath),
      qaReportReusable: !request.force && request.qa.enabled
        && isReusablePageQaReport(reportPath, outputPath, request.qa.judgeModel),
    }
  })
))

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
      outputs: buildPageOutputInventory(request, chunk.pageNumber, chunk.panelNumbers),
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
    const referenceCount = await validatePriceReferenceGroup(
      panelPromptsDir,
      [panel.panelNumber],
      request.models,
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
      variations: request.variations.map(variation => ({
        variation,
        allModelsExist: request.models.every(model => {
          const pathParts = resolveFinalImageOutputPathParts(request, model, variation)
          return existsSync(getPanelComicImagePath(
            request.sceneSlug,
            panel.panelNumber,
            pathParts.model,
            pathParts.variation,
          ))
        }),
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
