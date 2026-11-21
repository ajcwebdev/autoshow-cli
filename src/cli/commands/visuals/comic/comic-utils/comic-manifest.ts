import type {
  CanonicalComicItemMetadata,
  ComicPresentationPlan,
  ComicSelectionPresentationSnapshot,
  ComicSourceIdentity,
  ComicStageArtifactRef,
  PipelineManifest,
  PipelineManifestItem,
  PipelineProviderState,
  Step4Metadata,
  StructuredScriptArtifactRef,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import { isRecord } from '~/utils/value-helpers'
import { readComicImageUsageCheckpoint } from './comic-image-usage-checkpoint'
import {
  createManifest,
  readManifest,
  updateManifest,
  writeManifest,
} from '../../../command-shared/pipeline-manifest'
import { canonicalTtsJson, hashCanonicalTtsValue } from '../../../audio/tts/script-to-audio/contract-identity'
import { readContainedArtifactFile } from '../../../audio/tts/script-to-audio/safe-artifact-store'
import { computeSceneRunIdentity } from './comic-audio-contracts'
import { appendCurrentTtsProviderState } from '../../../audio/tts/script-to-audio/current-render-artifacts'
import { aggregateComicStageStatus } from '../../../command-shared/pipeline-manifest/comic-stage-status'
import { validateComicPresentationPlan } from './comic-presentation-plan'

const notRequestedComicStage = () => ({
  requirement: 'not-requested' as const,
  status: 'skipped' as const,
  execution: { kind: 'none' as const, reason: 'not-requested' as const },
  targetKeys: [] as [],
  artifactRefs: [] as [],
})

const comicMetadata = (item: PipelineManifestItem): CanonicalComicItemMetadata => {
  const value = item.metadata['comic']
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw UsageError('Canonical comic item is missing its strict metadata.comic envelope.')
  return value as unknown as CanonicalComicItemMetadata
}

export const writeInitialComicStructureManifest = async (input: {
  sceneRunDir: string
  createdAt: string
  sourceIdentity: ComicSourceIdentity
  structuredScript: StructuredScriptArtifactRef
}): Promise<PipelineManifest> => {
  const sceneRunIdentity = computeSceneRunIdentity(input.sourceIdentity, input.structuredScript)
  const structureStage = {
    requirement: 'required' as const,
    status: 'full' as const,
    execution: { kind: 'local' as const, state: 'succeeded' as const },
    targetKeys: [] as [],
    artifactRefs: [{ path: input.structuredScript.path, sha256: input.structuredScript.sha256 }],
  }
  const metadata: CanonicalComicItemMetadata = {
    schemaVersion: 1,
    stages: {
      structure: structureStage,
      image: notRequestedComicStage(),
      audio: notRequestedComicStage(),
      presentation: notRequestedComicStage(),
    },
    audio: {
      sceneRunIdentity,
      structuredScript: input.structuredScript,
    },
    presentation: {},
  }
  const current = await readManifest(input.sceneRunDir, { verifyArtifacts: false })
  if (current) {
    if (current.command !== 'comic' || current.scope !== 'single' || current.items.length !== 1 || canonicalTtsJson(current.source) !== canonicalTtsJson(input.sourceIdentity)) {
      throw UsageError('Existing scene output does not belong to the exact canonical comic source; use a new run directory.')
    }
    return await updateManifest(input.sceneRunDir, (manifest) => {
      const item = manifest.items[0]
      if (!item || item.input !== input.sourceIdentity.canonicalPath) throw UsageError('Canonical comic item source changed during structure generation.')
      const prior = comicMetadata(item)
      const stages = { ...prior.stages, structure: structureStage }
      const required = Object.values(stages).filter(stage => stage.requirement === 'required')
      const status = aggregateComicStageStatus(required)
      const items = [{
        ...item,
        status,
        metadata: {
          ...item.metadata,
          comic: {
            ...prior,
            stages,
            audio: { ...prior.audio, sceneRunIdentity, structuredScript: input.structuredScript },
          },
        },
      }]
      return { ...manifest, items }
    })
  }
  const item: PipelineManifestItem = {
    input: input.sourceIdentity.canonicalPath,
    outputDir: '.',
    status: 'full',
    metadata: { comic: metadata } as never,
    providers: [],
  }
  const manifest = createManifest('comic', 'single', [item], input.sourceIdentity as never)
  return await writeManifest(input.sceneRunDir, { ...manifest, createdAt: input.createdAt, updatedAt: input.createdAt })
}

export const updateComicAudioManifest = async (input: {
  sceneRunDir: string
  sourceIdentity: ComicSourceIdentity
  stage: CanonicalComicItemMetadata['stages']['audio']
  audio: CanonicalComicItemMetadata['audio']
  providers?: PipelineProviderState[] | undefined
  ttsEvaluation?: Step4Metadata[] | undefined
  invalidatePresentation?: boolean | undefined
}): Promise<PipelineManifest> => await updateManifest(input.sceneRunDir, (manifest) => {
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) {
    throw UsageError('Comic audio can update only the exact compatible canonical scene manifest.')
  }
  const item = manifest.items[0]
  if (!item || item.input !== input.sourceIdentity.canonicalPath) throw UsageError('Canonical comic source changed during audio generation.')
  const prior = comicMetadata(item)
  const audioOperations = new Set(['comic-audio', 'sound-effect-generation'])
  if (input.providers?.some(provider => !provider.operation || !audioOperations.has(provider.operation))) throw UsageError('Comic audio stage updates may replace only comic-audio or sound-effect-generation provider states.')
  const providers = input.providers === undefined
    ? item.providers
    : (() => {
        const incomingByTarget = new Map(input.providers.map(provider => [provider.targetKey, provider] as const))
        const priorAudio = item.providers.filter(provider => provider.operation !== undefined && audioOperations.has(provider.operation))
        const mergedAudio = priorAudio.map(provider => {
          const incoming = incomingByTarget.get(provider.targetKey)
          if (!incoming) return provider
          incomingByTarget.delete(provider.targetKey)
          return provider.operation === 'comic-audio' ? appendCurrentTtsProviderState(provider, incoming) : incoming
        })
        return [
          ...item.providers.filter(provider => !provider.operation || !audioOperations.has(provider.operation)),
          ...mergedAudio,
          ...incomingByTarget.values(),
        ]
      })()
  const requiredStages = [prior.stages.structure, prior.stages.image, input.stage].filter(stage => stage.requirement === 'required')
  const status = aggregateComicStageStatus(requiredStages)
  const invalidatePresentation = input.invalidatePresentation === true && prior.stages.presentation.requirement !== 'not-requested'
  const presentationStage = invalidatePresentation
    ? { requirement: 'optional' as const, status: 'incomplete' as const, execution: { kind: 'local' as const, state: 'missing' as const }, targetKeys: [] as [], artifactRefs: [] }
    : prior.stages.presentation
  const nextItem: PipelineManifestItem = {
    ...item,
    status,
    providers,
    metadata: {
      ...item.metadata,
      ...(input.ttsEvaluation ? { tts: input.ttsEvaluation } : {}),
      comic: {
        ...prior,
        schemaVersion: 1,
        stages: { ...prior.stages, audio: input.stage, presentation: presentationStage },
        audio: input.audio,
        presentation: invalidatePresentation ? {} : prior.presentation,
      },
    } as never,
  }
  return { ...manifest, items: [nextItem] }
})

