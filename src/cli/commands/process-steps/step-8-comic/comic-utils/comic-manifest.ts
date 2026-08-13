import type {
  CanonicalComicItemMetadata,
  ComicSourceIdentity,
  PipelineManifest,
  PipelineManifestItem,
  PipelineProviderState,
  Step4Metadata,
  StructuredScriptArtifactRef,
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  createManifest,
  readManifest,
  updateManifest,
  writeManifest,
} from '../../pipeline-manifest'
import { canonicalTtsJson } from '../../step-4-tts/script-to-audio/contract-identity'
import { computeSceneRunIdentity } from './comic-audio-contracts'
import { appendCurrentTtsProviderState } from '../../step-4-tts/script-to-audio/current-render-artifacts'

export const notRequestedComicStage = () => ({
  requirement: 'not-requested' as const,
  status: 'skipped' as const,
  execution: { kind: 'none' as const, reason: 'not-requested' as const },
  targetKeys: [] as [],
  artifactRefs: [] as [],
})

const comicMetadata = (item: PipelineManifestItem): CanonicalComicItemMetadata => {
  const value = item.metadata['comic']
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw CLIUsageError('Canonical comic item is missing its strict metadata.comic envelope.')
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
    },
    audio: {
      sceneRunIdentity,
      structuredScript: input.structuredScript,
    },
  }
  const current = await readManifest(input.sceneRunDir)
  if (current) {
    if (current.command !== 'comic' || current.scope !== 'single' || current.items.length !== 1 || canonicalTtsJson(current.source) !== canonicalTtsJson(input.sourceIdentity)) {
      throw CLIUsageError('Existing scene output does not belong to the exact canonical comic source; use a new run directory.')
    }
    return await updateManifest(input.sceneRunDir, (manifest) => {
      const item = manifest.items[0]
      if (!item || item.input !== input.sourceIdentity.canonicalPath) throw CLIUsageError('Canonical comic item source changed during structure generation.')
      const prior = comicMetadata(item)
      const stages = { ...prior.stages, structure: structureStage }
      const required = Object.values(stages).filter(stage => stage.requirement === 'required')
      const status = required.every(stage => stage.status === 'full' || stage.status === 'skipped') && required.some(stage => stage.status === 'full')
        ? 'full' as const
        : required.every(stage => stage.status === 'skipped')
          ? 'skipped' as const
          : required.every(stage => stage.status === 'failed' || stage.status === 'skipped') && required.some(stage => stage.status === 'failed')
            ? 'failed' as const
            : 'incomplete' as const
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
    throw CLIUsageError('Comic audio can update only the exact compatible canonical scene manifest.')
  }
  const item = manifest.items[0]
  if (!item || item.input !== input.sourceIdentity.canonicalPath) throw CLIUsageError('Canonical comic source changed during audio generation.')
  const prior = comicMetadata(item)
  if (input.providers?.some(provider => provider.operation !== 'comic-audio')) throw CLIUsageError('Comic audio stage updates may replace only comic-audio provider states.')
  const providers = input.providers === undefined
    ? item.providers
    : (() => {
        const incomingByTarget = new Map(input.providers.map(provider => [provider.targetKey, provider] as const))
        const priorAudio = item.providers.filter(provider => provider.operation === 'comic-audio')
        const mergedAudio = priorAudio.map(provider => {
          const incoming = incomingByTarget.get(provider.targetKey)
          if (!incoming) return provider
          incomingByTarget.delete(provider.targetKey)
          return appendCurrentTtsProviderState(provider, incoming)
        })
        return [
          ...item.providers.filter(provider => provider.operation !== 'comic-audio'),
          ...mergedAudio,
          ...incomingByTarget.values(),
        ]
      })()
  const requiredStages = [prior.stages.structure, prior.stages.image, input.stage].filter(stage => stage.requirement === 'required')
  const status = requiredStages.every(stage => stage.status === 'full' || stage.status === 'skipped') && requiredStages.some(stage => stage.status === 'full')
    ? 'full' as const
    : requiredStages.every(stage => stage.status === 'skipped')
      ? 'skipped' as const
      : requiredStages.every(stage => stage.status === 'failed' || stage.status === 'skipped') && requiredStages.some(stage => stage.status === 'failed')
        ? 'failed' as const
        : 'incomplete' as const
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
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) throw CLIUsageError('Comic audio provider state can update only the exact canonical scene manifest.')
  const item = manifest.items[0]
  if (!item) throw CLIUsageError('Canonical comic scene item is missing.')
  const prior = comicMetadata(item)
  const providers = item.providers.slice()
  const index = providers.findIndex(provider => provider.targetKey === input.state.targetKey)
  if (index >= 0) providers[index] = appendCurrentTtsProviderState(providers[index] as PipelineProviderState, input.state)
  else providers.push(input.state)
  const stage = {
    requirement: 'required' as const,
    status: providerBackedStageStatus(input.targetKeys, providers),
    execution: { kind: 'provider-targets' as const },
    targetKeys: [...input.targetKeys] as [string, ...string[]],
    artifactRefs: prior.stages.audio.artifactRefs,
  }
  const requiredStages = [prior.stages.structure, prior.stages.image, stage].filter(candidate => candidate.requirement === 'required')
  const status = requiredStages.every(candidate => candidate.status === 'full' || candidate.status === 'skipped') && requiredStages.some(candidate => candidate.status === 'full')
    ? 'full' as const
    : requiredStages.every(candidate => candidate.status === 'skipped')
      ? 'skipped' as const
      : requiredStages.every(candidate => candidate.status === 'failed' || candidate.status === 'skipped') && requiredStages.some(candidate => candidate.status === 'failed')
        ? 'failed' as const
        : 'incomplete' as const
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
  if (manifest.command !== 'comic' || manifest.scope !== 'single' || manifest.items.length !== 1 || canonicalTtsJson(manifest.source) !== canonicalTtsJson(input.sourceIdentity)) throw CLIUsageError('Comic image generation can update only the exact canonical scene manifest.')
  const item = manifest.items[0]
  if (!item) throw CLIUsageError('Canonical comic scene item is missing.')
  const prior = comicMetadata(item)
  const targetKeys = input.providers.map(provider => provider.targetKey as string)
  if (targetKeys.length === 0 || targetKeys.some(key => !key) || new Set(targetKeys).size !== targetKeys.length) throw CLIUsageError('Comic image stage requires unique operation-scoped provider targets.')
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
  const status = required.every(stage => stage.status === 'full' || stage.status === 'skipped') && required.some(stage => stage.status === 'full')
    ? 'full' as const
    : required.every(stage => stage.status === 'skipped')
      ? 'skipped' as const
      : required.every(stage => stage.status === 'failed' || stage.status === 'skipped') && required.some(stage => stage.status === 'failed')
        ? 'failed' as const
        : 'incomplete' as const
  return { ...manifest, items: [{ ...item, status, providers, metadata: { ...item.metadata, comic: { ...prior, stages } } as never }] }
})
