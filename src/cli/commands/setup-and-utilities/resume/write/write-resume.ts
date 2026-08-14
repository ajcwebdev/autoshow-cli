import { isRecord } from '~/utils/rest-client'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { serializeOneOrMany } from '~/cli/commands/process-steps/target-runner'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { deriveGenerationResumeProviderFlags, WRITE_LLM_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { writeShowNoteArtifacts } from '~/cli/commands/process-steps/step-3-write/show-note-artifacts'
import { writeRenderedTextArtifacts } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { resolveStructuredSchema } from '~/cli/commands/process-steps/step-3-write/structured-output/schema-resolver'
import { isSongLyricsPreset } from '~/cli/commands/process-steps/step-3-write/structured-output/preset-registry'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeObservedEstimateCosts, computePriceAlignedEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { toArray } from '~/utils/text-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { getLlmCost, getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { isNormalizedReasoningEffort, resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import type { ExtractEstimateTarget, ExtractionMetadata, GenerationResumeConfig, LLMOptions, LLMTarget, LlmStepEstimate, ResumeTarget, Step1Metadata, Step2Metadata, Step3Metadata, StructuredValidationContext, WriteRuntimeOptions } from '~/types'

const WRITE_LLM_PROVIDER_FLAGS = deriveGenerationResumeProviderFlags(
  WRITE_LLM_GENERATION_SELECTION,
  'all-llm',
  'all-local-llm'
)

const LLM_SERVICES = new Set<Step3Metadata['llmService']>([
  'llama.cpp',
  'openai',
  'groq',
  'gemini',
  'anthropic',
  'minimax',
  'grok',
  'glm',
  'kimi',
  'together',
  'cerebras'
])

const EXTRACT_ESTIMATE_PROVIDERS = new Set<ExtractEstimateTarget['provider']>([
  'mistral',
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra',
  'defuddle',
  'firecrawl',
  'glm-reader',
  'spider',
  'supadata',
  'zyte'
])


const isStep3Metadata = (value: unknown): value is Step3Metadata =>
  isRecord(value)
  && LLM_SERVICES.has(value['llmService'] as Step3Metadata['llmService'])
  && typeof value['llmModel'] === 'string'
  && typeof value['processingTime'] === 'number'
  && typeof value['inputTokenCount'] === 'number'
  && typeof value['outputTokenCount'] === 'number'
  && typeof value['outputFileName'] === 'string'
  && value['outputFormat'] === 'json'
  && (value['structuredMode'] === 'native' || value['structuredMode'] === 'schema-guided')
  && Array.isArray(value['structuredPresetNames'])
  && value['structuredPresetNames'].every((entry) => typeof entry === 'string')
  && (value['validationFailed'] === undefined || typeof value['validationFailed'] === 'boolean')
  && (value['requestedReasoningEffort'] === undefined || isNormalizedReasoningEffort(value['requestedReasoningEffort']))
  && (value['effectiveReasoningEffort'] === undefined || isNormalizedReasoningEffort(value['effectiveReasoningEffort']))

const getExistingStep3Entries = (
  metadata: Record<string, unknown>
): Step3Metadata[] =>
  toArray(metadata['step3']).filter(isStep3Metadata)

const targetKey = (
  target: Pick<LLMTarget, 'service' | 'model'>
): string => `${target.service}:${target.model}`

const metadataKey = (
  entry: Pick<Step3Metadata, 'llmService' | 'llmModel'>
): string => `${entry.llmService}:${entry.llmModel}`

const uniqueTargets = (
  targets: LLMTarget[]
): LLMTarget[] => {
  const seen = new Set<string>()
  const out: LLMTarget[] = []
  for (const target of targets) {
    const key = targetKey(target)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(target)
  }
  return out
}

const collectWriteTargets = (
  opts: WriteRuntimeOptions,
  outputDir: string
): LLMTarget[] => {
  const llmOptions: LLMOptions = {
    ...opts,
    outputDir
  }
  return uniqueTargets(collectLlmTargets(llmOptions))
}

const sanitizeFileStem = (
  value: string
): string => value.replace(/[/\\:*?"<>|]/g, '-')

const countByModel = (
  values: Array<{ model: string }>
): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value.model, (counts.get(value.model) ?? 0) + 1)
  }
  return counts
}