const providerBackedStageStatus = (
  targetKeys: readonly string[],
  providers: readonly PipelineProviderState[]
): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  const owned = targetKeys.map((targetKey) => providers.find(provider => provider.targetKey === targetKey))
  if (owned.some(provider => !provider)) return 'incomplete'
  const states = owned as PipelineProviderState[]
  if (states.every(provider => provider.status === 'skipped')) return 'skipped'
  if (states.some(provider => provider.status === 'succeeded') && states.every(provider => provider.status === 'succeeded' || provider.status === 'skipped')) return 'full'
  if (states.some(provider => provider.status === 'failed') && states.every(provider => provider.status === 'failed' || provider.status === 'skipped')) return 'failed'
  return 'incomplete'
}

export const appendComicAudioProviderState = async (input: {
  sceneRunDir: string
  sourceIdentity: ComicSourceIdentity
  targetKeys: readonly string[]
  state: PipelineProviderState
}): Promise<PipelineManifest> => await updateManifest(input.sceneRunDir, (manifest) => {
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) throw UsageError('Comic audio provider state can update only the exact canonical scene manifest.')
  const item = manifest.items[0]
  if (!item) throw UsageError('Canonical comic scene item is missing.')
  const prior = comicMetadata(item)
  if (input.state.operation !== 'comic-audio' && input.state.operation !== 'sound-effect-generation') throw UsageError('Comic audio provider state has an unsupported operation owner.')
  const providers = item.providers.slice()
  const index = providers.findIndex(provider => provider.targetKey === input.state.targetKey)
  if (index >= 0) providers[index] = input.state.operation === 'comic-audio' ? appendCurrentTtsProviderState(providers[index] as PipelineProviderState, input.state) : input.state
  else providers.push(input.state)
  const stage = {
    requirement: 'required' as const,
    status: providerBackedStageStatus(input.targetKeys, providers),
    execution: { kind: 'provider-targets' as const },
    targetKeys: [...input.targetKeys] as [string, ...string[]],
    artifactRefs: prior.stages.audio.artifactRefs,
  }
  const requiredStages = [prior.stages.structure, prior.stages.image, stage].filter(candidate => candidate.requirement === 'required')
  const status = aggregateComicStageStatus(requiredStages)
  return {
    ...manifest,
    items: [{
      ...item,
      status,
      providers,
      metadata: { ...item.metadata, comic: { ...prior, stages: { ...prior.stages, audio: stage } } } as never,
    }]
  }
})

