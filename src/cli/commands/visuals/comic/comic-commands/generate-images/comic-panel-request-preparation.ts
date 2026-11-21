import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ComicBaseImageRequestInput, DirectoryEntry, PanelRenderContext } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import {
  extractPanelBundleData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  normalizePromptBundle,
  resolvePrimaryCharacterReferences,
  resolveReferenceImages
} from '../../comic-utils/panel-prompt-utils'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { createImageRunStats } from '../../comic-image-services/image-costs'
import { buildComicPagePrompt } from './comic-page-utils'

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
      `Re-run "${CLI_INVOCATION} comic draft-scenes <script-path> --only panel-prompts" ` +
      `after generating any missing character sketches.`,
      { stage: 'comic:generate-images' }
    )
  }
  return { panelNumber, panelDirectory, panelEntries, bundleData }
}

export const preparePanelImageRequest = (
  prepared: Awaited<ReturnType<typeof preparePanelPrompt>>,
  ctx: PanelRenderContext,
  stats = createImageRunStats()
): ComicBaseImageRequestInput => {
  const { panelNumber, panelDirectory, panelEntries, bundleData } = prepared
  const { sceneSlug, options, requestImage, writeImage, nextHostedIndex } = ctx
  const outputPath = getPanelComicImagePath(sceneSlug, panelNumber, { runId: options.runId })
  const resolvedReferences = resolveReferenceImages(panelDirectory, panelEntries, bundleData, options.model)
  const prompt = buildComicPagePrompt(bundleData, resolvedReferences.characterReferences ?? [], resolvedReferences.locationReferences ?? [], resolvedReferences.designReferences ?? [])

  return {
    kind: 'panel',
    itemNumber: panelNumber,
    outputPath,
    model: options.model,
    prompt,
    referenceImages: resolvedReferences.all,
    sceneSlug,
    options,
    requestImage,
    writeImage,
    nextHostedIndex,
    stats,
  }
}
