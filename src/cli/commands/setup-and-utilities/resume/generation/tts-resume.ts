import { buildUpdatedGenerationCostTiming, collectGenerationTargetsForProviders } from '../generation-resume'
import { readManifest, updateManifest, type ManifestUpdater } from '~/cli/commands/process-steps/pipeline-manifest'
import { collectTtsTargets, getTtsArtifactFileName } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { runTtsTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { deriveGenerationResumeModelFields, deriveGenerationResumeProviderFlags, TTS_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { appendCurrentTtsProviderState, getCurrentTtsJournalAttemptKey } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { planCurrentTtsRenderIdentity, planCurrentTtsResumePrice, prepareCurrentTtsCompletedRecovery } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { bindTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildTtsTargetEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/tts-estimates'
import { UsageError } from '~/utils/error-handler'
import { resolveTtsResumeSourceContext } from './tts-resume-source-context'
import type { GenerationResumeConfig, GenerationResumeProviderIdentity, GenerationResumeRunContext, PipelineManifestItem, PipelineProviderState, ProtectedVoiceAssetStore, ResumeTarget, Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { resolveUserPath } from '~/utils/runtime-paths'
import { materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import {
  protectedRecoveryOnlyTargets,
  resolveStoredMistralTtsTargetsForResume
} from './mistral-resume-target-reconstruction'

const TTS_PROVIDER_FLAGS = deriveGenerationResumeProviderFlags(
  TTS_GENERATION_SELECTION,
  'all-tts'
)

const TTS_MODEL_FIELDS = deriveGenerationResumeModelFields(TTS_GENERATION_SELECTION)

const getTtsResumeProviderKey = (
  provider: GenerationResumeProviderIdentity
): string => {
  if (!provider.targetKey) {
    throw UsageError(`TTS resume target ${provider.service}/${provider.model} is missing its operation-scoped targetKey.`)
  }
  return provider.targetKey
}

const reduceTtsResumeItemStatus = (
  providers: PipelineProviderState[]
): PipelineManifestItem['status'] => {
  if (providers.length === 0) {
    throw UsageError('A resumed TTS item must retain at least one operation-scoped provider state.')
  }
  if (providers.every((provider) => provider.status === 'skipped')) return 'skipped'
  if (
    providers.some((provider) => provider.status === 'succeeded')
    && providers.every((provider) => provider.status === 'succeeded' || provider.status === 'skipped')
  ) return 'full'
  if (providers.some((provider) => provider.status === 'succeeded')) return 'incomplete'
  if (
    providers.some((provider) => provider.status === 'failed')
    && providers.every((provider) => provider.status === 'failed' || provider.status === 'skipped')
  ) return 'failed'
  return 'incomplete'
}

const commitTtsResumeProviderState = async (
  rootDir: string,
  incoming: PipelineProviderState,
  providerOrder: readonly string[],
  itemIndex = 0,
  manifestUpdater?: ManifestUpdater
): Promise<void> => {
  await commitTtsResumePreparedStates(rootDir, [incoming], providerOrder, itemIndex, manifestUpdater)
}

const commitTtsResumePreparedStates = async (
  rootDir: string,
  incomingStates: readonly PipelineProviderState[],
  providerOrder: readonly string[],
  itemIndex = 0,
  manifestUpdater: ManifestUpdater = async (update) => await updateManifest(rootDir, update)
): Promise<void> => {
  if (incomingStates.length === 0) throw UsageError('TTS resume lifecycle produced no prepared provider states.')
  for (const incoming of incomingStates) {
    if (
      incoming.operation !== 'tts-synthesis'
      || !incoming.targetKey
      || !incoming.transport
      || typeof incoming.model !== 'string'
    ) {
      throw UsageError('TTS resume lifecycle produced a provider state without complete operation-scoped identity.')
    }
  }
  const orderByTargetKey = new Map(providerOrder.map((targetKey, index) => [targetKey, index] as const))
  await manifestUpdater((manifest) => {
    if (manifest.command !== 'tts' || (manifest.scope !== 'single' && manifest.scope !== 'batch')) {
      throw UsageError('TTS resume lifecycle can update only a canonical TTS manifest.')
    }
    if (manifest.scope === 'single' && (manifest.items.length !== 1 || itemIndex !== 0)) {
      throw UsageError('TTS resume lifecycle can update only one canonical single-run TTS manifest.')
    }
    const item = manifest.items[itemIndex] as PipelineManifestItem | undefined
    if (!item) {
      throw UsageError('TTS resume lifecycle received an out-of-range batch item.')
    }
    const providers = item.providers.slice()
    for (const incoming of incomingStates) {
      const index = providers.findIndex((provider) => provider.targetKey === incoming.targetKey)
      if (index >= 0) {
        providers[index] = appendCurrentTtsProviderState(providers[index] as PipelineProviderState, incoming)
      } else {
        providers.push(incoming)
      }
    }
    providers.sort((left, right) => {
      const leftOrder = left.targetKey ? orderByTargetKey.get(left.targetKey) : undefined
      const rightOrder = right.targetKey ? orderByTargetKey.get(right.targetKey) : undefined
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER)
    })
    const nextItem = {
      ...item,
      providers,
      status: reduceTtsResumeItemStatus(providers)
    }
    return {
      ...manifest,
      items: manifest.scope === 'batch'
        ? manifest.items.map((entry, index) => index === itemIndex ? nextItem : entry)
        : [nextItem]
    }
  })
}

const reconcileTtsResumeProviderStates = (
  context: {
    currentProviders: PipelineProviderState[]
    requestedProviders: GenerationResumeProviderIdentity[]
    targetsToRun: TtsTarget[]
    newEntries: Step4Metadata[]
  }
): PipelineProviderState[] => {
  const currentByKey = new Map(context.currentProviders.flatMap((provider) =>
    provider.targetKey ? [[provider.targetKey, provider] as const] : []
  ))

  return context.requestedProviders.map((provider) => {
    const targetKey = getTtsResumeProviderKey(provider)
    const current = currentByKey.get(targetKey)
    if (current) {
      return current
    }
    throw UsageError(`TTS lifecycle did not persist a real canonical provider state for ${provider.service}/${provider.model}. Re-run the tts command to create a new branch.`)
  })
}

const resolveStoredTtsResumeInput = async (
  rootDir: string,
  storedItem?: PipelineManifestItem
): Promise<string> => {
  const item = storedItem ?? (await readManifest(rootDir))?.items[0]
  if (!item || typeof item.input !== 'string' || item.input.trim().length === 0) {
    throw UsageError('TTS resume is missing its canonical source path. Rebuild this output with the current tts command.')
  }
  const sourcePath = resolveUserPath(item.input)
  let sourceExists = false
  let source: ReturnType<typeof Bun.file>
  try {
    source = Bun.file(sourcePath)
    sourceExists = await source.exists()
  } catch {
    sourceExists = false
  }
  if (!sourceExists) {
    throw UsageError(`Stored TTS source file is missing: ${item.input}. Restore the exact source bytes or rebuild this output with the current tts command.`)
  }
  source = Bun.file(sourcePath)
  const text = new TextDecoder().decode(new Uint8Array(await source.arrayBuffer()))
  if (!text.trim()) {
    throw UsageError(`Stored TTS source file is empty: ${item.input}. Restore the exact source bytes or rebuild this output with the current tts command.`)
  }
  return text
}
export const resolveStoredTtsTargetsForResume = async (
  providers: GenerationResumeProviderIdentity[],
  opts: TtsOptions,
  target: ResumeTarget,
  item: PipelineManifestItem,
  protectedStore?: ProtectedVoiceAssetStore
): Promise<TtsTarget[]> => {
  const retired = providers.find(provider => ['groq', 'gemini', 'deepgram', 'replicate', 'fal'].includes(provider.service))
  if (retired) throw UsageError(`Stored TTS provider ${retired.service} is no longer supported for TTS and cannot be resumed or dispatched. Inspect the manifest as history, then select a supported provider for a new TTS run.`)
  const ordinaryProviders = providers.filter((provider) => provider.service !== 'mistral')
  const resolved = collectGenerationTargetsForProviders(
    ordinaryProviders,
    opts,
    TTS_MODEL_FIELDS,
    collectTtsTargets
  )
  const mistralProviders = providers.filter((provider) => provider.service === 'mistral')
  if (mistralProviders.length === 0) return resolved
  const input = await resolveStoredTtsResumeInput(target.dir, item)
  resolved.push(...await resolveStoredMistralTtsTargetsForResume(
    mistralProviders,
    opts,
    target,
    item,
    input,
    protectedStore
  ))
  return resolved
}


const resolveTtsResumeArtifactRoot = (
  states: readonly PipelineProviderState[]
): string | undefined => {
  for (const state of states) {
    const match = /^(items\/[^/]+\/providers)(?:\/|$)/.exec(state.artifactDir)
    if (match?.[1]) return match[1]
  }
  return undefined
}

const createTtsBatchResumeReportedOutputResolver = (
  outputDir: string,
  artifactRoot: string,
  targets: readonly TtsTarget[]
): ((target: TtsTarget, defaultFileName: string) => { path: string, fileName: string }) => {
  const itemStem = artifactRoot.split('/')[1]
  if (!itemStem) {
    throw UsageError('TTS batch resume could not recover the canonical item stem from retained artifact paths.')
  }
  return (target, defaultFileName) => {
    const providerArtifact = defaultFileName || getTtsArtifactFileName(target, targets.length === 1)
    const extension = extname(providerArtifact) || '.wav'
    const fileName = targets.length === 1
      ? `${itemStem}${extension}`
      : providerArtifact.startsWith('speech')
        ? `${itemStem}${providerArtifact.slice('speech'.length)}`
        : `${itemStem}-${target.service}-${target.model}${extension}`
    return { path: join(outputDir, fileName), fileName }
  }
}

const createTtsResumeReportedOutputResolver = (
  outputDir: string,
  currentProviders: readonly PipelineProviderState[]
): ((target: TtsTarget, defaultFileName: string) => { path: string, fileName: string }) => {
  const reserved = new Set<string>()
  const attemptsByTarget = new Map(currentProviders.flatMap((provider) =>
    provider.targetKey ? [[provider.targetKey, provider.attempts + 1] as const] : []
  ))
  return (target, defaultFileName) => {
    if (!target.targetKey) throw UsageError(`TTS resume target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
    const extension = extname(defaultFileName) || '.wav'
    const stem = basename(defaultFileName, extname(defaultFileName)) || 'speech'
    const targetToken = target.targetKey.replace(/[^A-Za-z0-9_-]/g, '-').slice(-48)
    const attempt = attemptsByTarget.get(target.targetKey) ?? 1
    for (let collision = 0; ; collision += 1) {
      const suffix = collision === 0 ? '' : `-${collision + 1}`
      const fileName = `${stem}-resume-${targetToken}-attempt-${attempt}${suffix}${extension}`
      const path = join(outputDir, fileName)
      if (!reserved.has(path) && !existsSync(path)) {
        reserved.add(path)
        return { path, fileName }
      }
    }
  }
}

const resolveExactTtsResumeSourceContext = async (
  targets: readonly TtsTarget[],
  input: string,
  opts: TtsOptions,
  context: GenerationResumeRunContext<TtsTarget, Step4Metadata, TtsOptions>
) => {
  const canonicalProviderStates = context.currentProviderStates.filter((provider) =>
    provider.operation === 'tts-synthesis'
    && provider.status !== 'skipped'
  )
  if (canonicalProviderStates.length === 0) {
    throw UsageError('TTS resume has no retained active source/dialogue evidence and cannot authorize synthesis. Rebuild this output with the current tts command.')
  }
  const sourceContext = await resolveTtsResumeSourceContext(
    context.outputDir,
    input,
    context.currentProviderStates,
    new Set(targets.flatMap((target) => target.targetKey ? [target.targetKey] : []))
  )
  const currentByTargetKey = new Map(context.currentProviderStates.flatMap((provider) =>
    provider.targetKey ? [[provider.targetKey, provider] as const] : []
  ))
  for (const target of targets) {
    if (!target.targetKey) {
      throw UsageError(`TTS resume target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
    }
    const current = currentByTargetKey.get(target.targetKey)
    if (!current) continue
    const retained = sourceContext.retainedPlanIdentities.get(target.targetKey)
    if (!retained) {
      throw UsageError(`Stored TTS target ${target.service}/${target.model} has no exact active branch or render plan. Re-run the tts command to create an explicit new branch.`)
    }
    const planned = planCurrentTtsRenderIdentity({
      target,
      sourceText: input,
      ttsOptions: opts,
      sourceIdentity: sourceContext.sourceIdentity,
      dialoguePlan: sourceContext.dialoguePlan
    })
    const matchesRetainedPlan = retained.kind === 'branch'
      ? planned.branchPlanId === retained.branchPlanId
      : planned.renderPlanId === retained.renderPlanId && planned.renderIdentity === retained.renderIdentity
    if (!matchesRetainedPlan && (current.status !== 'failed' || target.allowFailedImplicitDefaultReplan !== true)) {
      throw UsageError(
        `Current TTS voice, cast, synthesis controls, or output plan differs from the retained active branch or render for ${target.service}/${target.model}. Re-run the tts command to create an explicit new branch; resume will not silently rebind or repurchase it.`
      )
    }
    if (!matchesRetainedPlan) {
      const replacement = await planCurrentTtsResumePrice({
        rootDir: context.outputDir,
        state: current,
        target,
        sourceText: input,
        ttsOptions: opts,
        sourceIdentity: sourceContext.sourceIdentity,
        dialoguePlan: sourceContext.dialoguePlan
      })
      if (replacement.reconciliationBlockers.length > 0) {
        throw UsageError(
          `Stored TTS target ${target.service}/${target.model} has ambiguous admitted work and cannot replace its failed implicit-default plan without explicit ambiguous-redispatch authorization.`
        )
      }
    }
  }
  return { sourceContext, currentByTargetKey }
}

const assertProtectedRecoveryOnlyTargetsAreComplete = async (
  targets: readonly TtsTarget[],
  input: string,
  opts: TtsOptions,
  outputDir: string,
  sourceContext: Awaited<ReturnType<typeof resolveTtsResumeSourceContext>>,
  currentByTargetKey: ReadonlyMap<string, PipelineProviderState>
): Promise<void> => {
  for (const target of targets) {
    if (!protectedRecoveryOnlyTargets.has(target)) continue
    const state = target.targetKey ? currentByTargetKey.get(target.targetKey) : undefined
    if (!state) throw UsageError('Stored protected Mistral recovery target has no canonical provider state.')
    let recovery
    try {
      recovery = await prepareCurrentTtsCompletedRecovery({
        rootDir: outputDir,
        state,
        target,
        sourceText: input,
        ttsOptions: opts,
        sourceIdentity: sourceContext.sourceIdentity,
        dialoguePlan: sourceContext.dialoguePlan
      })
    } catch {
      throw UsageError(
        'Interrupted protected Mistral reference synthesis cannot be safely redispatched by resume. Re-run standalone `tts` with the explicitly authorized reference to create a new branch; no provider request was made.'
      )
    }
    if (!recovery || recovery.kind !== 'complete-render') {
      throw UsageError(
        'Protected Mistral reference synthesis has no complete retained result eligible for zero-call recovery. Re-run standalone `tts` with the explicitly authorized reference to create a new branch; resume will not repurchase it.'
      )
    }
  }
}

export const ttsResumeConfig = {
  kind: 'tts' as const,
  metadataKey: 'tts',
  stepLabel: 'TTS',
  providerFlags: TTS_PROVIDER_FLAGS,
  selectionMode: 'additive-stored' as const,
  modelFields: TTS_MODEL_FIELDS,
  getProviderKey: getTtsResumeProviderKey,
  resolveInput: async (target, _metadata, item) => await resolveStoredTtsResumeInput(target.dir, item),
  getInitialCompletedProviderKeys: (item: PipelineManifestItem) =>
    item.providers.flatMap((provider) =>
      (provider.status === 'succeeded' || provider.status === 'skipped') && provider.targetKey
        ? [provider.targetKey]
        : []
    ),
  getSuccessKey: (entry: Step4Metadata) => {
    if (!entry.targetKey) {
      throw UsageError(`Resumed TTS metadata for ${entry.ttsService}/${entry.ttsModel} is missing its operation-scoped targetKey.`)
    }
    return entry.targetKey
  },
  collectTargets: (opts: TtsOptions) => collectTtsTargets(opts),
  resolveStoredTargets: async (providers, opts, target, item) =>
    await resolveStoredTtsTargetsForResume(providers, opts, target, item),
  runMissingTargets: async (
    targets: TtsTarget[],
    input: string,
    outputDir: string,
    opts: TtsOptions,
    context: GenerationResumeRunContext<TtsTarget, Step4Metadata, TtsOptions>
  ) => {
    const { sourceContext, currentByTargetKey } = await resolveExactTtsResumeSourceContext(targets, input, opts, context)
    if (!sourceContext.dialoguePlan) {
      throw UsageError('TTS resume source context is missing its canonical dialogue plan.')
    }
    const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(outputDir, sourceContext.dialoguePlan)
    await assertProtectedRecoveryOnlyTargetsAreComplete(
      targets,
      input,
      opts,
      outputDir,
      sourceContext,
      currentByTargetKey
    )
    const providerOrder = [
      ...context.currentProviderStates.flatMap((provider) => provider.targetKey ? [provider.targetKey] : []),
      ...targets.flatMap((target) =>
        target.targetKey && !context.currentProviderStates.some((provider) => provider.targetKey === target.targetKey)
          ? [target.targetKey]
          : []
      )
    ]
    const itemIndex = context.itemIndex ?? 0
    const artifactRoot = resolveTtsResumeArtifactRoot(context.currentProviderStates)
    const manifestUpdater = context.manifestUpdater
      ?? (async (update) => await updateManifest(outputDir, update))
    const publishedJournalAttempts = new Set<string>()
    const workspaceDir = await mkdtemp(join(
      outputDir,
      `.tts-resume-${String(itemIndex + 1).padStart(3, '0')}-`
    ))
    return await runTtsTargets(targets, input, workspaceDir, opts, {
      sourceIdentity: sourceContext.sourceIdentity,
      dialoguePlan: sourceContext.dialoguePlan,
      retainedProviderStates: context.currentProviderStates,
      recoveryRootDir: outputDir,
      artifactOutputDir: outputDir,
      ...(artifactRoot ? { artifactRoot } : {}),
      resolveReportedOutput: artifactRoot
        ? createTtsBatchResumeReportedOutputResolver(outputDir, artifactRoot, targets)
        : createTtsResumeReportedOutputResolver(outputDir, context.currentProviderStates),
      beforeDispatch: async (states) => await commitTtsResumePreparedStates(
        outputDir,
        states.map((state) => bindTtsDialoguePlanArtifact(state, dialoguePlanArtifact)),
        providerOrder,
        itemIndex,
        manifestUpdater
      ),
      onProviderState: async (state) => {
        const boundState = bindTtsDialoguePlanArtifact(state, dialoguePlanArtifact)
        if (boundState.status === 'running') {
          const journalAttemptKey = getCurrentTtsJournalAttemptKey(boundState)
          if (!journalAttemptKey || publishedJournalAttempts.has(journalAttemptKey)) return
          await commitTtsResumeProviderState(
            outputDir,
            boundState,
            providerOrder,
            itemIndex,
            manifestUpdater
          )
          publishedJournalAttempts.add(journalAttemptKey)
          return
        }
        await commitTtsResumeProviderState(
          outputDir,
          boundState,
          providerOrder,
          itemIndex,
          manifestUpdater
        )
      }
    })
  },
  buildEstimates: async (
    opts: TtsOptions,
    input: string,
    context: GenerationResumeRunContext<TtsTarget, Step4Metadata, TtsOptions>
  ) => {
    const runtimeOptions = context.runtimeOptions
    const { sourceContext, currentByTargetKey } = await resolveExactTtsResumeSourceContext(
      context.targets,
      input,
      runtimeOptions,
      context
    )
    const remaining: Array<{ target: TtsTarget, characterCount: number }> = []
    for (const target of context.targets) {
      if (!target.targetKey) throw UsageError(`TTS resume target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
      const current = currentByTargetKey.get(target.targetKey)
      if (!current) {
        remaining.push({ target, characterCount: input.length })
        continue
      }
      if (sourceContext.retainedPlanIdentities.get(target.targetKey)?.kind === 'branch') {
        if (protectedRecoveryOnlyTargets.has(target)) {
          throw UsageError('Price cannot authorize interrupted protected Mistral reference redispatch. Re-run standalone `tts` with the explicitly authorized reference to create a new branch.')
        }
        remaining.push({ target, characterCount: input.length })
        continue
      }
      const retained = sourceContext.retainedPlanIdentities.get(target.targetKey)
      const planned = planCurrentTtsRenderIdentity({
        target,
        sourceText: input,
        ttsOptions: runtimeOptions,
        sourceIdentity: sourceContext.sourceIdentity,
        dialoguePlan: sourceContext.dialoguePlan
      })
      const retainedMatchesPlanned = retained?.kind === 'render'
        && retained.renderPlanId === planned.renderPlanId
        && retained.renderIdentity === planned.renderIdentity
      if (!retainedMatchesPlanned && current.status === 'failed' && target.allowFailedImplicitDefaultReplan === true) {
        remaining.push({ target, characterCount: input.length })
        continue
      }
      const price = await planCurrentTtsResumePrice({
        rootDir: context.outputDir,
        state: current,
        target,
        sourceText: input,
        ttsOptions: runtimeOptions,
        sourceIdentity: sourceContext.sourceIdentity,
        dialoguePlan: sourceContext.dialoguePlan
      })
      if (protectedRecoveryOnlyTargets.has(target) && price.recoveryKind !== 'complete-render') {
        throw UsageError('Price cannot authorize protected Mistral reference redispatch without one complete retained result. Re-run standalone `tts` with the explicitly authorized reference to create a new branch.')
      }
      if (price.reconciliationBlockers.length > 0 && runtimeOptions.ttsAllowAmbiguousRedispatch !== true) {
        const blocker = price.reconciliationBlockers[0]
        if (!blocker) throw UsageError('Stored TTS generation slot has ambiguous provider work; automatic redispatch is blocked pending reconciliation.')
        throw UsageError(
          `Stored TTS generation slot ${blocker.generationSlotId} has ${blocker.state} provider work in attempt ${blocker.attempt}, request ${blocker.requestOrdinal}; automatic redispatch is blocked pending reconciliation. Pass --allow-ambiguous-redispatch to safely reconcile the pending slot, reuse all completed segment audio, and resume synthesis without deleting output directories or losing work.`
        )
      }
      if (price.unresolvedSlotCount === 0) continue
      remaining.push({ target, characterCount: price.unresolvedCharacterCount })
    }
    const estimates = []
    for (const entry of remaining) {
      estimates.push(...await buildTtsTargetEstimates([entry.target], opts, entry.characterCount))
    }
    return estimates
  },
  reconcileProviderStates: reconcileTtsResumeProviderStates,
  priceAggregateOptions: (input: string) => ({
    ttsTimingCharacterCount: input.length,
    ttsInputText: input
  }),
  rebuildRunMetadata: (
    metadata: Step4Metadata[],
    currentManifestMetadata: Record<string, unknown>,
    input: string
  ) => buildUpdatedGenerationCostTiming(
    currentManifestMetadata,
    computeActualCosts({ step4: metadata, ttsCharacterCount: input.length }),
    computeActualProcessingTimes({ step4: metadata, ttsCharacterCount: input.length })
  )
} satisfies GenerationResumeConfig<TtsTarget, Step4Metadata, TtsOptions>