const countExistingByModel = (
  values: Step3Metadata[]
): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value.llmModel, (counts.get(value.llmModel) ?? 0) + 1)
  }
  return counts
}

const makeUniqueFileName = (
  baseFileName: string,
  reservedFileNames: Set<string>
): string => {
  if (!reservedFileNames.has(baseFileName)) {
    reservedFileNames.add(baseFileName)
    return baseFileName
  }

  const stem = baseFileName.replace(/\.json$/u, '')
  let index = 2
  while (reservedFileNames.has(`${stem}-${index}.json`)) {
    index += 1
  }
  const fileName = `${stem}-${index}.json`
  reservedFileNames.add(fileName)
  return fileName
}

export const buildWriteResumeOutputFileName = (options: {
  target: Pick<LLMTarget, 'service' | 'model'>
  selectedTargets: Array<Pick<LLMTarget, 'service' | 'model'>>
  existingEntries: Step3Metadata[]
  reservedFileNames: Set<string>
}): string => {
  const existingModelCounts = countExistingByModel(options.existingEntries)
  const selectedModelCounts = countByModel(options.selectedTargets)
  const modelStem = sanitizeFileStem(options.target.model)
  const serviceStem = sanitizeFileStem(options.target.service)
  const needsServicePrefix = (existingModelCounts.get(options.target.model) ?? 0) > 0
    || (selectedModelCounts.get(options.target.model) ?? 0) > 1
  const fileName = needsServicePrefix
    ? `text-${serviceStem}-${modelStem}.json`
    : `text-${modelStem}.json`

  return makeUniqueFileName(fileName, options.reservedFileNames)
}

const collectReservedTextJsonFileNames = async (
  outputDir: string,
  existingEntries: Step3Metadata[]
): Promise<Set<string>> => {
  const reserved = new Set(
    existingEntries
      .map((entry) => entry.outputFileName)
      .filter((fileName) => fileName.endsWith('.json'))
  )

  try {
    for (const entry of await readdir(outputDir, { withFileTypes: true })) {
      if (entry.isFile() && /^text(?:-.+)?\.json$/u.test(entry.name)) {
        reserved.add(entry.name)
      }
    }
  } catch {
    return reserved
  }

  return reserved
}

const readTextFileIfPresent = async (
  filePath: string
): Promise<string | undefined> => {
  const file = Bun.file(filePath)
  if (!await file.exists()) {
    return undefined
  }
  const text = await file.text()
  return text.trim().length > 0 ? text : undefined
}

const readSourceText = async (
  outputDir: string
): Promise<string> =>
  await readTextFileIfPresent(join(outputDir, 'transcription.txt'))
  ?? await readTextFileIfPresent(join(outputDir, 'extraction.txt'))
  ?? ''

const resolvePromptNamesForResume = (
  opts: WriteRuntimeOptions,
  existingEntries: Step3Metadata[]
): string[] => {
  if (opts.prompts.length > 0) {
    return opts.prompts
  }

  const storedPromptNames = existingEntries.find(
    (entry) => entry.structuredPresetNames.length > 0
  )?.structuredPresetNames

  return storedPromptNames ?? []
}

const resolveStructuredValidationContext = async (
  promptNames: string[],
  metadata: Record<string, unknown>
): Promise<{
  structuredSchema: Awaited<ReturnType<typeof resolveStructuredSchema>>
  structuredValidationContext: StructuredValidationContext
}> => {
  const structuredSchema = await resolveStructuredSchema(promptNames)
  const step1 = isRecord(metadata['step1']) ? metadata['step1'] : undefined
  const title = typeof step1?.['title'] === 'string' ? step1['title'].trim() : ''
  const structuredValidationContext: StructuredValidationContext = {
    leafPromptNames: structuredSchema.leafPromptNames,
    presetNames: structuredSchema.presetNames,
    ...(structuredSchema.presetNames.some(isSongLyricsPreset) && title.length > 0
      ? { songLyricsTitle: title }
      : {})
  }

  return { structuredSchema, structuredValidationContext }
}

