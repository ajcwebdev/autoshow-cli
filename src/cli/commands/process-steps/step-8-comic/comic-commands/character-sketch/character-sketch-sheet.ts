import { existsSync } from 'node:fs'
import type { BunImageMetadataReaderConstructor, CharacterSketchSheetSelection, CharacterSketchSheetSource, CharacterSketchSheetSourceMetadata, CharacterSketchView } from '~/types'
import { commandExists, exec } from '~/utils/cli-utils'
import { InfraError, InternalError } from '~/utils/error-handler'
import { CHARACTER_SKETCH_VIEWS, getCharacterSketchImagePathForDirectory, getCharacterSketchSheetImagePathForDirectory } from '../process-scenes/character-utils'

const getMissingSketchViews = (
  sketchesDirectory: string
): CharacterSketchView[] => {
  return CHARACTER_SKETCH_VIEWS.filter(view => {
    return !existsSync(getCharacterSketchImagePathForDirectory(sketchesDirectory, view))
  })
}

export const selectCharacterSketchSheetSources = (
  sketchesDirectory: string
): CharacterSketchSheetSelection => {
  const missingViews = getMissingSketchViews(sketchesDirectory)
  if (missingViews.length === 0) {
    return {
      outputPath: getCharacterSketchSheetImagePathForDirectory(sketchesDirectory),
      sources: CHARACTER_SKETCH_VIEWS.map(view => ({
        view,
        path: getCharacterSketchImagePathForDirectory(sketchesDirectory, view),
      })),
    }
  }

  throw InfraError(
    `Could not find a complete front, three-quarter, and profile sketch trio in ${sketchesDirectory}. ` +
    `Missing ${missingViews.join(', ')}. Legacy sketch layouts are not imported; regenerate the character.`,
    { stage: 'comic:character-sketch-sheet' }
  )
}

const getBunImageConstructor = (): BunImageMetadataReaderConstructor => {
  const imageConstructor = (Bun as unknown as { Image?: BunImageMetadataReaderConstructor }).Image
  if (!imageConstructor) {
    throw InternalError('Bun.Image is required to read character sketch dimensions', { stage: 'comic:character-sketch-sheet' })
  }
  return imageConstructor
}

const resolveImageMagickCommand = (): string => {
  if (commandExists('magick')) {
    return 'magick'
  }
  if (commandExists('convert')) {
    return 'convert'
  }
  throw InfraError(
    'Character sketch sheet composition requires ImageMagick. Install ImageMagick so `magick` or `convert` is available on PATH.',
    { stage: 'comic:character-sketch-sheet' }
  )
}

const identifyImageDimensions = async (
  source: CharacterSketchSheetSource
): Promise<CharacterSketchSheetSourceMetadata> => {
  const Image = getBunImageConstructor()
  const metadata = await new Image(await Bun.file(source.path).arrayBuffer()).metadata()
  const { width, height } = metadata
  if (!width || !height) {
    throw InfraError(`Could not read dimensions for ${source.path}`, { stage: 'comic:character-sketch-sheet' })
  }

  return {
    ...source,
    width,
    height,
  }
}

export const combineCharacterSketchSheet = async (
  selection: CharacterSketchSheetSelection
): Promise<{ width: number; height: number }> => {
  const command = resolveImageMagickCommand()
  const sourceMetadata = await Promise.all(selection.sources.map(async source => {
    return await identifyImageDimensions(source)
  }))

  if (sourceMetadata.length === 0) {
    throw InternalError('Character sketch sheet requires at least one source image', { stage: 'comic:character-sketch-sheet' })
  }

  const sheetWidth = sourceMetadata.reduce((sum, source) => sum + source.width, 0)
  const sheetHeight = Math.max(...sourceMetadata.map(source => source.height))
  let left = 0
  const compositeArgs = sourceMetadata.flatMap(source => {
    const currentLeft = left
    left += source.width

    return [
      source.path,
      '-geometry',
      `+${currentLeft}+${Math.floor((sheetHeight - source.height) / 2)}`,
      '-composite',
    ]
  })

  const result = await exec(command, [
    '-size',
    `${sheetWidth}x${sheetHeight}`,
    'xc:white',
    ...compositeArgs,
    selection.outputPath,
  ])
  if (result.exitCode !== 0) {
    throw InfraError(`ImageMagick failed to compose character sketch sheet: ${result.stderr || result.stdout}`, { stage: 'comic:character-sketch-sheet' })
  }

  return {
    width: sheetWidth,
    height: sheetHeight,
  }
}
