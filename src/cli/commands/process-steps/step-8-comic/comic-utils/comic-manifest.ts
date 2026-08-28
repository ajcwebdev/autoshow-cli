import type {
  CanonicalComicItemMetadata,
  ComicSourceIdentity,
  PipelineManifest,
  PipelineManifestItem,
  PipelineProviderState,
  Step4Metadata,
  StructuredScriptArtifactRef,
} from '~/types'
import { UsageError } from '~/utils/error-handler'
import {
  createManifest,
  readManifest,
  updateManifest,
  writeManifest,
} from '../../pipeline-manifest'
import { canonicalTtsJson } from '../../step-4-tts/script-to-audio/contract-identity'
import { computeSceneRunIdentity } from './comic-audio-contracts'
import { appendCurrentTtsProviderState } from '../../step-4-tts/script-to-audio/current-render-artifacts'
import { aggregateComicStageStatus } from '../../pipeline-manifest/comic-stage-status'

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
  const current = await readManifest(input.sceneRunDir)
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
  const nextItem: PipelineManifestItem = {
    ...item,
    status,
    providers,
    metadata: {
      ...item.metadata,
      ...(input.ttsEvaluation ? { tts: input.ttsEvaluation } : {}),
      comic: {
        schemaVersion: 1,
        stages: { ...prior.stages, audio: input.stage },
        audio: input.audio,
        presentation: prior.presentation,
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

export const updateComicImageManifest = async (input: {
  sceneRunDir: string
  sourceIdentity: ComicSourceIdentity
  providers: PipelineProviderState[]
  artifactRefs: Array<{ path: string, sha256: string }>
}): Promise<PipelineManifest> => await updateManifest(input.sceneRunDir, (manifest) => {
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) throw UsageError('Comic image generation can update only the exact canonical scene manifest.')
  const item = manifest.items[0]
  if (!item) throw UsageError('Canonical comic scene item is missing.')
  const prior = comicMetadata(item)
  const targetKeys = input.providers.map(provider => provider.targetKey as string)
  if (targetKeys.length === 0 || targetKeys.some(key => !key) || new Set(targetKeys).size !== targetKeys.length) throw UsageError('Comic image stage requires unique operation-scoped provider targets.')
  const providers = [...item.providers.filter(provider => provider.operation !== 'comic-image'), ...input.providers]
  const imageStage = {
    requirement: 'required' as const,
    status: providerBackedStageStatus(targetKeys, providers),
    execution: { kind: 'provider-targets' as const },
    targetKeys: targetKeys as [string, ...string[]],
    artifactRefs: input.artifactRefs,
  }
  const stages = { ...prior.stages, image: imageStage }
  const required = Object.values(stages).filter(stage => stage.requirement === 'required')
  const status = aggregateComicStageStatus(required)
  return { ...manifest, items: [{ ...item, status, providers, metadata: { ...item.metadata, comic: { ...prior, stages } } as never }] }
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
