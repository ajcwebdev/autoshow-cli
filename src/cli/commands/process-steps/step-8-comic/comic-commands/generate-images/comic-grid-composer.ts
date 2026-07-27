import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { commandExists, exec } from '~/utils/cli-utils'
import { InfraError, InternalError } from '~/utils/error-handler'
import { COMIC_GRID_PANEL_SIZE, getComicGridCapacity } from './comic-page-utils'
import type { ComicGridCellSize, ComposeComicGridPageInput } from '~/types'

const parseGridPanelSize = (): ComicGridCellSize => {
  const [width, height] = COMIC_GRID_PANEL_SIZE.split('x').map(Number)
  if (!width || !height) {
    throw InternalError(`Invalid comic grid panel size "${COMIC_GRID_PANEL_SIZE}"`, { stage: 'comic:grid-compose' })
  }

  return { width, height }
}

const DEFAULT_GRID_CELL_SIZE = parseGridPanelSize()

const resolveImageMagickCommand = (): string => {
  if (commandExists('magick')) {
    return 'magick'
  }
  if (commandExists('convert')) {
    return 'convert'
  }
  throw InfraError(
    'Comic grid composition requires ImageMagick. Install ImageMagick so `magick` or `convert` is available on PATH.',
    { stage: 'comic:grid-compose' }
  )
}

export const composeComicGridPage = async (
  input: ComposeComicGridPageInput
): Promise<{ width: number; height: number }> => {
  const command = resolveImageMagickCommand()
  const capacity = getComicGridCapacity(input.grid)
  if (input.sources.length === 0) {
    throw InternalError('Comic grid composition requires at least one source image', { stage: 'comic:grid-compose' })
  }
  if (input.sources.length > capacity) {
    throw InternalError(`Comic grid received ${input.sources.length} source images for ${capacity} cells`, { stage: 'comic:grid-compose' })
  }

  const cellSize = input.cellSize ?? DEFAULT_GRID_CELL_SIZE
  const canvasWidth = input.grid.columns * cellSize.width
  const canvasHeight = input.grid.rows * cellSize.height
  const compositeArgs = input.sources.flatMap((source, index) => {
    const column = index % input.grid.columns
    const row = Math.floor(index / input.grid.columns)

    return [
      source,
      '-geometry',
      `+${column * cellSize.width}+${row * cellSize.height}`,
      '-composite',
    ]
  })

  await mkdir(dirname(input.outputPath), { recursive: true })
  const result = await exec(command, [
    '-size',
    `${canvasWidth}x${canvasHeight}`,
    'xc:white',
    ...compositeArgs,
    input.outputPath,
  ])
  if (result.exitCode !== 0) {
    throw InfraError(`ImageMagick failed to compose comic grid page: ${result.stderr || result.stdout}`, { stage: 'comic:grid-compose' })
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
  }
}