const isStep2Metadata = (
  value: unknown
): value is Step2Metadata =>
  isRecord(value)
  && typeof value['transcriptionService'] === 'string'
  && typeof value['transcriptionModel'] === 'string'

const isExtractionMetadata = (
  value: unknown
): value is ExtractionMetadata =>
  isRecord(value)
  && typeof value['extractionMethod'] === 'string'

const isExtractEstimateProvider = (
  value: string
): value is ExtractEstimateTarget['provider'] =>
  EXTRACT_ESTIMATE_PROVIDERS.has(value as ExtractEstimateTarget['provider'])

const getStep2ForCosting = (
  value: unknown
): Step2Metadata | Step2Metadata[] | ExtractionMetadata | ExtractionMetadata[] | undefined => {
  if (Array.isArray(value)) {
    const step2Entries = value.filter(isStep2Metadata)
    if (step2Entries.length === value.length && step2Entries.length > 0) {
      return step2Entries
    }

    const extractionEntries = value.filter(isExtractionMetadata)
    if (extractionEntries.length === value.length && extractionEntries.length > 0) {
      return extractionEntries
    }

    return undefined
  }

  if (isStep2Metadata(value) || isExtractionMetadata(value)) {
    return value
  }

  return undefined
}

const getStep2SttTargets = (
  value: unknown
): Array<{ service: Step2Metadata['transcriptionService'], model: string }> => {
  const entries = Array.isArray(value) ? value : [value]
  return entries
    .filter(isStep2Metadata)
    .map((entry) => ({
      service: entry.transcriptionService,
      model: entry.transcriptionModel
    }))
}

const getStep2ExtractTargets = (
  value: unknown
): ExtractEstimateTarget[] => {
  const entries = Array.isArray(value) ? value : [value]
  return entries
    .filter(isExtractionMetadata)
    .flatMap((entry) => {
      const { provider, model } = resolveExtractionProviderModel(entry)
      if (!isExtractEstimateProvider(provider)) {
        return []
      }

      return [{
        provider,
        model,
        pageCount: entry.totalPages,
        ...(typeof entry.promptTokens === 'number' ? { promptTokens: entry.promptTokens } : {}),
        ...(typeof entry.completionTokens === 'number' ? { completionTokens: entry.completionTokens } : {}),
        ...(typeof entry.providerCostCents === 'number' ? { quotedCostCents: entry.providerCostCents } : {}),
        estimateType: typeof entry.providerCostCents === 'number' ? 'exact' as const : 'heuristic' as const
      }]
    })
}

const getAudioDurationSeconds = (
  step1: Step1Metadata | undefined
): number | undefined =>
  typeof step1?.durationSeconds === 'number' ? step1.durationSeconds : undefined