/** Item metadata key holding comic-image provider states from earlier image runs (one entry per run and target). */
export const COMIC_IMAGE_RUN_HISTORY_KEY = 'comicImageRunHistory'

const providerRunId = (provider: PipelineProviderState): string | undefined => {
  const runId = provider.metadata['runId']
  return typeof runId === 'string' && runId.length > 0 ? runId : undefined
}

const sameImageRunTarget = (left: PipelineProviderState, right: PipelineProviderState): boolean =>
  left.targetKey === right.targetKey && providerRunId(left) === providerRunId(right)

const readImageRunHistory = (item: PipelineManifestItem): PipelineProviderState[] => {
  const raw = item.metadata[COMIC_IMAGE_RUN_HISTORY_KEY]
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw UsageError(`Canonical comic ${COMIC_IMAGE_RUN_HISTORY_KEY} must be an array.`)
  return raw.filter((entry): entry is PipelineProviderState => entry !== null && typeof entry === 'object' && !Array.isArray(entry)) as unknown as PipelineProviderState[]
}

/** Current and archived comic-image provider states, newest last. Historical multi-model runs keep one state per model. */
export const listComicImageProviderStates = (item: PipelineManifestItem): PipelineProviderState[] => [
  ...readImageRunHistory(item),
  ...item.providers.filter(provider => provider.operation === 'comic-image'),
]

const imageAttemptUsage = (state: PipelineProviderState) => ({
  status: state.status,
  imagesGenerated: state.metadata['imagesGenerated'] ?? 0,
  imagesSkipped: state.metadata['imagesSkipped'] ?? 0,
  usage: state.metadata['usage'] ?? {},
})

/** Usage and generated counts span the run. Status and skipped counts describe this invocation. */
const recordImageAttemptUsage = async (sceneRunDir: string, incoming: PipelineProviderState, previous: PipelineProviderState | undefined, attemptId: string): Promise<PipelineProviderState> => {
  const recorded = previous?.metadata['usageByAttempt']
  if (recorded !== undefined && !isRecord(recorded)) throw UsageError('Invalid comic image usage by attempt.')
  const attempts: Record<string, unknown> = { ...recorded }
  if (previous && recorded === undefined && previous.attempts > 0) attempts['previous'] = imageAttemptUsage(previous)
  attempts[attemptId] = imageAttemptUsage(incoming)
  let imagesGenerated = 0
  const usage = new Map<string, number>()
  for (const [id, attempt] of Object.entries(attempts)) {
    if (!isRecord(attempt) || typeof attempt['imagesGenerated'] !== 'number' || !isRecord(attempt['usage'])) throw UsageError('Invalid comic image attempt usage.')
    // A stopped process may have recorded returned usage and published panels before its terminal manifest write.
    const shouldRecover = id !== attemptId && attempt['status'] === 'running'
    const snapshot = shouldRecover ? await readComicImageUsageCheckpoint(sceneRunDir, incoming, id) : undefined
    const observed = snapshot && snapshot.imagesGenerated > attempt['imagesGenerated']
      ? snapshot
      : { imagesGenerated: attempt['imagesGenerated'], usage: attempt['usage'] }
    if (snapshot) attempts[id] = { ...attempt, ...observed }
    imagesGenerated += observed.imagesGenerated
    for (const [key, value] of Object.entries(observed.usage)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw UsageError(`Invalid comic image usage metric: ${key}.`)
      usage.set(key, (usage.get(key) ?? 0) + value)
    }
  }
  return {
    ...incoming,
    attempts: Object.keys(attempts).length,
    metadata: { ...incoming.metadata, attemptId, imagesGenerated, usage: Object.fromEntries(usage), usageByAttempt: attempts },
  }
}

