import type { SttEstimateOptions, SttStepEstimate, SttTarget } from '~/types'
import { resolveSttInputDurationSeconds } from '~/cli/commands/stt/stt-utils/stt-duration'
import { collectSttTargetsForSource, sttSourceFromInput } from '~/cli/commands/stt/stt-targets'
import { resolveYoutubeCaptionEstimateTargets } from '~/cli/commands/text/url/url-services/youtube-captions/youtube-captions'
import { UsageError } from '~/utils/error-handler'
import { getStep2ActiveModelsForService } from '~/cli/commands/command-shared/extract-routing/provider-registry'
import { getSttCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeBilledSttCost } from '~/cli/commands/pricing-orchestration/stt-billing'
import { estimateScrapeCreatorsCost } from '~/utils/pricing/scrapecreators-pricing'

const EXACT_COST_MULTIPLIER = 1

const buildCloudSttEstimate = async (
  provider: string,
  model: string,
  durationSeconds: number,
  diarizationOptions?: SttTarget['diarizationOptions']
): Promise<SttStepEstimate> => {
  const totalCost = computeBilledSttCost(provider, model, durationSeconds, diarizationOptions).cost
  return { step: 'stt', provider, model, durationSeconds, totalCost, costMultiplier: EXACT_COST_MULTIPLIER }
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
  _opts: object,
  targets: SttTarget[]
): Promise<SttStepEstimate[]> => {
  if (targets.length === 0) {
    return []
  }

  for (const target of targets) {
    if (target.service !== 'youtube-captions' && !getStep2ActiveModelsForService('stt', target.service)?.includes(target.model)) {
      throw UsageError(`STT target ${target.service}/${target.model} is excluded or no longer active and cannot be priced for dispatch. Select an active STT provider explicitly.`)
    }
  }
  const needsDuration = targets.some((target) =>
    target.service !== 'whisperfile'
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

    if (target.service === 'whisperfile') {
      const sttCost = getSttCost('whisperfile', target.model)
      estimates.push({
        step: 'stt',
        provider: 'whisperfile',
        model: target.model,
        durationSeconds: 0,
        totalCost: sttCost.costPerHourCents ?? 0,
        costMultiplier: EXACT_COST_MULTIPLIER,
      })
      continue
    }

    if (target.service === 'scrapecreators') {
      estimates.push(buildScrapeCreatorsSttEstimate(target.model))
      continue
    }

    estimates.push(await buildCloudSttEstimate(target.service, target.model, durationSeconds, target.diarizationOptions))
  }

  return estimates
}