const rebuildWriteCostTiming = (
  currentMetadata: Record<string, unknown>,
  mergedStep3: Step3Metadata[]
): Pick<Record<string, unknown>, 'cost' | 'timing'> => {
  const step1 = isRecord(currentMetadata['step1'])
    ? currentMetadata['step1'] as Step1Metadata
    : undefined
  const step2 = getStep2ForCosting(currentMetadata['step2'])
  const audioDurationSeconds = getAudioDurationSeconds(step1)
  const llmTargets = mergedStep3.map((entry) => ({
    service: entry.llmService,
    model: entry.llmModel,
    inputTokens: entry.inputTokenCount,
    outputTokens: entry.outputTokenCount
  }))
  const extractTargets = getStep2ExtractTargets(currentMetadata['step2'])
  const estimatedInput = {
    ...(typeof step1?.url === 'string' ? { sourceUrl: step1.url } : {}),
    ...(typeof audioDurationSeconds === 'number' ? { audioDurationSeconds } : {}),
    sttTargets: getStep2SttTargets(currentMetadata['step2']),
    ...(extractTargets.length > 0 ? { extractTargets } : {}),
    llmTargets,
    skipLLM: false
  }
  const estimated = computePriceAlignedEstimatedCosts(undefined, estimatedInput)
  const observedEstimate = computeObservedEstimateCosts(estimatedInput)
  const actual = computeActualCosts({
    ...(step1 ? { step1 } : {}),
    ...(step2 ? { step2 } : {}),
    step3: serializeOneOrMany(mergedStep3),
    ...(typeof audioDurationSeconds === 'number' ? { audioDurationSeconds } : {})
  })
  const estimatedTiming = computeEstimatedProcessingTimes({
    ...(typeof audioDurationSeconds === 'number' ? { audioDurationSeconds } : {}),
    sttTargets: getStep2SttTargets(currentMetadata['step2']),
    ...(extractTargets.length > 0 ? { extractTargets } : {}),
    llmTargets,
    skipLLM: false
  })
  const actualTiming = computeActualProcessingTimes({
    ...(step1 ? { step1 } : {}),
    ...(step2 ? { step2 } : {}),
    step3: serializeOneOrMany(mergedStep3),
    ...(typeof audioDurationSeconds === 'number' ? { audioDurationSeconds } : {})
  })

  return {
    cost: {
      ...(isRecord(currentMetadata['cost']) ? currentMetadata['cost'] : {}),
      estimated,
      observedEstimate,
      actual
    },
    timing: {
      ...(isRecord(currentMetadata['timing']) ? currentMetadata['timing'] : {}),
      estimated: estimatedTiming,
      actual: actualTiming
    }
  }
}

const averageTokenCount = (
  entries: Step3Metadata[],
  key: 'inputTokenCount' | 'outputTokenCount'
): number =>
  Math.max(0, Math.round(
    entries.reduce((sum, entry) => sum + entry[key], 0) / Math.max(1, entries.length)
  ))

const llmRegistryService = (
  service: LLMTarget['service']
): string =>
  service === 'llama.cpp' ? 'llama' : service

const buildWriteResumeLlmEstimates = (
  targets: LLMTarget[],
  existingEntries: Step3Metadata[],
  opts: WriteRuntimeOptions
): LlmStepEstimate[] => {
  const estimatedInputTokens = averageTokenCount(existingEntries, 'inputTokenCount')
  const estimatedOutputTokens = averageTokenCount(existingEntries, 'outputTokenCount')

  return targets.map((target) => {
    const registryService = llmRegistryService(target.service)
    const requestedReasoningEffort = target.service === 'llama.cpp' || target.service === 'llamafile'
      ? undefined
      : opts.reasoningEffort
    const reasoningPolicy = resolveReasoningPolicy({
      step: 'llm',
      service: registryService,
      model: target.model,
      requestedReasoningEffort
    })
    const pricing = getLlmCost(registryService, target.model) ?? {
      inputCostPer1MCents: 0,
      outputCostPer1MCents: 0
    }
    const estimation = getLlmEstimation(registryService, target.model)
    const cost = computeTokenCost(
      pricing,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimation.costMultiplier
    )

    return {
      step: 'llm',
      provider: target.service,
      model: target.model,
      inputCostPer1MCents: cost.inputCostPer1MCents,
      outputCostPer1MCents: cost.outputCostPer1MCents,
      estimatedInputTokens,
      estimatedOutputTokens,
      ...(reasoningPolicy.requested !== undefined ? { requestedReasoningEffort: reasoningPolicy.requested } : {}),
      effectiveReasoningEffort: reasoningPolicy.effective,
      totalCost: cost.totalCost,
      costMultiplier: estimation.costMultiplier,
      ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
      ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {})
    }
  })
}

