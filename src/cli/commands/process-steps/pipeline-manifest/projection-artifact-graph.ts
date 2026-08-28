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
import { canonicalManifestJson, isSha256 } from './guards'
import { verifyComicProjectionArtifacts } from './comic-projection-artifact-verifier'
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
    if (manifest.command === 'comic' && !await verifyComicProjectionArtifacts(rootDir, item)) return false
  }
  return true
}
