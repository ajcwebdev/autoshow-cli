import type { DirectoryEntry, FinalImageEstimateRequest, FinalImageInventory, FinalImageOutputInventory, FinalImagePageInventory, FinalImagePanelInventory, ImageGenerationModel, PanelDirectoryInventory } from '~/types'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  chunkComicGridPanels,
  chunkComicPagePanels,
  selectComicPanels,
} from '../comic-commands/generate-images/comic-page-utils'
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
import { getPanelPromptsDirectory } from './project-paths'
import {
  getPageComicImagePath,
  getPanelComicImagePath,
} from './scene-utils'

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

/**
 * Counts the references dispatch sends for one group: required character, location and design references plus any
 * optional prior references (such as earlier sketches), trimmed to the model's input limit exactly as dispatch trims them.
 */
export const inspectPriceReferenceGroup = async (
  panelPromptsDir: string,
  panelNumbers: readonly number[],
  model: ImageGenerationModel,
  priorRefs: readonly string[] = [],
): Promise<{ referenceCount: number, characterKeys: string[] }> => {
  const panels = await Promise.all(panelNumbers.map(number => readPricePanelInput(panelPromptsDir, number)))
  const primary = resolvePrimaryCharacterReferencesAcrossPanels(panels, { composeDerived: false })
  const locations = resolveLocationReferencesAcrossPanels(panels)
  const designs = resolveDesignReferencesAcrossPanels(panels)
  const locationPlaceholders = locations.map((_, index) => `__location-${index + 1}__`)
  const designPlaceholders = designs.map((_, index) => `__design-${index + 1}__`)

  const resolved = applyReferenceImageLimits(
    [...primary.primaryCharacterRefs, ...locationPlaceholders, ...designPlaceholders],
    [...priorRefs],
    [...locationPlaceholders, ...designPlaceholders],
    primary.missingPrimaryCharacterRefs,
    model,
  )
  const characterKeys = Array.from(new Set(panels.flatMap(panel => panel.bundleData.panels.flatMap(bundlePanel => bundlePanel.characterKeys))))
  return { referenceCount: resolved.all.length, characterKeys }
}

export const validatePriceReferenceGroup = async (
  panelPromptsDir: string,
  panelNumbers: readonly number[],
  model: ImageGenerationModel,
): Promise<number> => (await inspectPriceReferenceGroup(panelPromptsDir, panelNumbers, model)).referenceCount

/** Run-scoped output at the destination dispatch writes; a fresh run has no run ID yet, so nothing is reusable there. */
const runScopedOutput = (outputPath: string | null): FinalImageOutputInventory => ({
  outputPath,
  exists: outputPath !== null && existsSync(outputPath),
})

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
  const pages = []

  for (const chunk of chunkComicPagePanels(selectedPanels, request.panelsPerImage)) {
    const referenceCount = await validatePriceReferenceGroup(panelPromptsDir, chunk.panelNumbers, request.model)
    const output = runScopedOutput(request.runId
      ? getPageComicImagePath(request.sceneSlug, chunk.pageNumber, [...chunk.panelNumbers], { runId: request.runId })
      : null)
    pages.push({
      pageNumber: chunk.pageNumber,
      panelNumbers: chunk.panelNumbers,
      referenceCount,
      output,
      pending: request.force || !output.exists,
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

const buildGridInventory = (
  request: Extract<FinalImageEstimateRequest, { mode: 'grid' }>,
  panelNumbers: readonly number[],
): FinalImagePanelInventory['gridPages'] => chunkComicGridPanels(
  panelNumbers.map(panelNumber => ({ panelNumber })),
  request.grid,
).map(chunk => ({
  pageNumber: chunk.pageNumber,
  panelNumbers: chunk.panelNumbers,
  output: runScopedOutput(request.runId
    ? getPageComicImagePath(request.sceneSlug, chunk.pageNumber, chunk.panelNumbers, { runId: request.runId })
    : null),
}))

const buildPanelInventory = async (
  request: Extract<FinalImageEstimateRequest, { mode: 'panel' | 'grid' }>,
  panelPromptsDir: string,
  panelDirectories: readonly PanelDirectoryInventory[],
): Promise<FinalImagePanelInventory> => {
  const selectedPanels = selectPanelDirectories(request, panelDirectories)
  const panels = []

  for (const panel of selectedPanels) {
    const referenceCount = await validatePriceReferenceGroup(panelPromptsDir, [panel.panelNumber], request.model)
    const candidate = runScopedOutput(request.runId
      ? getPanelComicImagePath(request.sceneSlug, panel.panelNumber, { runId: request.runId })
      : null)
    const selectionPath = getPanelComicImagePath(request.sceneSlug, panel.panelNumber)
    const selection = { path: selectionPath, exists: existsSync(selectionPath) }
    panels.push({
      ...panel,
      referenceCount,
      candidate,
      selection,
      pending: request.force || !(candidate.exists || selection.exists),
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

export const listPanelDirectories = (entries: readonly DirectoryEntry[]): PanelDirectoryInventory[] => entries
  .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
  .map(entry => ({
    directoryName: entry.name,
    panelNumber: getPanelNumberFromName(entry.name),
  }))
  .filter((panel): panel is PanelDirectoryInventory => panel.panelNumber !== null)
  .sort((left, right) => left.directoryName < right.directoryName ? -1 : left.directoryName > right.directoryName ? 1 : 0)

export const loadFinalImageEstimateInventory = async (
  request: FinalImageEstimateRequest,
): Promise<FinalImageInventory> => {
  const panelPromptsDir = getPanelPromptsDirectory(request.sceneSlug)
  if (!existsSync(panelPromptsDir)) return { status: 'missing-prompts' }

  const panelDirectories = listPanelDirectories(await readdir(panelPromptsDir, { withFileTypes: true }))
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