export const updateComicImageManifest = async (input: {
  sceneRunDir: string
  sourceIdentity: ComicSourceIdentity
  providers: PipelineProviderState[]
  attemptId?: string
  artifactRefs?: ComicStageArtifactRef[] | ((retained: ComicStageArtifactRef[]) => Promise<ComicStageArtifactRef[]>)
}): Promise<PipelineManifest> => await updateManifest(input.sceneRunDir, async (manifest) => {
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) throw UsageError('Comic image generation can update only the exact canonical scene manifest.')
  const item = manifest.items[0]
  if (!item) throw UsageError('Canonical comic scene item is missing.')
  const prior = comicMetadata(item)
  const targetKeys = input.providers.map(provider => provider.targetKey as string)
  if (targetKeys.length === 0 || targetKeys.some(key => !key) || new Set(targetKeys).size !== targetKeys.length) throw UsageError('Comic image stage requires unique operation-scoped provider targets.')
  const replaced = item.providers.filter(provider => provider.operation === 'comic-image')
  const runHistory = readImageRunHistory(item)
  const known = [...runHistory, ...replaced]
  const archived = replaced.filter(provider => !input.providers.some(incoming => sameImageRunTarget(provider, incoming)))
  const history = [
    ...runHistory.filter(entry => !archived.some(provider => sameImageRunTarget(entry, provider)) && !input.providers.some(incoming => sameImageRunTarget(entry, incoming))),
    ...archived,
  ]
  const incoming = await Promise.all(input.providers.map(provider => input.attemptId
    ? recordImageAttemptUsage(input.sceneRunDir, provider, known.findLast(state => sameImageRunTarget(state, provider)), input.attemptId)
    : provider))
  const providers = [...item.providers.filter(provider => provider.operation !== 'comic-image'), ...incoming]
  const imageStage = {
    requirement: 'required' as const,
    status: providerBackedStageStatus(targetKeys, providers),
    execution: { kind: 'provider-targets' as const },
    targetKeys: targetKeys as [string, ...string[]],
    artifactRefs: typeof input.artifactRefs === 'function'
      ? await input.artifactRefs(prior.stages.image.artifactRefs)
      : input.artifactRefs ?? prior.stages.image.artifactRefs,
  }
  const stages = { ...prior.stages, image: imageStage }
  const required = Object.values(stages).filter(stage => stage.requirement === 'required')
  const status = aggregateComicStageStatus(required)
  const metadata = {
    ...item.metadata,
    ...(history.length > 0 ? { [COMIC_IMAGE_RUN_HISTORY_KEY]: history } : {}),
    comic: { ...prior, stages },
  }
  return { ...manifest, items: [{ ...item, status, providers, metadata: metadata as never }] }
})

type PanelRefUpdate = { path: string, sha256: string | null }

const selectionChangesPresentation = async (
  sceneRunDir: string,
  presentation: CanonicalComicItemMetadata['presentation'],
  panelRefs: PanelRefUpdate[],
): Promise<boolean> => {
  const { planRef, selectedPresentationId } = presentation
  if (!selectedPresentationId || !planRef) return false
  const stored = await readContainedArtifactFile(sceneRunDir, planRef.path)
  if (stored.sha256 !== planRef.sha256) throw UsageError('Selected slideshow plan changed before panel adoption.')
  const archive: { plan: ComicPresentationPlan } | ComicPresentationPlan = JSON.parse(stored.bytes.toString('utf8'))
  const plan = validateComicPresentationPlan('plan' in archive ? archive.plan : archive)
  if (plan.presentationId !== selectedPresentationId) throw UsageError('Selected slideshow is bound to a different presentation plan.')
  const selected = new Map(panelRefs.map(ref => [ref.path, ref.sha256]))
  return plan.inputs.panels.some(panel => selected.has(panel.path) && selected.get(panel.path) !== panel.sha256)
}

