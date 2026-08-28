import type { CommandPricingOptions, ProcessingOptions, ProcessCommand, StepEstimate, WriteRuntimeOptions } from '~/types'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { resolveSttStep2Execution } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/resolved-step2'
import { buildArticleEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-article-estimates'
import { buildExtractEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates'
import { buildImageEstimates, buildMusicEstimates, buildVideoEstimates } from './generation-estimates'
import { buildLlmEstimates } from './llm-estimates'
import { buildSttEstimates } from './stt-estimates'
import { buildTtsEstimates } from './tts-estimates'

type PricingOptions = CommandPricingOptions | WriteRuntimeOptions | ProcessingOptions

export type PriceEstimateContribution = {
  steps: StepEstimate[]
  notes: string[]
  ttsTimingCharacterCount?: number | undefined
  ttsTimingInputText?: string | undefined
}

const isProcessingOptions = (opts: PricingOptions): opts is ProcessingOptions =>
  'outputDir' in opts && ('url' in opts || 'filePath' in opts)

const buildExtractContribution = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: CommandPricingOptions | ProcessingOptions
): Promise<PriceEstimateContribution> => {
  const processingOptions = isProcessingOptions(opts)
  const routing = processingOptions
    ? { family: 'media' as const, resolvedStep2: resolveSttStep2Execution(opts), extractRoute: 'media' as const }
    : await resolveInputRoutingForCommand(command === 'download' || command === 'metadata' ? 'extract' : command, resolvedTarget, opts)
  const steps: StepEstimate[] = []
  const notes: string[] = []
  if (isExtractCommand(command) && routing.extractRoute === 'media') {
    const estimates = await buildSttEstimates(resolvedTarget, opts)
    steps.push(...estimates)
    notes.push(...estimates.flatMap((estimate) => typeof estimate.note === 'string' && estimate.note.length > 0 ? [estimate.note] : []))
  }
  if (isExtractCommand(command) && routing.extractRoute === 'document' && routing.resolvedStep2.route === 'ocr' && !processingOptions) {
    steps.push(...await buildExtractEstimates(resolvedTarget, routing.resolvedStep2, {
      hostedOcrTokenProfilePath: 'hostedOcrTokenProfilePath' in opts ? opts.hostedOcrTokenProfilePath : undefined,
      reasoningEffort: opts.reasoningEffort,
      ocrProviderMode: opts.ocrProviderMode
    }))
  }
  if (routing.resolvedStep2.route === 'article' && !processingOptions) {
    const article = buildArticleEstimates(routing.resolvedStep2, opts, /^https?:\/\//i.test(resolvedTarget))
    steps.push(...article.estimates)
    notes.push(...article.notes)
  }
  return { steps, notes }
}

const buildGenerationContribution = async (
  command: Extract<ProcessCommand, 'tts' | 'image' | 'video' | 'music'>,
  opts: PricingOptions,
  characterCount: number | undefined,
  context: { ttsInputText?: string | undefined }
): Promise<PriceEstimateContribution> => {
  const generationOpts = opts as CommandPricingOptions
  if (command === 'tts') {
    const ttsTimingCharacterCount = characterCount ?? 0
    return {
      steps: await buildTtsEstimates(generationOpts, ttsTimingCharacterCount),
      notes: [],
      ttsTimingCharacterCount,
      ttsTimingInputText: context.ttsInputText
    }
  }
  if (command === 'image') return { steps: buildImageEstimates(generationOpts), notes: [] }
  if (command === 'video') return { steps: await buildVideoEstimates(generationOpts), notes: [] }
  return { steps: await buildMusicEstimates(generationOpts), notes: [] }
}

export const buildPriceEstimateContribution = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: PricingOptions,
  characterCount: number | undefined,
  context: { ttsInputText?: string | undefined }
): Promise<PriceEstimateContribution> => {
  if (command === 'write') {
    return { steps: await buildLlmEstimates(opts as WriteRuntimeOptions), notes: [] }
  }
  if (command === 'tts' || command === 'image' || command === 'video' || command === 'music') {
    return await buildGenerationContribution(command, opts, characterCount, context)
  }
  return await buildExtractContribution(command, resolvedTarget, opts as CommandPricingOptions | ProcessingOptions)
}
