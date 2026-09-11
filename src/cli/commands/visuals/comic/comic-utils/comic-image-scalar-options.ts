import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { parseHostedConcurrencyMode } from '~/cli/options/option-resolution/flag-readers'
import type {
  ComicParsedArgs,
  ParsedGenerateBaseArgs,
  ParsedLlmModel
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import {
  DEFAULT_SKETCH_PANELS_PER_IMAGE,
  parseComicGridSpec,
  parsePanelSelector
} from '../comic-commands/generate-images/comic-page-utils'
import {
  parseImagePromptVariations,
} from '../comic-commands/generate-images/prompt-variations'

import { assignSharedImageOptions, enabledFlag, isPositiveInteger, parseConcurrencyValue, parseMaxRepairs, readScriptPath, stringFlag } from './comic-argument-readers'

const GENERATE_IMAGES_TARGET_VALUES = ['images', 'sketches', 'both'] as const
const GENERATE_IMAGES_TARGET_OPTIONS = new Set<string>(GENERATE_IMAGES_TARGET_VALUES)

export const coerceComicImageScalars = (parsed: ComicParsedArgs) => {
  const scriptPath = readScriptPath(parsed)
  const output: ParsedGenerateBaseArgs = { showHelp: false, scriptPath: scriptPath as string }
  const qaModel = stringFlag(parsed, 'qa-model')
  const maxRepairs = stringFlag(parsed, 'max-repairs')
  const targetValue = stringFlag(parsed, 'target')
  const concurrency = stringFlag(parsed, 'concurrency')
  const concurrencyMode = stringFlag(parsed, 'concurrency-mode')
  const panels = stringFlag(parsed, 'panels')
  const panelsPerImage = stringFlag(parsed, 'panels-per-image')
  const grid = stringFlag(parsed, 'grid')
  const variation = stringFlag(parsed, 'variation')
  const qaOnly = enabledFlag(parsed, 'qa-only') === true
  const blockingHardKeys = stringFlag(parsed, 'blocking-hard-keys')
  const blockingLayoutGuide = enabledFlag(parsed, 'blocking-layout-guide') === true
  if (blockingLayoutGuide) output.blockingLayoutGuide = true
  if (enabledFlag(parsed, 'bloopers') === true) output.bloopers = true
  if (enabledFlag(parsed, 'stop-on-provider-error') === true) output.stopOnProviderError = true
  if (enabledFlag(parsed, 'credit-preflight') === true) output.creditPreflight = true
  const continuityQa = enabledFlag(parsed, 'continuity-qa') === true
  const continuityOnly = enabledFlag(parsed, 'continuity-only') === true
  const labels = stringFlag(parsed, 'labels')
  const trustedAnchorPanel = stringFlag(parsed, 'trusted-anchor-panel')
  const revisionPlan = stringFlag(parsed, 'revision-plan')
  const comparisonPasses = stringFlag(parsed, 'comparison-passes')
  const promote = stringFlag(parsed, 'promote')
  if (enabledFlag(parsed, 'price') === true) output.price = true
  const qa = enabledFlag(parsed, 'qa')
  if (qa !== undefined) output.qa = qa
  if (qaOnly) output.qaOnly = true
  if (revisionPlan !== undefined) output.revisionPlan = revisionPlan
  if (comparisonPasses !== undefined) output.comparisonPasses = parseMaxRepairs(comparisonPasses)
  if (promote !== undefined) {
    if (promote !== 'clear-winners') throw UsageError(`Invalid revision promotion policy "${promote}". Expected clear-winners`)
    output.promote = promote
  }
  if (qaModel !== undefined) {
    const qaService = findRegistryServiceForModel('llm', qaModel)
    if (qaService !== 'openai' && qaService !== 'gemini') {
      throw UsageError(`Invalid QA model "${qaModel}". QA currently supports OpenAI and Gemini vision-capable LLMs.`)
    }
    output.qaModel = qaModel as ParsedLlmModel
  }
  if (maxRepairs !== undefined) output.maxRepairs = parseMaxRepairs(maxRepairs)
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
  if (variation !== undefined) output.variations = parseImagePromptVariations(variation)
  if (enabledFlag(parsed, 'force') === true) output.force = true
  assignSharedImageOptions(parsed, output)

  return { output, qaOnly, blockingHardKeys, blockingLayoutGuide, continuityQa, continuityOnly, labels, trustedAnchorPanel, revisionPlan, comparisonPasses, promote }
}
