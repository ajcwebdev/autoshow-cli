import { join } from 'node:path'
import type { ImageGenerationModel, ImagePromptVariation, PromptsConfig, ScenePrompts } from '~/types'
import { PromptsConfigSchema } from '../schemas/schemas'
import { parseJsonFile } from './json-prompt-utils'
import { err } from './comic-logger'
import { InternalError, ValidationError } from '~/utils/error-handler'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { getPagesDirectory, getPanelsDirectory, getSketchesDirectory } from './project-paths'

export const PANEL_FILENAME_PADDING = 2

export const loadPromptsConfig = async (): Promise<PromptsConfig> => {
  try {
    return await parseJsonFile(join(PROJECT_ROOT, 'src', 'cli', 'commands', 'process-steps', 'step-8-comic', 'config', 'prompts.json'), PromptsConfigSchema)
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

const getFinalImageOutputDirectory = (
  rootDirectory: string,
  model?: ImageGenerationModel,
  variation?: ImagePromptVariation,
  runId?: string
): string => {
  const baseDirectory = runId ? join(rootDirectory, runId) : rootDirectory

  if (!variation) {
    return model ? join(baseDirectory, model) : baseDirectory
  }

  if (!model) {
    throw InternalError(`Model is required for variation output path "${variation}"`, { stage: 'comic:scene-utils' })
  }

  return join(baseDirectory, variation, model)
}

export const getPanelComicImagePath = (
  sceneSlug: string,
  panelNumber: number,
  model?: ImageGenerationModel,
  variation?: ImagePromptVariation,
  runId?: string
): string => {
  const dir = getPanelsDirectory(sceneSlug)
  const filename = getPanelComicImageFilename(panelNumber)
  return join(getFinalImageOutputDirectory(dir, model, variation, runId), filename)
}

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
  model?: ImageGenerationModel,
  variation?: ImagePromptVariation,
  runId?: string
): string => {
  const dir = getPagesDirectory(sceneSlug)
  const filename = getPageComicImageFilename(pageNumber, panelNumbers)
  return join(getFinalImageOutputDirectory(dir, model, variation, runId), filename)
}
