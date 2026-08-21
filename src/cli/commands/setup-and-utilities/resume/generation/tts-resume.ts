import { buildUpdatedGenerationCostTiming, clearProviderModelFields, collectGenerationTargetsForProviders } from '../generation-resume'
import { readManifest, updateManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { collectTtsTargets, getTtsArtifactFileName } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { runTtsTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { deriveGenerationResumeModelFields, deriveGenerationResumeProviderFlags, TTS_GENERATION_SELECTION } from '~/cli/flags/service-selector-normalization/provider-targets'
import { appendCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { planCurrentTtsRenderIdentity, planCurrentTtsResumePrice, prepareCurrentTtsCompletedRecovery } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { bindTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'
import { buildTtsTargetEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/tts-estimates'
import { CLIUsageError } from '~/utils/error-handler'
import { readRetainedTtsResolvedVoices, resolveTtsResumeSourceContext } from './tts-resume-source-context'
import type { GenerationResumeConfig, GenerationResumeProviderIdentity, GenerationResumeRunContext, PipelineManifestItem, PipelineProviderState, ProtectedAssetRef, ProtectedVoiceAssetStore, ProviderVoiceRef, ResumeTarget, Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { resolveUserPath } from '~/utils/runtime-paths'
import { validateProviderVoiceRef } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import { createProtectedVoiceAssetStore } from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'
import {
  MISTRAL_REQUEST_REFERENCE_STORE_ID,
  MISTRAL_REQUEST_REFERENCE_STORE_ROOT
} from '~/cli/commands/process-steps/step-4-tts/voice-assets/standalone-mistral-reference'
import {
  attachMistralProtectedReference,
  attachMistralProtectedSpeakerReferences,
  promoteMistralProtectedSpeakerReferences
} from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-protected-reference-binding'
import { MISTRAL_CLI_REFERENCE_AUTHORIZATION } from '~/cli/commands/process-steps/step-4-tts/voice-assets/mistral-request-reference-policy'
import { normalizeDialogueSpeakerKey } from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import { materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'

const TTS_PROVIDER_FLAGS = deriveGenerationResumeProviderFlags(
  TTS_GENERATION_SELECTION,
  'all-tts'
)

const TTS_MODEL_FIELDS = deriveGenerationResumeModelFields(TTS_GENERATION_SELECTION)

const defaultResumeProtectedStore = createProtectedVoiceAssetStore({
  storeId: MISTRAL_REQUEST_REFERENCE_STORE_ID,
  root: MISTRAL_REQUEST_REFERENCE_STORE_ROOT
})

const protectedRecoveryOnlyTargets = new WeakSet<TtsTarget>()

const getTtsResumeProviderKey = (
  provider: GenerationResumeProviderIdentity
): string => {
  if (!provider.targetKey) {
    throw CLIUsageError(`TTS resume target ${provider.service}/${provider.model} is missing its operation-scoped targetKey.`)
  }
  return provider.targetKey
}

const reduceTtsResumeItemStatus = (
  providers: PipelineProviderState[]
): PipelineManifestItem['status'] => {
  if (providers.length === 0) {
    throw CLIUsageError('A resumed TTS item must retain at least one operation-scoped provider state.')
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
  itemIndex = 0
): Promise<void> => {
  await commitTtsResumePreparedStates(rootDir, [incoming], providerOrder, itemIndex)
}

const commitTtsResumePreparedStates = async (
  rootDir: string,
  incomingStates: readonly PipelineProviderState[],
  providerOrder: readonly string[],
  itemIndex = 0
): Promise<void> => {
  if (incomingStates.length === 0) throw CLIUsageError('TTS resume lifecycle produced no prepared provider states.')
  for (const incoming of incomingStates) {
    if (
      incoming.operation !== 'tts-synthesis'
      || !incoming.targetKey
      || !incoming.transport
      || typeof incoming.model !== 'string'
    ) {
      throw CLIUsageError('TTS resume lifecycle produced a provider state without complete operation-scoped identity.')
    }
  }
  const orderByTargetKey = new Map(providerOrder.map((targetKey, index) => [targetKey, index] as const))
  await updateManifest(rootDir, (manifest) => {
    if (manifest.command !== 'tts' || (manifest.scope !== 'single' && manifest.scope !== 'batch')) {
      throw CLIUsageError('TTS resume lifecycle can update only a canonical TTS manifest.')
    }
    if (manifest.scope === 'single' && (manifest.items.length !== 1 || itemIndex !== 0)) {
      throw CLIUsageError('TTS resume lifecycle can update only one canonical single-run TTS manifest.')
    }
    const item = manifest.items[itemIndex] as PipelineManifestItem | undefined
    if (!item) {
      throw CLIUsageError('TTS resume lifecycle received an out-of-range batch item.')
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
    throw CLIUsageError(`TTS lifecycle did not persist a real canonical provider state for ${provider.service}/${provider.model}. Re-run the tts command to create a new branch.`)
  })
}

const resolveStoredTtsResumeInput = async (
  rootDir: string,
  storedItem?: PipelineManifestItem
): Promise<string> => {
  const item = storedItem ?? (await readManifest(rootDir))?.items[0]
  if (!item || typeof item.input !== 'string' || item.input.trim().length === 0) {
    throw CLIUsageError('TTS resume is missing its canonical source path. Rebuild this output with the current tts command.')
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
    throw CLIUsageError(`Stored TTS source file is missing: ${item.input}. Restore the exact source bytes or rebuild this output with the current tts command.`)
  }
  source = Bun.file(sourcePath)
  const text = new TextDecoder().decode(new Uint8Array(await source.arrayBuffer()))
  if (!text.trim()) {
    throw CLIUsageError(`Stored TTS source file is empty: ${item.input}. Restore the exact source bytes or rebuild this output with the current tts command.`)
  }
  return text
}

const sameProtectedAsset = (left: ProtectedAssetRef, right: ProtectedAssetRef): boolean =>
  left.storeId === right.storeId
  && left.assetId === right.assetId
  && left.sha256 === right.sha256

const protectedReferenceVoice = (voice: ProviderVoiceRef): Extract<ProviderVoiceRef, { kind: 'reference-asset' }> | undefined => {
  const validated = validateProviderVoiceRef(voice)
  if (validated.provider !== 'mistral') {
    throw CLIUsageError('Stored Mistral resume voice evidence names a different provider. Rebuild this output before resuming it.')
  }
  if (validated.kind !== 'reference-asset') return undefined
  if (
    validated.origin !== 'request-reference-audio'
    || validated.authorizationRef !== MISTRAL_CLI_REFERENCE_AUTHORIZATION
  ) {
    throw CLIUsageError('Stored Mistral reference voice evidence lacks the exact request authorization. Rebuild this output before resuming it.')
  }
  return validated
}

const matchesRetainedPlan = (
  retained:
    | { kind: 'branch', branchPlanId: string }
    | { kind: 'render', renderPlanId: string, renderIdentity: string }
    | undefined,
  planned: ReturnType<typeof planCurrentTtsRenderIdentity>
): boolean => retained?.kind === 'branch'
  ? retained.branchPlanId === planned.branchPlanId
  : retained?.kind === 'render'
    ? retained.renderPlanId === planned.renderPlanId && retained.renderIdentity === planned.renderIdentity
    : false

const materializedSpeakerBinding = (
  entries: Array<{ speakerKey: string, protectedAsset: ProtectedAssetRef }>,
  store: ProtectedVoiceAssetStore
) => ({
  materialization: 'materialized' as const,
  entries: entries.map((entry) => ({
    ...entry,
    sourceExtension: '',
    resolve: async () => await store.resolve(entry.protectedAsset)
  }))
})

export const resolveStoredTtsTargetsForResume = async (
  providers: GenerationResumeProviderIdentity[],
  opts: TtsOptions,
  target: ResumeTarget,
  item: PipelineManifestItem,
  protectedStore: ProtectedVoiceAssetStore = defaultResumeProtectedStore
): Promise<TtsTarget[]> => {
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
  const targetKeys = new Set(mistralProviders.flatMap((provider) => provider.targetKey ? [provider.targetKey] : []))
  const sourceContext = await resolveTtsResumeSourceContext(target.dir, input, item.providers, targetKeys)
  if (!sourceContext.dialoguePlan) throw CLIUsageError('Stored generic TTS resume source is missing its dialogue plan.')
  const turns = sourceContext.dialoguePlan.nodes.flatMap((node) => node.kind === 'turn' ? [node.turn] : node.turns)

  for (const provider of mistralProviders) {
    if (!provider.targetKey) throw CLIUsageError(`Stored Mistral TTS target ${provider.model} is missing its operation-scoped target identity.`)
    const state = item.providers.find((entry) => entry.targetKey === provider.targetKey)
    if (!state) throw CLIUsageError(`Stored Mistral TTS target ${provider.model} has no canonical provider state.`)
    const voices = await readRetainedTtsResolvedVoices(target.dir, state)
    const references = voices.flatMap((voice) => {
      const reference = protectedReferenceVoice(voice)
      return reference ? [reference] : []
    })
    if (references.length === 0) {
      resolved.push(...collectGenerationTargetsForProviders([provider], opts, TTS_MODEL_FIELDS, collectTtsTargets))
      continue
    }
    const uniqueAssets = references
      .map((entry) => entry.protectedAsset)
      .filter((asset, index, assets) => assets.findIndex((candidate) => sameProtectedAsset(candidate, asset)) === index)
    for (const asset of uniqueAssets) {
      try {
        await protectedStore.resolve(asset)
      } catch {
        throw CLIUsageError(
          `Stored protected Mistral reference ${asset.assetId} is missing or fails its content checksum. Restore the exact owner-only protected asset before recovery; interrupted reference synthesis cannot be redispatched by resume.`
        )
      }
    }

    const retained = sourceContext.retainedPlanIdentities.get(provider.targetKey)
    const baseOptions = clearProviderModelFields({ ...opts }, TTS_MODEL_FIELDS) as TtsOptions
    baseOptions.mistralTtsModels = [provider.model]
    baseOptions.mistralTtsModel = provider.model
    baseOptions.mistralTtsVoice = undefined
    const candidates: Array<{ options: TtsOptions, target: TtsTarget, speakerMappings?: string[] | undefined }> = []

    if (uniqueAssets.length === 1 && references.length === voices.length) {
      const asset = uniqueAssets[0] as ProtectedAssetRef
      const standaloneOptions = { ...baseOptions, ttsSpeakers: undefined }
      attachMistralProtectedReference(standaloneOptions, {
        materialization: 'materialized',
        protectedAsset: asset,
        sourceExtension: '',
        resolve: async () => await protectedStore.resolve(asset)
      })
      for (const candidate of collectTtsTargets(standaloneOptions).filter((entry) => entry.targetKey === provider.targetKey)) {
        candidates.push({ options: standaloneOptions, target: candidate })
      }
    }

    const findExactCandidate = () => candidates.find((candidate) => {
      try {
        return matchesRetainedPlan(retained, planCurrentTtsRenderIdentity({
          target: candidate.target,
          sourceText: input,
          ttsOptions: candidate.options,
          sourceIdentity: sourceContext.sourceIdentity,
          dialoguePlan: sourceContext.dialoguePlan
        }))
      } catch {
        return false
      }
    })
    let exact = findExactCandidate()

    if (!exact && voices.length === turns.length) {
      const speakerVoice = new Map<string, { mapping: string, protectedAsset?: ProtectedAssetRef | undefined }>()
      for (const [index, voice] of voices.entries()) {
        const turn = turns[index]
        if (!turn) throw CLIUsageError('Stored Mistral voice evidence does not align with the item dialogue turns.')
        const speakerKey = normalizeDialogueSpeakerKey(turn.originalSpeakerLabel)
        const reference = protectedReferenceVoice(voice)
        const mapping = reference
          ? `${turn.originalSpeakerLabel}=ref_audio:${reference.protectedAsset.assetId}`
          : voice.kind === 'remote-resource'
            ? `${turn.originalSpeakerLabel}=${voice.resourceId}`
            : undefined
        if (!mapping) throw CLIUsageError('Stored Mistral dialogue voice kind cannot be reconstructed safely for resume.')
        const prior = speakerVoice.get(speakerKey)
        if (prior && prior.mapping.split('=').slice(1).join('=') !== mapping.split('=').slice(1).join('=')) {
          throw CLIUsageError(`Stored Mistral speaker ${turn.originalSpeakerLabel} has conflicting retained voices.`)
        }
        speakerVoice.set(speakerKey, { mapping, ...(reference ? { protectedAsset: reference.protectedAsset } : {}) })
      }
      const speakerMappings = [...speakerVoice.values()].map((entry) => entry.mapping)
      const protectedEntries = [...speakerVoice.entries()].flatMap(([speakerKey, entry]) =>
        entry.protectedAsset ? [{ speakerKey, protectedAsset: entry.protectedAsset }] : []
      )
      if (protectedEntries.length > 0) {
        for (const ttsDialogueFormat of ['labeled', 'screenplay'] as const) {
          const speakerOptions = { ...baseOptions, ttsSpeakers: speakerMappings, ttsDialogueFormat }
          attachMistralProtectedSpeakerReferences(speakerOptions, {
            materialization: 'non-materialized',
            entries: protectedEntries.map((entry) => ({ ...entry, sourceExtension: '' }))
          })
          promoteMistralProtectedSpeakerReferences(speakerOptions, materializedSpeakerBinding(protectedEntries, protectedStore))
          try {
            for (const candidate of collectTtsTargets(speakerOptions).filter((entry) => entry.targetKey === provider.targetKey)) {
              candidates.push({ options: speakerOptions, target: candidate, speakerMappings })
            }
          } catch {
            // The alternative dialogue grammar is tested below against the exact retained plan.
          }
        }
      }
      exact = findExactCandidate()
    }

    if (!exact) {
      throw CLIUsageError('Stored protected Mistral voice bindings cannot reconstruct the exact retained branch/render semantics. Rebuild this output with standalone `tts`; resume will not rebind or repurchase reference synthesis.')
    }
    if (exact.speakerMappings) {
      opts.ttsSpeakers = exact.speakerMappings
      opts.ttsDialogueFormat = exact.options.ttsDialogueFormat
    }
    protectedRecoveryOnlyTargets.add(exact.target)
    resolved.push(exact.target)
  }
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
    throw CLIUsageError('TTS batch resume could not recover the canonical item stem from retained artifact paths.')
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
    if (!target.targetKey) throw CLIUsageError(`TTS resume target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
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
    throw CLIUsageError('TTS resume has no retained active source/dialogue evidence and cannot authorize synthesis. Rebuild this output with the current tts command.')
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
      throw CLIUsageError(`TTS resume target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
    }
    const current = currentByTargetKey.get(target.targetKey)
    if (!current) continue
    const retained = sourceContext.retainedPlanIdentities.get(target.targetKey)
    if (!retained) {
      throw CLIUsageError(`Stored TTS target ${target.service}/${target.model} has no exact active branch or render plan. Re-run the tts command to create an explicit new branch.`)
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
      throw CLIUsageError(
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
        throw CLIUsageError(
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
    if (!state) throw CLIUsageError('Stored protected Mistral recovery target has no canonical provider state.')
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
      throw CLIUsageError(
        'Interrupted protected Mistral reference synthesis cannot be safely redispatched by resume. Re-run standalone `tts` with the explicitly authorized reference to create a new branch; no provider request was made.'
      )
    }
    if (!recovery || recovery.kind !== 'complete-render') {
      throw CLIUsageError(
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
      throw CLIUsageError(`Resumed TTS metadata for ${entry.ttsService}/${entry.ttsModel} is missing its operation-scoped targetKey.`)
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
      throw CLIUsageError('TTS resume source context is missing its canonical dialogue plan.')
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
    return await runTtsTargets(targets, input, outputDir, opts, {
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
        itemIndex
      ),
      onProviderState: async (state) => await commitTtsResumeProviderState(
        outputDir,
        bindTtsDialoguePlanArtifact(state, dialoguePlanArtifact),
        providerOrder,
        itemIndex
      )
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
      if (!target.targetKey) throw CLIUsageError(`TTS resume target ${target.service}/${target.model} is missing its operation-scoped targetKey.`)
      const current = currentByTargetKey.get(target.targetKey)
      if (!current) {
        remaining.push({ target, characterCount: input.length })
        continue
      }
      if (sourceContext.retainedPlanIdentities.get(target.targetKey)?.kind === 'branch') {
        if (protectedRecoveryOnlyTargets.has(target)) {
          throw CLIUsageError('Price cannot authorize interrupted protected Mistral reference redispatch. Re-run standalone `tts` with the explicitly authorized reference to create a new branch.')
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
        throw CLIUsageError('Price cannot authorize protected Mistral reference redispatch without one complete retained result. Re-run standalone `tts` with the explicitly authorized reference to create a new branch.')
      }
      if (price.reconciliationBlockers.length > 0 && runtimeOptions.ttsAllowAmbiguousRedispatch !== true) {
        const blocker = price.reconciliationBlockers[0]
        if (!blocker) throw CLIUsageError('Stored TTS generation slot has ambiguous provider work; automatic redispatch is blocked pending reconciliation.')
        throw CLIUsageError(
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
