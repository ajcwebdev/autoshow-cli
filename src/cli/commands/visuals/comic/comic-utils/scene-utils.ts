import { join } from 'node:path'
import type { ComicFinalImageLocation, ImageGenerationModel, LegacyComicFinalImageLocation, PromptsConfig, ScenePrompts } from '~/types'
import { PromptsConfigSchema } from '../schemas/schemas'
import { parseJsonFile } from './json-prompt-utils'
import { err } from './comic-logger'
import { InternalError, ValidationError } from '~/utils/error-handler'
import { IMMUTABLE_ASSET_ROOT } from '~/utils/runtime-paths'
import { getPagesDirectory, getPanelsDirectory, getSketchesDirectory } from './project-paths'

export const PANEL_FILENAME_PADDING = 2

export const loadPromptsConfig = async (): Promise<PromptsConfig> => {
  try {
    const promptsPath = Bun.isStandaloneExecutable
      ? join(IMMUTABLE_ASSET_ROOT, 'prompts.json')
      : join(IMMUTABLE_ASSET_ROOT, 'src', 'cli', 'commands', 'visuals', 'comic', 'comic-prompts', 'prompts.json')
    return await parseJsonFile(promptsPath, PromptsConfigSchema)
  } catch (error) {
    err('Failed to load prompts:', error instanceof Error ? error.message : String(error))
    throw InternalError('Failed to load prompts configuration', { stage: 'comic:scene-utils', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

export const getPanelPromptTemplate = (scenePrompts: ScenePrompts, panelNumber: number): string => {
  if (panelNumber === 1) {
    return scenePrompts['1st Panel']
  }

  const followUpPrompt = panelNumber === 2
    ? scenePrompts['2nd Panel'] ?? scenePrompts['3rd Panel']
    : scenePrompts['3rd Panel'] ?? scenePrompts['2nd Panel']

  if (!followUpPrompt) {
    throw InternalError(`Missing follow-up panel prompt template for panel ${panelNumber}`, { stage: 'comic:scene-utils' })
  }

  return followUpPrompt
    .replaceAll('first few panels of the scene', 'previous panels of the scene')
    .replaceAll('first panel of the scene', 'previous panels of the scene')
    .replace(/\bPanel 3\b/g, `Panel ${panelNumber}`)
    .replace(/\bPanel 2\b/g, `Panel ${panelNumber}`)
}

export const validatePanelNumberSequence = (sceneTitle: string, panels: Array<{ number: number }>): void => {
  panels.forEach((panel, index) => {
    const expectedNumber = index + 1
    if (panel.number !== expectedNumber) {
      throw ValidationError(`Scene "${sceneTitle}" has panel number ${panel.number} at index ${index}; expected ${expectedNumber}`, { stage: 'comic:scene-utils' })
    }
  })
}

const getPanelComicImageFilename = (
  panelNumber: number,
): string => {
  return `panel-${String(panelNumber).padStart(PANEL_FILENAME_PADDING, '0')}.png`
}

const getSketchComicImageFilename = (
  startPanelNumber: number,
  endPanelNumber: number,
): string => {
  const panelRange = [
    String(startPanelNumber).padStart(PANEL_FILENAME_PADDING, '0'),
    String(endPanelNumber).padStart(PANEL_FILENAME_PADDING, '0'),
  ].join('-')
  return `panels-${panelRange}.png`
}

const getPagePanelRangeLabel = (panelNumbers: number[]): string => {
  const paddedPanels = panelNumbers.map(panelNumber => {
    return String(panelNumber).padStart(PANEL_FILENAME_PADDING, '0')
  })

  if (paddedPanels.length === 1) {
    return paddedPanels[0] ?? ''
  }

  const isContiguous = panelNumbers.every((panelNumber, index) => {
    const previousPanelNumber = panelNumbers[index - 1]
    return index === 0 || (
      previousPanelNumber !== undefined
      && panelNumber === previousPanelNumber + 1
    )
  })
  const firstPanelLabel = paddedPanels[0] ?? ''
  const lastPanelLabel = paddedPanels.at(-1) ?? ''

  return isContiguous
    ? `${firstPanelLabel}-${lastPanelLabel}`
    : paddedPanels.join('_')
}

export const getPageComicImageFilename = (
  pageNumber: number,
  panelNumbers: number[],
): string => {
  if (pageNumber < 1) {
    throw InternalError(`Page number must be at least 1, received ${pageNumber}`, { stage: 'comic:scene-utils' })
  }

  if (panelNumbers.length === 0) {
    throw InternalError('Page image filenames require at least one panel number', { stage: 'comic:scene-utils' })
  }

  const pageFilename = [
    `page-${String(pageNumber).padStart(PANEL_FILENAME_PADDING, '0')}`,
    `panels-${getPagePanelRangeLabel(panelNumbers)}`,
  ].join('-')

  return `${pageFilename}.png`
}

const getRunScopedDirectory = (rootDirectory: string, runId?: string): string =>
  runId ? join(rootDirectory, runId) : rootDirectory

const getLegacyFinalImageOutputDirectory = (rootDirectory: string, location: LegacyComicFinalImageLocation): string => {
  const baseDirectory = getRunScopedDirectory(rootDirectory, location.runId)
  return location.variation
    ? join(baseDirectory, location.variation, location.model)
    : join(baseDirectory, location.model)
}

export const getPanelComicImagePath = (
  sceneSlug: string,
  panelNumber: number,
  location: ComicFinalImageLocation = {}
): string => join(getRunScopedDirectory(getPanelsDirectory(sceneSlug), location.runId), getPanelComicImageFilename(panelNumber))

/** Historical multi-model or explicit-variation candidate location. Never used as a destination for new runs. */
export const getLegacyPanelComicImagePath = (
  sceneSlug: string,
  panelNumber: number,
  location: LegacyComicFinalImageLocation
): string => join(getLegacyFinalImageOutputDirectory(getPanelsDirectory(sceneSlug), location), getPanelComicImageFilename(panelNumber))

export const getSketchComicImagePath = (
  sceneSlug: string,
  startPanelNumber: number,
  endPanelNumber: number,
  model?: ImageGenerationModel,
  runId?: string
): string => {
  const dir = getSketchesDirectory(sceneSlug)
  const filename = getSketchComicImageFilename(startPanelNumber, endPanelNumber)
  const baseDirectory = runId ? join(dir, runId) : dir
  return model ? join(baseDirectory, model, filename) : join(baseDirectory, filename)
}

export const getPageComicImagePath = (
  sceneSlug: string,
  pageNumber: number,
  panelNumbers: number[],
  location: ComicFinalImageLocation = {}
): string => join(getRunScopedDirectory(getPagesDirectory(sceneSlug), location.runId), getPageComicImageFilename(pageNumber, panelNumbers))

/** Historical multi-model or explicit-variation page location. Never used as a destination for new runs. */
export const getLegacyPageComicImagePath = (
  sceneSlug: string,
  pageNumber: number,
  panelNumbers: number[],
  location: LegacyComicFinalImageLocation
): string => join(getLegacyFinalImageOutputDirectory(getPagesDirectory(sceneSlug), location), getPageComicImageFilename(pageNumber, panelNumbers))
