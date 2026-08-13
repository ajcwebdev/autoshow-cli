import type { ComputeEstimatedCostsInput, EstimatedCostBreakdown } from '~/types'
import { buildSttCostSteps } from './compute-estimated-costs/stt-cost-steps'
import { buildExtractCostSteps } from './compute-estimated-costs/extract-cost-steps'
import { buildLlmCostSteps } from './compute-estimated-costs/llm-cost-steps'
import { buildTtsCostSteps } from './compute-estimated-costs/tts-cost-steps'
import { buildImageCostSteps } from './compute-estimated-costs/image-cost-steps'
import { buildVideoCostSteps } from './compute-estimated-costs/video-cost-steps'
import { buildMusicCostSteps } from './compute-estimated-costs/music-cost-steps'

export const computeEstimatedCosts = (input: ComputeEstimatedCostsInput): EstimatedCostBreakdown => {
  const results = [
    buildSttCostSteps(input),
    buildExtractCostSteps(input),
    buildLlmCostSteps(input),
    buildTtsCostSteps(input),
    buildImageCostSteps(input),
    buildVideoCostSteps(input),
    buildMusicCostSteps(input)
  ]

  return {
    totalCost: results.reduce((total, result) => total + result.cost, 0),
    steps: results.flatMap((result) => result.steps)
  }
}
