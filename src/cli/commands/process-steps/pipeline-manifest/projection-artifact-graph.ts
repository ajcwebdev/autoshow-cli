import { resolve } from 'node:path'
import type {
  PipelineManifest,
  PipelineManifestItem,
  ProviderRenderPlan
} from '~/types'
import { isRecord } from '~/utils/rest-client'
import { readFileBytes } from '~/utils/bun-file-io'
import {
  validateGenericTtsDialoguePlan,
  validateProviderRenderPlanIdentity
} from '../step-4-tts/script-to-audio/contract-validation'
import { parseTtsDialoguePlanArtifactRef, readTtsDialoguePlanArtifact } from '../step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import {
  canonicalManifestJson,
  isSafeRelativePath,
  isSha256
} from './guards'
import { verifyProviderProjectionArtifacts } from './projection-artifact-verifier'

export {
  validateProjectionArtifactJson,
  JSON_VALIDATORS
} from './projection-artifact-json-validation'
export {
  discoverPreviousAdmissionJournalReference,
  verifyProviderProjectionArtifacts
} from './projection-artifact-verifier'
export {
  PROJECTION_ARTIFACT_GRAPH_LINK_PASSES,
  validateProjectionArtifactGraphLinks
} from './projection-artifact-graph-links'

export const verifyManifestProjectionArtifacts = async (
  rootDir: string,
  manifest: PipelineManifest
): Promise<boolean> => {
  const verifyComicItemArtifacts = async (item: PipelineManifestItem): Promise<boolean> => {
    const comic = item.metadata['comic']
    if (!isRecord(comic) || !isRecord(comic['stages']) || !isRecord(comic['audio'])) return false
    const references: Array<{ path: string, sha256: string }> = []
    for (const stage of Object.values(comic['stages'])) {
      if (!isRecord(stage) || !Array.isArray(stage['artifactRefs'])) return false
      for (const ref of stage['artifactRefs']) if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    }
    const audio = comic['audio']
    for (const key of ['structuredScript', 'dialoguePlanRef', 'snapshotRef', 'mixPlanRef', 'finalTimelineRef', 'soundscapePlanRef', 'soundEffectRenderPlanRef', 'soundEffectRenderResultRef'] as const) {
      const ref = audio[key]
      if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    }
    if (Array.isArray(audio['finalOutputRefs'])) for (const ref of audio['finalOutputRefs']) if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    if (Array.isArray(audio['selectedAudioRuns'])) for (const run of audio['selectedAudioRuns']) {
      if (isRecord(run) && typeof run['audioRunRef'] === 'string' && typeof run['audioRunSha256'] === 'string') references.push({ path: run['audioRunRef'], sha256: run['audioRunSha256'] })
    }
    if (Array.isArray(audio['selectedSoundscapeRuns'])) for (const run of audio['selectedSoundscapeRuns']) {
      if (isRecord(run) && typeof run['audioRunRef'] === 'string' && typeof run['audioRunSha256'] === 'string') references.push({ path: run['audioRunRef'], sha256: run['audioRunSha256'] })
      if (isRecord(run) && isRecord(run['masterRef']) && typeof run['masterRef']['path'] === 'string' && typeof run['masterRef']['sha256'] === 'string') references.push({ path: run['masterRef']['path'], sha256: run['masterRef']['sha256'] })
    }
    const presentation = comic['presentation']
    if (isRecord(presentation)) {
      for (const key of ['planRef', 'resolvedTimelineRef', 'runRef'] as const) {
        const ref = presentation[key]
        if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
      }
      if (Array.isArray(presentation['finalOutputRefs'])) for (const ref of presentation['finalOutputRefs']) if (isRecord(ref) && typeof ref['path'] === 'string' && typeof ref['sha256'] === 'string') references.push({ path: ref['path'], sha256: ref['sha256'] })
    }
    for (const ref of references) {
      if (!isSafeRelativePath(rootDir, ref.path)) return false
      try {
        const bytes = await readFileBytes(resolve(rootDir, ref.path))
        if (new Bun.CryptoHasher('sha256').update(bytes).digest('hex') !== ref.sha256) return false
      } catch {
        return false
      }
    }
    return true
  }

  const verifyTtsItemDialoguePlan = async (item: PipelineManifestItem, itemIndex: number): Promise<boolean> => {
    const synthesisProviders = item.providers.filter((provider) =>
      provider.operation === 'tts-synthesis'
      && provider.status !== 'skipped'
    )
    if (synthesisProviders.length === 0) return true
    try {
      const references = synthesisProviders.map((provider) => parseTtsDialoguePlanArtifactRef(provider))
      const reference = references[0]
      if (
        !reference
        || references.some((candidate) => canonicalManifestJson(candidate) !== canonicalManifestJson(reference))
      ) return false
      const dialoguePlan = validateGenericTtsDialoguePlan(await readTtsDialoguePlanArtifact(rootDir, reference))
      if (
        dialoguePlan.dialoguePlanId !== reference.dialoguePlanId
        || (dialoguePlan.sourceIdentity.sourceLocator.kind === 'file' && item.input !== dialoguePlan.sourceIdentity.sourceLocator.canonicalPath)
        || (dialoguePlan.sourceIdentity.sourceLocator.kind === 'batch-item' && dialoguePlan.sourceIdentity.sourceLocator.itemIndex !== itemIndex)
      ) return false
      for (const provider of synthesisProviders) {
        const projection = provider.result?.['ttsAudio']
        if (!isRecord(projection) || !Array.isArray(projection['renderHistory'])) return false
        for (const render of projection['renderHistory']) {
          if (!isRecord(render) || typeof render['renderPlanRef'] !== 'string' || !isSha256(render['renderPlanSha256'])) return false
          const planPath = resolve(rootDir, provider.artifactDir, render['renderPlanRef'])
          const planBytes = await readFileBytes(planPath)
          if (new Bun.CryptoHasher('sha256').update(planBytes).digest('hex') !== render['renderPlanSha256']) return false
          const planValue = JSON.parse(planBytes.toString('utf8')) as unknown
          if (!isRecord(planValue)) return false
          const renderPlan = validateProviderRenderPlanIdentity(planValue as unknown as ProviderRenderPlan)
          if (
            renderPlan.dialoguePlanId !== dialoguePlan.dialoguePlanId
            || renderPlan.sourceIdentityHash !== dialoguePlan.sourceIdentity.identityHash
          ) return false
        }
      }
      return true
    } catch {
      return false
    }
  }

  for (const [itemIndex, item] of manifest.items.entries()) {
    for (const provider of item.providers) {
      if (!await verifyProviderProjectionArtifacts(rootDir, provider)) return false
    }
    if (manifest.command === 'tts' && !await verifyTtsItemDialoguePlan(item, itemIndex)) return false
    if (manifest.command === 'comic' && !await verifyComicItemArtifacts(item)) return false
  }
  return true
}
