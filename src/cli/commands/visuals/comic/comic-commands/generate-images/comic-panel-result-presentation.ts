import { dirname, join } from 'node:path'
import type {
  GeneratePanelImagesOptions,
  GenerateWithQaRepairInput,
  GenerateWithQaRepairResult,
  ImagePromptVariation,
  ImageRunStats,
  PanelRenderContext,
  PanelRenderResult
} from '~/types'
import {
  recordImageRepairAccounting
} from '../../comic-image-services/image-costs'
import { captureBloopers } from '../../comic-utils/blooper-ledger'
import { comicLog } from '../../comic-utils/comic-logger'
import {
  getImagePromptVariationLabel
} from './prompt-variations'

export const resolveEpisodeLabel = (sceneSlug: string): string => /^(\d+)-/u.exec(sceneSlug)?.[1] ?? sceneSlug

export const recordPanelRepairResult = (
  resultStats: ImageRunStats,
  qaEntries: PanelRenderResult['qaEntries'],
  options: GeneratePanelImagesOptions,
  repairResult: GenerateWithQaRepairResult,
  outputDirectory: string
): void => {
  recordImageRepairAccounting(resultStats, qaEntries, options, repairResult, outputDirectory)
}


export const presentPanelRepairResult = async (repairResult: GenerateWithQaRepairResult, request: GenerateWithQaRepairInput, ctx: PanelRenderContext, variation: ImagePromptVariation, resultStats: ImageRunStats): Promise<void> => {
  const { sceneSlug, options, useVariationOutputPaths } = ctx
  const { itemNumber: panelNumber, model, outputPath, referenceImages } = request
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
    return
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
