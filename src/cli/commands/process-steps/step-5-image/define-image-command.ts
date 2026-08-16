import { defineCliCommand } from '~/cli/native/native-types'
import { imageCommandFlags, imageCommandOptionNames } from '~/cli/flags/image-flags'
import { retargetUsageErrorsToCommandSpellings } from '~/cli/flags/flag-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { normalizeCommandSelectorFlags } from '~/cli/flags/service-selector-normalization/flag-helpers'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { runImageGen } from './run-image-gen'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from './image-generation-targets'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { preflightToEstimated } from '~/cli/commands/pricing-orchestration/compute-costs'
import { evaluatePreflightEstimate } from '~/cli/commands/pricing-orchestration/preflight'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { buildImageEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/generation-estimates'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import type { CliFlagOccurrence, ImageRuntimeOptions, ResourceGate } from '~/types'

type StandaloneImageCommandOptions = ImageRuntimeOptions & {
  generationResourceGate?: ResourceGate | undefined
  price: boolean
  allowOverBudget: boolean
}

const runImageCommand = async (
  prompt: string,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): Promise<void> => {
  const imageMaxCents = await resolveMaxCentsFromFlags(flags)
  const optionNormalized = normalizeCommandSelectorFlags(flags, explicitFlags, flagOccurrences, imageCommandOptionNames)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    optionNormalized.flags,
    optionNormalized.explicitFlags,
    optionNormalized.flagOccurrences,
    'provider',
    STANDALONE_IMAGE_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-image' }
  )
  const imageOpts: StandaloneImageCommandOptions = buildOptsFromFlags(true, providerNormalized.flags, {}, providerNormalized.explicitFlags, providerNormalized.flagOccurrences)
  const imageTargets = collectImageTargets(imageOpts)
  if (imageTargets.length === 0) {
    throw CLIUsageError('No image provider specified. Use --provider gemini|openai|grok|bfl|replicate|lumalabs|fal[=model].')
  }

  const { estimate: preflightEstimate, shouldExit: imageShouldExit } = evaluatePreflightEstimate(
    aggregateExplicitPriceEstimate(buildImageEstimates(imageOpts), {}),
    imageOpts,
    imageMaxCents
  )
  if (imageShouldExit) {
    const expectedFiles = [
      ...imageTargets.flatMap((target) =>
        getExpectedImageArtifactFileNames(target, imageOpts, imageTargets.length === 1)
      ),
      'manifest.json'
    ]
    l.report.expectedOutput(getGenerationExpectedOutputDir('./output/<timestamp>_image-gen/'), expectedFiles)
    return
  }

  const outputDir = await createGenerationOutputDir('image-gen')

  const { metadata } = await runWithLogContext({ step: 'step-5-image' }, async () =>
    await runImageGen(prompt, outputDir, imageOpts)
  )

  const estimatedImageTargets = imageTargets.map((target) => ({
    service: target.service,
    model: target.model,
    count: getExpectedImageCount(target, imageOpts)
  }))
  const observedEstimate = computeEstimatedCosts({
    applyCostMultipliers: false,
    imageTargets: estimatedImageTargets,
    imageSize: imageOpts.imageSize,
    imageQuality: imageOpts.imageQuality
  })
  const actual = computeActualCosts({ step5: metadata })
  const cost = {
    estimated: preflightToEstimated(preflightEstimate),
    observedEstimate,
    actual
  }
  const timing = {
    estimated: computeEstimatedProcessingTimes({
      imageTargets: estimatedImageTargets,
    }),
    actual: computeActualProcessingTimes({ step5: metadata }),
  }

  await writeGenerationMetadata(outputDir, 'image', metadata, cost, timing, {
    input: prompt,
    requestedProviders: imageTargets.map((t) => ({ service: t.service, model: t.model })),
    completedProviders: metadata.map((entry) => ({ service: entry.imageService, model: entry.imageModel }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildImageArtifactMap(metadata),
      manifest: 'manifest.json'
    },
    {
      steps: buildProviderStepSummaries(
        'Image',
        'image',
        metadata,
        actual.steps,
        (entry) => `${entry.imageService}/${entry.imageModel}`,
        (entry) => entry.processingTime
      ),
      totalTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
      totalCost: actual.totalCost,
      includeOutputDir: false
    }
  )
}

export const imageCommand = defineCliCommand({
  name: 'image',
  description: 'Generate an image from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for image generation' }],
  flags: imageCommandFlags,
  help: {
    examples: [
      ['bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base', 'Generate a base product image'],
      ['bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit', 'Edit the generated image with OpenAI'],
      ['bun autoshow image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-lite-image --input output/mug-base/generated-image.png --output-dir output/mug-gemini', 'Use the generated image as a Gemini reference'],
      ['bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-quality --size 1K --count 4', 'Generate multiple Grok outputs'],
      ['bun autoshow image "place the same mug on a rustic breakfast table" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl', 'Generate with BFL reference input'],
      ['bun autoshow image "a handmade ceramic espresso cup on a marble counter" --provider bfl=flux-2-klein-4b --size 1024x1024 --format webp', 'Generate with FLUX.2 Klein'],
      ['bun autoshow image "a polished launch poster for a sci-fi audio drama" --provider replicate=wan-video/wan-2.7-image --size 2K --count 2', 'Generate with Replicate Wan'],
      ['bun autoshow image "a glass of iced coffee on a marble countertop in morning light" --provider lumalabs=uni-1 --aspect-ratio 16:9 --format png', 'Generate with Luma Labs'],
      ['bun autoshow image "a launch poster with crisp typography" --provider fal=alibaba/qwen-image-3 --count 2', 'Generate with fal.ai']
    ]
  }
}, retargetUsageErrorsToCommandSpellings(async (ctx) => {
  await runImageCommand(ctx.parameters.prompt, ctx.flags as Record<string, unknown>, ctx.rawParsed.explicitFlags, ctx.rawParsed.flagOccurrences)
}, imageCommandOptionNames))
