import type { ComicBaseImageRequestInput, ComicBaseImageRequestResult, ImageRunStats } from '~/types'
import { comicLog, formatDuration } from '../../comic-utils/comic-logger'

export const presentPanelImageResult = (result: ComicBaseImageRequestResult, request: ComicBaseImageRequestInput, resultStats: ImageRunStats): void => {
  const { itemNumber: panelNumber, model, outputPath, referenceImages } = request
  const details = [
    `id=panel-${String(panelNumber).padStart(2, '0')}`,
    `panel=${panelNumber}`,
    `model=${model}`,
    `refs=${referenceImages.length}`,
  ]
  if (result.status === 'skipped') {
    resultStats.imagesSkipped++
    comicLog.output('skipped', 'panel', [...details, `path=${outputPath}`])
    return
  }

  comicLog.output('generated', 'panel', [
    ...details,
    result.mode ? `mode=${result.mode}` : undefined,
    result.costLabel ? `cost=${result.costLabel}` : undefined,
    `duration=${formatDuration(result.durationMs)}`,
    result.preservedPriorPath ? `prior=${result.preservedPriorPath}` : undefined,
    `path=${outputPath}`,
  ])
}