/** Rebind canonical image refs and invalidate a selected slideshow only when its own input bytes change. */
export const updateComicImageSelectionRefs = async (input: {
  sceneRunDir: string
  refs: PanelRefUpdate[]
  publish?: (priorRefs: ComicStageArtifactRef[], presentationBefore?: ComicSelectionPresentationSnapshot) => Promise<void>
  rollback?: { panels: PanelRefUpdate[], presentationBefore?: ComicSelectionPresentationSnapshot | undefined }
}): Promise<PipelineManifest> => await updateManifest(input.sceneRunDir, async (manifest) => {
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1) throw UsageError('Comic panel selection can update only one canonical comic scene manifest.')
  const item = manifest.items[0]
  if (!item) throw UsageError('Canonical comic scene item is missing.')
  const prior = comicMetadata(item)
  const incoming = new Map(input.refs.map(ref => [ref.path, ref.sha256]))
  const existingRefs = prior.stages.image.artifactRefs
  const stages = { ...prior.stages }
  let presentation = prior.presentation
  let invalidated: ComicSelectionPresentationSnapshot | undefined
  const restore = input.rollback?.presentationBefore
  if (await selectionChangesPresentation(input.sceneRunDir, presentation, input.rollback?.panels ?? input.refs)) {
    invalidated = { stage: stages.presentation, presentation, audioHash: hashCanonicalTtsValue(prior.audio) }
    stages.presentation = { requirement: 'optional', status: 'incomplete', execution: { kind: 'local', state: 'missing' }, targetKeys: [], artifactRefs: [] }
    presentation = {}
  } else if (restore && !presentation.selectedPresentationId && stages.presentation.status === 'incomplete' && restore.audioHash === hashCanonicalTtsValue(prior.audio)) {
    stages.presentation = restore.stage
    presentation = restore.presentation
  }
  await input.publish?.(existingRefs.filter(ref => incoming.has(ref.path)), invalidated)
  if (stages.image.requirement !== 'not-requested') {
    const artifactRefs = existingRefs.flatMap(ref => {
      const sha256 = incoming.get(ref.path)
      incoming.delete(ref.path)
      return sha256 === null ? [] : [{ path: ref.path, sha256: sha256 ?? ref.sha256 }]
    })
    for (const [path, sha256] of incoming) {
      if (sha256 !== null) artifactRefs.push({ path, sha256 })
    }
    stages.image = { ...stages.image, artifactRefs }
  }
  return { ...manifest, items: [{ ...item, metadata: { ...item.metadata, comic: { ...prior, stages, presentation } } as never }] }
})

export const updateComicPresentationManifest = async (input: {
  sceneRunDir: string
  sourceIdentity: ComicSourceIdentity
  stage: CanonicalComicItemMetadata['stages']['presentation']
  presentation: CanonicalComicItemMetadata['presentation']
  publishFinal?: (() => Promise<Array<{ path: string, sha256: string }>>) | undefined
}): Promise<PipelineManifest> => await updateManifest(input.sceneRunDir, async (manifest) => {
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) throw UsageError('Comic presentation can update only the exact compatible canonical scene manifest.')
  const item = manifest.items[0]
  if (!item || item.input !== input.sourceIdentity.canonicalPath) throw UsageError('Canonical comic source changed during presentation rendering.')
  const prior = comicMetadata(item)
  if (input.stage.requirement !== 'optional' || input.stage.execution.kind !== 'local' || input.stage.targetKeys.length !== 0) throw UsageError('Comic presentation is an optional local-only stage.')
  const stages = { ...prior.stages, presentation: input.stage }
  const required = Object.values(stages).filter(stage => stage.requirement === 'required')
  const status = aggregateComicStageStatus(required)
  const next = {
    ...manifest,
    items: [{
      ...item,
      status,
      metadata: { ...item.metadata, comic: { ...prior, stages, presentation: input.presentation } } as never,
    }],
  }
  if (input.publishFinal) {
    const published = await input.publishFinal()
    if (canonicalTtsJson(published) !== canonicalTtsJson(input.presentation.finalOutputRefs)) throw UsageError('Published comic presentation outputs do not match the canonical presentation manifest update.')
  }
  return next
})