export const writeResumeConfig = {
  kind: 'write' as const,
  metadataKey: 'step3',
  stepLabel: 'Write',
  providerFlags: WRITE_LLM_PROVIDER_FLAGS,
  selectionMode: 'selected-only' as const,
  parseManifestEntries: (metadata: Record<string, unknown>) => {
    const entries = getExistingStep3Entries(metadata)
    return entries.length > 0 ? entries : undefined
  },
  validateManifestForResume: (item, entries, opts) => {
    if (opts.reasoningEffort === undefined) {
      return undefined
    }

    const selectedKeys = new Set(
      collectWriteTargets(opts, item.outputDir ?? '')
        .map(targetKey)
    )
    for (const entry of entries) {
      if (!selectedKeys.has(metadataKey(entry))) {
        continue
      }
      if (entry.llmService === 'llama.cpp' || entry.llmService === 'llamafile') {
        continue
      }
      const policy = resolveReasoningPolicy({
        step: 'llm',
        service: llmRegistryService(entry.llmService),
        model: entry.llmModel,
        requestedReasoningEffort: opts.reasoningEffort
      })
      if (entry.effectiveReasoningEffort !== policy.effective) {
        const stored = entry.effectiveReasoningEffort ?? 'unrecorded'
        return `Write resume reasoning policy mismatch for ${entry.llmService}/${entry.llmModel}: manifest effective effort is ${stored}, but the current request resolves to ${policy.effective}.`
      }
    }

    return undefined
  },
  resolveInput: async (target: ResumeTarget) => {
    const prompt = await readTextFileIfPresent(join(target.dir, 'prompt.md'))
    if (!prompt) {
      throw CLIUsageError(`Write resume requires prompt.md in ${target.dir}.`)
    }
    return prompt
  },
  serializeEntries: (entries: Step3Metadata[]) => serializeOneOrMany(entries),
  failureMessage: (
    failure: 'failed' | 'incomplete',
    providers: Array<{ service: string, model: string }>
  ) => failure === 'failed'
    ? `Write resume still has failed providers: ${providers.map((entry) => `${entry.service}/${entry.model}`).join(', ')}`
    : `Write resume still has ${providers.length} incomplete provider(s): ${providers.map((entry) => `${entry.service}/${entry.model}`).join(', ')}`,
  getSuccessKey: metadataKey,
  collectTargets: (opts: WriteRuntimeOptions, target: ResumeTarget) =>
    collectWriteTargets(opts, target.dir),
  runMissingTargets: async (
    targets: LLMTarget[],
    prompt: string,
    outputDir: string,
    opts: WriteRuntimeOptions,
    context: {
      existingEntries: Step3Metadata[]
      currentManifestMetadata: Record<string, unknown>
    }
  ) => {
    const promptNames = resolvePromptNamesForResume(opts, context.existingEntries)
    const { structuredSchema, structuredValidationContext } = await resolveStructuredValidationContext(
      promptNames,
      context.currentManifestMetadata
    )
    const reservedFileNames = await collectReservedTextJsonFileNames(outputDir, context.existingEntries)
    const results = await runLlmTargetsForStructuredPrompt({
      prompt,
      outputDir,
      targets,
      structuredSchema,
      structuredValidationContext,
      llmProviderConcurrency: opts.llmProviderConcurrency,
      llmLocalConcurrency: opts.llmLocalConcurrency,
      reasoningEffort: opts.reasoningEffort,
      fileNameForTarget: (llmTarget) => buildWriteResumeOutputFileName({
        target: llmTarget,
        selectedTargets: targets,
        existingEntries: context.existingEntries,
        reservedFileNames
      })
    })

    const sourceText = await readSourceText(outputDir)
    await writeShowNoteArtifacts({
      outputDir,
      results,
      sourceText
    })

    if (opts.renderedText || opts.renderedOutDir) {
      await writeRenderedTextArtifacts({
        outputDir,
        results,
        writeInternal: opts.renderedText,
        ...(opts.renderedOutDir ? { externalDir: opts.renderedOutDir, externalBaseName: 'text' } : {})
      })
    }

    return results.map((result) => result.metadata)
  },
  buildEstimates: (
    opts: WriteRuntimeOptions,
    _input: string,
    context: { targets: LLMTarget[], existingEntries: Step3Metadata[] }
  ) => buildWriteResumeLlmEstimates(context.targets, context.existingEntries, opts),
  rebuildRunMetadata: (
    metadata: Step3Metadata[],
    currentManifestMetadata: Record<string, unknown>
  ) => rebuildWriteCostTiming(currentManifestMetadata, metadata)
} satisfies GenerationResumeConfig<LLMTarget, Step3Metadata, WriteRuntimeOptions>
