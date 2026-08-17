import type { AggregateExplicitEstimateOptions, AggregatedPriceEstimate, AggregateTimingOptions, CommandPricingOptions, ProcessingOptions, ProcessCommand, StepEstimate, WriteRuntimeOptions } from '~/types'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { resolveSttStep2Execution } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/resolved-step2'
import { SUPADATA_STT_AGGREGATE_NOTE } from '~/cli/commands/pricing-orchestration/supadata-pricing'
import { SCRAPECREATORS_STT_AGGREGATE_NOTE } from '~/utils/pricing/scrapecreators-pricing'
import { buildArticleEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-article-estimates'
import { buildExtractEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates'
import { buildImageEstimates, buildMusicEstimates, buildVideoEstimates } from './aggregate-pricing/generation-estimates'
import { buildLlmEstimates } from './aggregate-pricing/llm-estimates'
import { buildSttEstimates } from './aggregate-pricing/stt-estimates'
import { buildAggregateTiming } from './aggregate-pricing/timing'
import { buildTtsEstimates } from './aggregate-pricing/tts-estimates'

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

export const aggregateExplicitPriceEstimate = (
  steps: StepEstimate[],
  opts: AggregateTimingOptions,
  options: AggregateExplicitEstimateOptions = {}
): AggregatedPriceEstimate => {
  const notes = [...(options.notes ?? [])]
  if (steps.some((step) => step.step === 'stt' && step.provider === 'supadata')) {
    notes.push(SUPADATA_STT_AGGREGATE_NOTE)
  }

  if (steps.some((step) => step.step === 'stt' && step.provider === 'scrapecreators')) {
    notes.push(SCRAPECREATORS_STT_AGGREGATE_NOTE)
  }

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

const isProcessingOptions = (
  opts: CommandPricingOptions | WriteRuntimeOptions | ProcessingOptions
): opts is ProcessingOptions =>
  'outputDir' in opts && ('url' in opts || 'filePath' in opts)

export function buildAggregatedPriceEstimate (
  command: 'write',
  resolvedTarget: string,
  opts: CommandPricingOptions | WriteRuntimeOptions | ProcessingOptions
): Promise<AggregatedPriceEstimate>
export function buildAggregatedPriceEstimate (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: CommandPricingOptions,
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
  const steps: StepEstimate[] = []
  let totalEstimatedCost = 0
  let ttsTimingCharacterCount: number | undefined
  let ttsTimingInputText: string | undefined
  const notes: string[] = []

  const addStep = (step: StepEstimate): void => {
    steps.push(step)
    totalEstimatedCost += step.totalCost
  }

  const routing = isProcessingOptions(opts)
    ? {
        family: 'media' as const,
        resolvedStep2: resolveSttStep2Execution(opts),
        extractRoute: 'media' as const
      }
    : await resolveInputRoutingForCommand(command === 'download' || command === 'metadata' ? 'write' : command, resolvedTarget, opts)
  const documentTarget = routing.family === 'document' || routing.family === 'html_article'
  const resolvedStep2 = routing.resolvedStep2
  const extractRoute = routing.extractRoute
  const textInputWrite = command === 'write' && !isProcessingOptions(opts) && opts.textInput
  const documentWrite = command === 'write' && documentTarget && !textInputWrite
  const mediaWrite = command === 'write' && routing.family === 'media' && !textInputWrite
  const isRemoteTarget = /^https?:\/\//i.test(resolvedTarget)

  if (!textInputWrite && ((isExtractCommand(command) && extractRoute === 'media') || mediaWrite)) {
    for (const stt of await buildSttEstimates(resolvedTarget, opts)) {
      addStep(stt)
      if (typeof stt.note === 'string' && stt.note.length > 0) {
        notes.push(stt.note)
      }
    }
  }

  if (!textInputWrite && ((isExtractCommand(command) && extractRoute === 'document') || documentWrite) && resolvedStep2.route === 'ocr' && !isProcessingOptions(opts)) {
    for (const extract of await buildExtractEstimates(resolvedTarget, resolvedStep2, {
      hostedOcrTokenProfilePath: 'hostedOcrTokenProfilePath' in opts ? opts.hostedOcrTokenProfilePath : undefined,
      reasoningEffort: opts.reasoningEffort,
      ocrProviderMode: opts.ocrProviderMode
    })) {
      addStep(extract)
    }
  }

  if (resolvedStep2.route === 'article' && !isProcessingOptions(opts)) {
    const article = buildArticleEstimates(resolvedStep2, opts, isRemoteTarget)
    for (const estimate of article.estimates) {
      addStep(estimate)
    }
    notes.push(...article.notes)
  }

  if (command === 'write') {
    const llmEstimates = await buildLlmEstimates(opts, false)
    for (const llm of llmEstimates) {
      addStep(llm)
    }
  }

  if (command === 'tts' || command === 'image' || command === 'video' || command === 'music') {
    // The generation-command overload guarantees CommandPricingOptions; only the 'write' overload admits the narrower option shapes.
    const generationOpts = opts as CommandPricingOptions

    if (command === 'tts') {
      ttsTimingCharacterCount = typeof characterCount === 'number' ? characterCount : 0
      ttsTimingInputText = context.ttsInputText
      const ttsEstimates = await buildTtsEstimates(generationOpts, ttsTimingCharacterCount)
      for (const tts of ttsEstimates) {
        addStep(tts)
      }
    }

    if (command === 'image') {
      for (const image of buildImageEstimates(generationOpts)) {
        addStep(image)
      }
    }

    if (command === 'video') {
      for (const video of await buildVideoEstimates(generationOpts)) {
        addStep(video)
      }
    }

    if (command === 'music') {
      for (const music of await buildMusicEstimates(generationOpts)) {
        addStep(music)
      }
    }
  }

  if (steps.some((step) => step.step === 'stt' && step.provider === 'supadata')) {
    notes.push(SUPADATA_STT_AGGREGATE_NOTE)
  }

  if (steps.some((step) => step.step === 'stt' && step.provider === 'scrapecreators')) {
    notes.push(SCRAPECREATORS_STT_AGGREGATE_NOTE)
  }

  const timing = buildAggregateTiming(steps, ttsTimingCharacterCount, buildTimingOptions(opts, {
    ...(typeof ttsTimingInputText === 'string' ? { ttsInputText: ttsTimingInputText } : {})
  }))

  return {
    steps,
    totalEstimatedCost,
    ...(timing && timing.steps.length > 0 ? { timing } : {}),
    ...(notes.length > 0 ? { notes } : {})
  }
}
