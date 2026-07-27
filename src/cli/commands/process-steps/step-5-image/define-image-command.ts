import { defineCliCommand } from '~/cli/native/native-types'
import { imageCommandFlags } from '~/cli/flags/image-flags'
import { CLIUsageError } from '~/utils/error-handler'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'
import { normalizeCommandSelectorArgs, normalizeCommandSelectorFlags } from '~/cli/flags/service-selector-normalization/flag-helpers'
import { normalizeGenericProviderSelectorFlags } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { STANDALONE_IMAGE_PROVIDER_TARGETS } from '~/cli/flags/service-selector-normalization/provider-targets'
import { runImageGen } from './run-image-gen'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageArtifactFileNames, getExpectedImageCount } from './image-generation-targets'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { runPreflight } from '~/utils/pricing/preflight'
import { buildProviderStepSummaries, createGenerationOutputDir, getGenerationExpectedOutputDir, resolveMaxCentsFromFlags, writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'

const IMAGE_COMMAND_OPTION_FLAGS = {
  'image-aspect-ratio': 'aspect-ratio',
  'image-size': 'size',
  'image-quality': 'quality',
  'image-format': 'format',
  'image-background': 'background',
  'image-count': 'count',
  'image-input': 'input',
  'image-mask': 'mask',
  'image-response-mode': 'response-mode',
  'image-search-grounding': 'search-grounding',
  'image-compression': 'compression'
} as const satisfies Record<string, string>

export const imageCommand = defineCliCommand({
  name: 'image',
  description: 'Generate an image from a text prompt',
  parameters: [{ key: '<prompt>', description: 'Text prompt for image generation' }],
  flags: imageCommandFlags,
  help: {
    examples: [
      ['bun autoshow image "a clean studio product photo of a red enamel camping mug on white seamless" --provider openai=gpt-image-2 --size 1024x1024 --format png --output-dir output/mug-base', 'Generate a base product image'],
      ['bun autoshow image "make the mug matte black, keep the same camera angle, and place it on a walnut desk" --provider openai=gpt-image-2 --input output/mug-base/generated-image.png --format webp --compression 80 --output-dir output/mug-edit', 'Edit the generated image with OpenAI'],
      ['bun autoshow image "restyle this product image as a 1960s travel poster" --provider gemini=gemini-3.1-flash-image-preview --input output/mug-base/generated-image.png --output-dir output/mug-gemini', 'Use the generated image as a Gemini reference'],
      ['bun autoshow image "a futuristic observatory at sunset" --provider grok=grok-imagine-image-quality --size 1K --count 4', 'Generate multiple Grok outputs'],
      ['bun autoshow image "place the same mug on a rustic breakfast table" --provider bfl=flux-2-pro --input output/mug-base/generated-image.png --size 1024x1024 --output-dir output/mug-bfl', 'Generate with BFL reference input'],
      ['bun autoshow image "a handmade ceramic espresso cup on a marble counter" --provider reve=latest --aspect-ratio 3:2 --format webp', 'Generate with Reve'],
      ['bun autoshow image "a geometric fox logo in clean vector shapes" --provider recraft=recraftv4_1_vector --aspect-ratio 1:1', 'Generate with Recraft'],
      ['bun autoshow image "a polished launch poster for a sci-fi audio drama" --provider replicate=wan-video/wan-2.7-image --size 2K --count 2', 'Generate with Replicate Wan'],
      ['bun autoshow image "a glass of iced coffee on a marble countertop in morning light" --provider lumalabs=uni-1 --aspect-ratio 16:9 --format png', 'Generate with Luma Labs']
    ]
  }
}, async (ctx) => {
  const prompt = ctx.parameters.prompt
  const flags = ctx.flags

  const imageMaxCents = await resolveMaxCentsFromFlags(flags as Record<string, unknown>)
  const rawArgs = Bun.argv.slice(2)
  const explicitFlags = extractExplicitFlags(rawArgs)
  const optionNormalized = normalizeCommandSelectorFlags(flags as Record<string, unknown>, explicitFlags, IMAGE_COMMAND_OPTION_FLAGS)
  const optionNormalizedArgs = normalizeCommandSelectorArgs(rawArgs, IMAGE_COMMAND_OPTION_FLAGS)
  const providerNormalized = normalizeGenericProviderSelectorFlags(
    optionNormalized.flags,
    optionNormalized.explicitFlags,
    'provider',
    STANDALONE_IMAGE_PROVIDER_TARGETS,
    { allProvidersTarget: 'all-image', rawArgs: optionNormalizedArgs }
  )
  const imageOpts = buildOptsFromFlags(true, providerNormalized.flags, [], {}, providerNormalized.explicitFlags, providerNormalized.rawArgs ?? optionNormalizedArgs)
  const imageTargets = collectImageTargets(imageOpts)
  if (imageTargets.length === 0) {
    throw CLIUsageError('No image provider specified. Use --provider gemini|openai|grok|bfl|reve|recraft|replicate|lumalabs[=model].')
  }

  const { estimate: preflightEstimate, shouldExit: imageShouldExit } = await runPreflight('image', prompt, imageOpts, imageMaxCents)
  if (imageShouldExit) {
    const expectedFiles = [
      ...imageTargets.flatMap((target) =>
        getExpectedImageArtifactFileNames(target, imageOpts, imageTargets.length === 1)
      ),
      'run.json'
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
    requestedProviders: imageTargets.map((t) => ({ service: t.service, model: t.model }))
  })

  l.report.complete(
    outputDir,
    {
      ...buildImageArtifactMap(metadata),
      run: 'run.json'
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
})
