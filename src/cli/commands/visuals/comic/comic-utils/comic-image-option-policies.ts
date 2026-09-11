import type {
  BlockingHardCandidateStatus,
  ParsedGenerateImagesArgs,
  ParsedLlmModel
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  validateComicGridOptions
} from '../comic-commands/generate-images/comic-page-utils'
import { BLOCKING_HARD_CANDIDATE_STATUSES } from '../schemas/blocking-plan-schemas'
import {
  validateImageSizeForModels,
} from './image-size'

import { DEFAULT_QA_MODEL } from './comic-argument-defaults'
import { isPositiveInteger } from './comic-argument-readers'
import type { coerceComicImageScalars } from './comic-image-scalar-options'

type ComicImageOptionState = ReturnType<typeof coerceComicImageScalars>

export const validateComicImageTarget = (state: ComicImageOptionState) => {
  const { output } = state
  const target = output.target ?? 'images'
  const targetRunsFinalImages = target === 'images' || target === 'both'
  if ((output.qa !== undefined || output.qaModel || output.maxRepairs !== undefined) && !targetRunsFinalImages) {
    throw UsageError('QA options only apply when --target is images or both')
  }
  if (output.grid && output.panelsPerImage === undefined) {
    throw UsageError('--grid requires --panels-per-image 1')
  }
}

export const applyComicQaOnlyPolicy = (state: ComicImageOptionState) => {
  const { output, qaOnly, blockingLayoutGuide } = state
  const target = output.target ?? 'images'
  if (qaOnly) {
    if (target !== 'images') throw UsageError('--qa-only requires --target images')
    if (output.qa === false) throw UsageError('--qa-only cannot be combined with --no-qa')
    if (output.maxRepairs !== undefined && output.maxRepairs !== 0) throw UsageError('--qa-only requires --max-repairs 0')
    if (output.panelsPerImage !== undefined && output.panelsPerImage !== 1) throw UsageError('--qa-only requires --panels-per-image 1')
    if (output.grid) throw UsageError('--qa-only cannot be combined with --grid')
    if (output.variations !== undefined) throw UsageError('--qa-only cannot be combined with --variation')
    if (output.force) throw UsageError('--qa-only cannot be combined with --force')
    if (output.imageModels !== undefined || output.size !== undefined || output.quality !== undefined) throw UsageError('--qa-only does not accept image-generation options')
    if (blockingLayoutGuide) throw UsageError('--qa-only cannot be combined with --blocking-layout-guide')
    output.qa = true
    output.maxRepairs = 0
    output.panelsPerImage = 1
  }
}

export const applyComicBlockingHardKeys = (state: ComicImageOptionState) => {
  const { output, blockingHardKeys } = state
  if (blockingHardKeys !== undefined) {
    const keys = blockingHardKeys.split(',').map(key => key.trim()).filter(key => key.length > 0)
    if (keys.length === 0) throw UsageError(`Invalid blocking hard key list "${blockingHardKeys}". Expected a comma list of: ${BLOCKING_HARD_CANDIDATE_STATUSES.join(', ')}`)
    for (const key of keys) {
      if (!(BLOCKING_HARD_CANDIDATE_STATUSES as readonly string[]).includes(key)) {
        throw UsageError(`Invalid blocking hard key "${key}". Expected one of: ${BLOCKING_HARD_CANDIDATE_STATUSES.join(', ')}`)
      }
    }
    output.blockingHardKeys = [...new Set(keys)] as BlockingHardCandidateStatus[]
  }
}

