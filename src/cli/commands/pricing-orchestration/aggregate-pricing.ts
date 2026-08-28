import type { AggregateExplicitEstimateOptions, AggregatedPriceEstimate, AggregateTimingOptions, CommandPricingOptions, ProcessingOptions, ProcessCommand, StepEstimate, WriteRuntimeOptions } from '~/types'
import { SUPADATA_STT_AGGREGATE_NOTE } from '~/cli/commands/pricing-orchestration/supadata-pricing'
import { SCRAPECREATORS_STT_AGGREGATE_NOTE } from '~/utils/pricing/scrapecreators-pricing'
import { buildPriceEstimateContribution } from './aggregate-pricing/route-estimates'
import { buildAggregateTiming } from './aggregate-pricing/timing'

const buildTimingOptions = (
  opts: AggregateTimingOptions,
  context: { ttsInputText?: string | undefined } = {}
) => ({
  concurrencyMode: opts.concurrencyMode,
  ...(typeof context.ttsInputText === 'string' ? { ttsInputText: context.ttsInputText } : {}),
  ...(typeof opts.ttsChunkConcurrency === 'number' ? { ttsChunkConcurrency: opts.ttsChunkConcurrency } : {}),
  ...(typeof opts.ocrConcurrency === 'number' ? { ocrConcurrency: opts.ocrConcurrency } : {}),
  ocrConcurrencyMode: opts.ocrConcurrencyMode,
  ...(typeof opts.ocrProviderConcurrency === 'number' ? { ocrProviderConcurrency: opts.ocrProviderConcurrency } : {}),
  ...(typeof opts.ocrLocalConcurrency === 'number' ? { ocrLocalConcurrency: opts.ocrLocalConcurrency } : {})
})

const appendProviderNotes = (steps: readonly StepEstimate[], notes: string[]): void => {
  if (steps.some((step) => step.step === 'stt' && step.provider === 'supadata')) notes.push(SUPADATA_STT_AGGREGATE_NOTE)
  if (steps.some((step) => step.step === 'stt' && step.provider === 'scrapecreators')) notes.push(SCRAPECREATORS_STT_AGGREGATE_NOTE)
}

export const aggregateExplicitPriceEstimate = (
  steps: StepEstimate[],
  opts: AggregateTimingOptions,
  options: AggregateExplicitEstimateOptions = {}
): AggregatedPriceEstimate => {
  const notes = [...(options.notes ?? [])]
  appendProviderNotes(steps, notes)
  const timing = buildAggregateTiming(steps, options.ttsTimingCharacterCount, buildTimingOptions(opts, {
    ...(typeof options.ttsInputText === 'string' ? { ttsInputText: options.ttsInputText } : {})
  }))
  const uniqueNotes = [...new Set(notes)]
  return {
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0),
    ...(timing && timing.steps.length > 0 ? { timing } : {}),
    ...(uniqueNotes.length > 0 ? { notes: uniqueNotes } : {})
  }
}

export function buildAggregatedPriceEstimate (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: CommandPricingOptions | WriteRuntimeOptions | ProcessingOptions,
  characterCount?: number,
  context?: { ttsInputText?: string | undefined }
): Promise<AggregatedPriceEstimate>
export async function buildAggregatedPriceEstimate (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: CommandPricingOptions | WriteRuntimeOptions | ProcessingOptions,
  characterCount?: number,
  context: { ttsInputText?: string | undefined } = {}
): Promise<AggregatedPriceEstimate> {
  const contribution = await buildPriceEstimateContribution(command, resolvedTarget, opts, characterCount, context)
  appendProviderNotes(contribution.steps, contribution.notes)
  const timing = buildAggregateTiming(
    contribution.steps,
    contribution.ttsTimingCharacterCount,
    buildTimingOptions(opts, {
      ...(typeof contribution.ttsTimingInputText === 'string' ? { ttsInputText: contribution.ttsTimingInputText } : {})
    })
  )
  return {
    steps: contribution.steps,
    totalEstimatedCost: contribution.steps.reduce((sum, step) => sum + step.totalCost, 0),
    ...(timing && timing.steps.length > 0 ? { timing } : {}),
    ...(contribution.notes.length > 0 ? { notes: contribution.notes } : {})
  }
}
