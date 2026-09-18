import { isRecord } from '~/utils/rest-client'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { serializeOneOrMany } from '~/cli/commands/command-shared/target-runner'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { deriveGenerationResumeProviderFlags, WRITE_LLM_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { writeShowNoteArtifacts } from '~/cli/commands/text/write/show-note-artifacts'
import { writeRenderedTextArtifacts } from '~/cli/commands/text/write/text-input-utils'
import { resolveStructuredSchema } from '~/cli/commands/text/write/structured-output/schema-resolver'
import { isSongLyricsPreset } from '~/cli/commands/text/write/structured-output/preset-registry'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeObservedEstimateCosts, computePriceAlignedEstimatedCosts } from '~/cli/commands/pricing-orchestration/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { toArray } from '~/utils/text-utils'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { getLlmCost, getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'
import { isNormalizedReasoningEffort, resolveReasoningPolicy } from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { sha256Bytes } from '~/utils/value-helpers'
import type { GenerationResumeConfig, LLMOptions, LLMTarget, LlmStepEstimate, ResumeTarget, Step3Metadata, StructuredValidationContext, WriteRuntimeOptions } from '~/types'

const WRITE_LLM_PROVIDER_FLAGS = deriveGenerationResumeProviderFlags(
  WRITE_LLM_GENERATION_SELECTION,
  'all-llm'
)

const LLM_SERVICES = new Set<Step3Metadata['llmService']>([
  'openai',
  'gemini',
  'anthropic',
  'grok',
  'glm',
  'kimi',
  'together',
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

const WRITE_SOURCE_SNAPSHOT_FILENAME = 'source.txt'

const assertNoExtractInWriteMetadata = (metadata: Record<string, unknown>): void => {
  if (metadata['step1'] !== undefined || metadata['step2'] !== undefined) {
    throw ValidationError(
      'Write resume no longer accepts extract-in-write manifests with step1/step2 metadata. Re-run write against the current text-input contract.',
      { stage: 'resume:write' }
    )
  }
}

const requireWriteSourceSnapshot = (metadata: Record<string, unknown>): { path: string, sha256: string } => {
  assertNoExtractInWriteMetadata(metadata)
  const source = isRecord(metadata['source']) ? metadata['source'] : undefined
  if (!source || source['kind'] !== 'text-input') {
    throw ValidationError(
      'Write resume requires source.kind "text-input" with a hashed local source snapshot.',
      { stage: 'resume:write' }
    )
  }
  const snapshot = isRecord(source['snapshot']) ? source['snapshot'] : undefined
  if (!snapshot || typeof snapshot['path'] !== 'string' || typeof snapshot['sha256'] !== 'string') {
    throw ValidationError(
      'Write resume requires source.snapshot.path and source.snapshot.sha256 from the original text-input write.',
      { stage: 'resume:write' }
    )
  }
  return { path: snapshot['path'], sha256: snapshot['sha256'] }
}

const readSourceText = async (
  outputDir: string,
  metadata: Record<string, unknown>
): Promise<string> => {
  const snapshot = requireWriteSourceSnapshot(metadata)
  const relativePath = snapshot.path.trim() || WRITE_SOURCE_SNAPSHOT_FILENAME
  if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.includes('\\')) {
    throw ValidationError(`Write resume source snapshot path is invalid: ${relativePath}`, { stage: 'resume:write' })
  }
  const absolutePath = join(outputDir, relativePath)
  const file = Bun.file(absolutePath)
  if (!(await file.exists())) {
    throw ValidationError(
      `Write resume requires the hashed source snapshot at ${relativePath}. Re-run write to create a current text-input run.`,
      { stage: 'resume:write' }
    )
  }
  const text = await file.text()
  const actualHash = sha256Bytes(text)
  if (actualHash !== snapshot.sha256) {
    throw ValidationError(
      `Write resume source snapshot hash mismatch for ${relativePath}: expected ${snapshot.sha256}, found ${actualHash}.`,
      { stage: 'resume:write' }
    )
  }
  return text
}

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
  assertNoExtractInWriteMetadata(metadata)
  const structuredSchema = await resolveStructuredSchema(promptNames)
  const title = typeof metadata['title'] === 'string' ? metadata['title'].trim() : ''
  const structuredValidationContext: StructuredValidationContext = {
    leafPromptNames: structuredSchema.leafPromptNames,
    presetNames: structuredSchema.presetNames,
    ...(structuredSchema.presetNames.some(isSongLyricsPreset) && title.length > 0
      ? { songLyricsTitle: title }
      : {})
  }

  return { structuredSchema, structuredValidationContext }
}

const rebuildWriteCostTiming = (
  currentMetadata: Record<string, unknown>,
  mergedStep3: Step3Metadata[]
): Pick<Record<string, unknown>, 'cost' | 'timing'> => {
  assertNoExtractInWriteMetadata(currentMetadata)
  const llmTargets = mergedStep3.map((entry) => ({
    service: entry.llmService,
    model: entry.llmModel,
    inputTokens: entry.inputTokenCount,
    outputTokens: entry.outputTokenCount
  }))
  const estimatedInput = { llmTargets }
  const estimated = computePriceAlignedEstimatedCosts(undefined, estimatedInput)
  const observedEstimate = computeObservedEstimateCosts(estimatedInput)
  const actual = computeActualCosts({
    step3: serializeOneOrMany(mergedStep3)
  })
  const estimatedTiming = computeEstimatedProcessingTimes({ llmTargets })
  const actualTiming = computeActualProcessingTimes({
    step3: serializeOneOrMany(mergedStep3)
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
  service

const buildWriteResumeLlmEstimates = (
  targets: LLMTarget[],
  existingEntries: Step3Metadata[],
  opts: WriteRuntimeOptions
): LlmStepEstimate[] => {
  const estimatedInputTokens = averageTokenCount(existingEntries, 'inputTokenCount')
  const estimatedOutputTokens = averageTokenCount(existingEntries, 'outputTokenCount')

  return targets.map((target) => {
    const registryService = llmRegistryService(target.service)
    const requestedReasoningEffort = opts.reasoningEffort
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
    try {
      assertNoExtractInWriteMetadata((item.metadata ?? {}) as Record<string, unknown>)
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }

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
      throw UsageError(`Write resume requires prompt.md in ${target.dir}.`)
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
    const sourceText = await readSourceText(outputDir, context.currentManifestMetadata)
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