export const applyComicContinuityPolicy = (state: ComicImageOptionState) => {
  const { output, continuityOnly, continuityQa, labels, trustedAnchorPanel, qaOnly } = state
  if (continuityOnly && !continuityQa) throw UsageError('--continuity-only requires --continuity-qa')
  if (continuityQa && !qaOnly) throw UsageError('--continuity-qa requires --qa-only')
  if (labels !== undefined && !continuityQa) throw UsageError('--labels requires --continuity-qa')
  if (trustedAnchorPanel !== undefined && !continuityQa) throw UsageError('--trusted-anchor-panel requires --continuity-qa')
  if (continuityQa) output.continuityQa = true
  if (continuityOnly) output.continuityOnly = true
  if (labels !== undefined) output.labels = labels
  if (trustedAnchorPanel !== undefined) {
    if (!isPositiveInteger(trustedAnchorPanel)) {
      throw UsageError(`Invalid trusted anchor panel "${trustedAnchorPanel}". Expected a positive integer like 1`)
    }
    output.trustedAnchorPanel = Number(trustedAnchorPanel)
  }
}

export const applyComicRevisionPolicy = (state: ComicImageOptionState) => {
  const { output, revisionPlan, qaOnly, blockingLayoutGuide, comparisonPasses, promote } = state
  const target = output.target ?? 'images'
  if (revisionPlan !== undefined) {
    if (qaOnly) throw UsageError('--revision-plan cannot be combined with --qa-only')
    if (target !== 'images') throw UsageError('--revision-plan requires --target images')
    if (output.panelsPerImage !== undefined && output.panelsPerImage !== 1) throw UsageError('--revision-plan requires --panels-per-image 1')
    if (output.grid) throw UsageError('--revision-plan cannot be combined with --grid')
    if (output.variations !== undefined) throw UsageError('--revision-plan cannot be combined with --variation')
    if (output.force) throw UsageError('--revision-plan cannot be combined with --force')
    if (blockingLayoutGuide) throw UsageError('--revision-plan cannot be combined with --blocking-layout-guide')
    if (output.qa === false) throw UsageError('--revision-plan cannot be combined with --no-qa')
    if (output.maxRepairs !== undefined && output.maxRepairs !== 0) throw UsageError('--revision-plan requires --max-repairs 0')
    if (output.imageModels !== undefined && (output.imageModels.length !== 1 || output.imageModels[0] !== 'gpt-image-2')) throw UsageError('--revision-plan supports only --image-model gpt-image-2')
    if (output.qaModel !== undefined && output.qaModel !== 'gemini-3.1-pro-preview') throw UsageError('--revision-plan supports only --qa-model gemini-3.1-pro-preview')
    if (output.comparisonPasses !== 2) throw UsageError('--revision-plan requires --comparison-passes 2')
    if (output.promote !== 'clear-winners') throw UsageError('--revision-plan requires --promote clear-winners')
    output.imageModels = ['gpt-image-2']
    output.qaModel = 'gemini-3.1-pro-preview'
    output.qa = true
    output.maxRepairs = 0
    output.panelsPerImage = 1
  } else if (comparisonPasses !== undefined || promote !== undefined) {
    throw UsageError('--comparison-passes and --promote require --revision-plan')
  }
}

export const finalizeComicImageOptions = (state: ComicImageOptionState) => {
  const { output, qaOnly, revisionPlan, blockingLayoutGuide } = state
  const target = output.target ?? 'images'
  const targetRunsFinalImages = target === 'images' || target === 'both'
  output.qa ??= true
  output.qaModel ??= DEFAULT_QA_MODEL as ParsedLlmModel
  output.maxRepairs ??= qaOnly || revisionPlan !== undefined ? 0 : 2
  if (output.variations !== undefined && !targetRunsFinalImages) {
    throw UsageError('--variation only applies when --target is images or both')
  }
  if (blockingLayoutGuide && !targetRunsFinalImages) throw UsageError('--blocking-layout-guide only applies when --target is images or both')
  if (blockingLayoutGuide && !output.grid && (output.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE) !== 1) throw UsageError('--blocking-layout-guide requires --panels-per-image 1')
  validateImageSizeForModels(output.size, output.imageModels)
  validateComicGridOptions(output.grid, {
    target,
    size: output.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: output.panelsPerImage ?? DEFAULT_FINAL_PANELS_PER_IMAGE,
  })
  return output as ParsedGenerateImagesArgs
}
