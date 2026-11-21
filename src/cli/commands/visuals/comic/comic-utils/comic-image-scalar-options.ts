import { parseHostedConcurrencyMode } from '~/cli/options/option-resolution/flag-readers'
import type {
  ComicParsedArgs,
  ParsedGenerateBaseArgs
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import {
  DEFAULT_SKETCH_PANELS_PER_IMAGE,
  parseComicGridSpec,
  parsePanelSelector
} from '../comic-commands/generate-images/comic-page-utils'

import { assignSharedImageRenderOptions, enabledFlag, isPositiveInteger, parseConcurrencyValue, readScriptPath, readSingleComicImageSelector, stringFlag } from './comic-argument-readers'

const GENERATE_IMAGES_TARGET_VALUES = ['images', 'sketches', 'both'] as const
const GENERATE_IMAGES_TARGET_OPTIONS = new Set<string>(GENERATE_IMAGES_TARGET_VALUES)

export const coerceComicImageScalars = (parsed: ComicParsedArgs): ParsedGenerateBaseArgs => {
  const scriptPath = readScriptPath(parsed)
  const output: ParsedGenerateBaseArgs = { showHelp: false, scriptPath: scriptPath as string }
  const imageModel = readSingleComicImageSelector(parsed, 'generate-images')
  const targetValue = stringFlag(parsed, 'target')
  const concurrency = stringFlag(parsed, 'provider-concurrency')
  const concurrencyMode = stringFlag(parsed, 'concurrency-mode')
  const panels = stringFlag(parsed, 'panels')
  const panelsPerImage = stringFlag(parsed, 'panels-per-image')
  const grid = stringFlag(parsed, 'grid')
  if (imageModel !== undefined) output.imageModel = imageModel
  if (enabledFlag(parsed, 'stop-on-provider-error') === true) output.stopOnProviderError = true
  if (enabledFlag(parsed, 'price') === true) output.price = true
  if (targetValue !== undefined) {
    if (!GENERATE_IMAGES_TARGET_OPTIONS.has(targetValue)) {
      throw UsageError(`Invalid target "${targetValue}". Expected one of: ${GENERATE_IMAGES_TARGET_VALUES.join(', ')}`)
    }
    output.target = targetValue as NonNullable<ParsedGenerateBaseArgs['target']>
  }
  if (concurrency !== undefined) output.concurrency = parseConcurrencyValue(concurrency)
  output.concurrencyMode = parseHostedConcurrencyMode(concurrencyMode)
  if (panels !== undefined) output.panels = parsePanelSelector(panels)
  if (panelsPerImage !== undefined) {
    if (!isPositiveInteger(panelsPerImage)) {
      throw UsageError(`Invalid panels per image "${panelsPerImage}". Expected a positive integer like 1 or ${DEFAULT_SKETCH_PANELS_PER_IMAGE}`)
    }
    output.panelsPerImage = Number(panelsPerImage)
  }
  if (grid !== undefined) output.grid = parseComicGridSpec(grid)
  if (enabledFlag(parsed, 'force') === true) output.force = true
  assignSharedImageRenderOptions(parsed, output)

  return output
}
