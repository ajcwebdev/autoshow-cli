import type { SttEstimateOptions, SttStepEstimate, SttTarget } from '~/types'
import { resolveSttInputDurationSeconds } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-duration'
import { collectSttTargetsForSource, sttSourceFromInput } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import {
  buildHappyScribeRegistryEstimate,
  resolveHappyScribePriceNotes
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/happyscribe-pricing'
import { resolveYoutubeCaptionEstimateTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import { getSttCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeBilledSttCost } from '~/cli/commands/pricing-orchestration/stt-billing'
import { estimateSupadataCost } from '~/cli/commands/pricing-orchestration/supadata-pricing'
import { estimateScrapeCreatorsCost } from '~/utils/pricing/scrapecreators-pricing'

const EXACT_COST_MULTIPLIER = 1

const buildCloudSttEstimate = async (
  provider: string,
  model: string,
  durationSeconds: number
): Promise<SttStepEstimate> => {
  const totalCost = computeBilledSttCost(provider, model, durationSeconds).cost
  return { step: 'stt', provider, model, durationSeconds, totalCost, costMultiplier: EXACT_COST_MULTIPLIER }
}

const buildSupadataSttEstimate = (
  model: string,
  durationSeconds: number,
  sourceUrl: string
): SttStepEstimate => {
  const cost = estimateSupadataCost(model, durationSeconds, { sourceUrl })
  return {
    step: 'stt',
    provider: 'supadata',
    model,
    durationSeconds,
    totalCost: cost.totalCost,
    costMultiplier: EXACT_COST_MULTIPLIER,
    note: cost.note
  }
}

const buildScrapeCreatorsSttEstimate = (
  model: string
): SttStepEstimate => {
  const cost = estimateScrapeCreatorsCost()
  return {
    step: 'stt',
    provider: 'scrapecreators',
    model,
    durationSeconds: 0,
    totalCost: cost.totalCost,
    costMultiplier: EXACT_COST_MULTIPLIER,
    note: cost.note
  }
}

const buildHappyScribeSttEstimate = async (
  model: string,
  durationSeconds: number,
  preferredOrganizationId: string | undefined
): Promise<SttStepEstimate> => {
  const totalCost = buildHappyScribeRegistryEstimate(model, durationSeconds)
  const notes = await resolveHappyScribePriceNotes({ preferredOrganizationId })

  return {
    step: 'stt',
    provider: 'happyscribe',
    model,
    durationSeconds,
    totalCost,
    costMultiplier: EXACT_COST_MULTIPLIER,
    ...(notes.length > 0 ? { note: notes.join(' ') } : {})
  }
}

export const buildSttEstimates = async (
  resolvedTarget: string,
  opts: SttEstimateOptions
): Promise<SttStepEstimate[]> => {
  const captionTargets = opts.youtubeCaptions && /^https?:\/\//i.test(resolvedTarget)
    ? await resolveYoutubeCaptionEstimateTargets(resolvedTarget)
    : null
  const targets = captionTargets
    ? captionTargets.map((target) => ({ ...target, local: false }))
    : collectSttTargetsForSource(opts, sttSourceFromInput(resolvedTarget))
  return await buildSttEstimatesForTargets(resolvedTarget, opts, targets)
}

export const buildSttEstimatesForTargets = async (
  resolvedTarget: string,
  opts: Pick<SttEstimateOptions, 'happyscribeOrganizationId'>,
  targets: SttTarget[]
): Promise<SttStepEstimate[]> => {
  if (targets.length === 0) {
    return []
  }

  const needsDuration = targets.some((target) =>
    target.service !== 'whisper'
    && target.service !== 'youtube-captions'
    && target.service !== 'scrapecreators'
  )
  const durationSeconds = needsDuration ? await resolveSttInputDurationSeconds(resolvedTarget, targets) : 0
  const estimates: SttStepEstimate[] = []

  for (const target of targets) {
    if (target.service === 'youtube-captions') {
      estimates.push({ step: 'stt', provider: 'youtube-captions', model: target.model, durationSeconds: 0, totalCost: 0, costMultiplier: 1 })
      continue
    }

    if (target.service === 'whisper') {
      const sttCost = getSttCost('whisper', target.model)
      estimates.push({
        step: 'stt',
        provider: 'whisper',
        model: target.model,
        durationSeconds: 0,
        totalCost: sttCost.costPerHourCents ?? 0,
        costMultiplier: EXACT_COST_MULTIPLIER,
      })
      continue
    }

    if (target.service === 'supadata') {
      estimates.push(buildSupadataSttEstimate(target.model, durationSeconds, resolvedTarget))
      continue
    }

    if (target.service === 'scrapecreators') {
      estimates.push(buildScrapeCreatorsSttEstimate(target.model))
      continue
    }

    if (target.service === 'happyscribe') {
      estimates.push(await buildHappyScribeSttEstimate(target.model, durationSeconds, opts.happyscribeOrganizationId))
      continue
    }

    estimates.push(await buildCloudSttEstimate(target.service, target.model, durationSeconds))
  }

  return estimates
}
