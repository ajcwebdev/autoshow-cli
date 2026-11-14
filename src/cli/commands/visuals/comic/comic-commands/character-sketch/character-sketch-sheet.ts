import { existsSync } from 'node:fs'
import type { CharacterSketchSheetSelection, CharacterSketchSheetSource, CharacterSketchSheetSourceMetadata, CharacterSketchView } from '~/types'
import { exec } from '~/utils/cli-utils'
import { InfraError, InternalError } from '~/utils/error-handler'
import { getImageMagickBinary, hasRuntimeTool } from '~/utils/runtime-paths'
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

const resolveImageMagickCommand = (): string => {
  if (hasRuntimeTool('magick') || hasRuntimeTool('convert')) return getImageMagickBinary()
  throw InfraError(
    'Character sketch sheet composition requires managed ImageMagick. Run bun autoshow setup --step rendering.',
    { stage: 'comic:character-sketch-sheet' }
  )
}

const identifyImageDimensions = async (
  source: CharacterSketchSheetSource
): Promise<CharacterSketchSheetSourceMetadata> => {
  const metadata = await new Bun.Image(await Bun.file(source.path).arrayBuffer()).metadata()
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
