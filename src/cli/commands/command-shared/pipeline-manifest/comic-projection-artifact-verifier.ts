import { resolve } from 'node:path'
import type { PipelineManifestItem } from '~/types'
import { readFileBytes } from '~/utils/bun-file-io'
import { isRecord } from '~/utils/rest-client'
import { isSafeRelativePath } from './guards'

type ComicArtifactReference = Readonly<{ path: string, sha256: string }>

const appendReference = (references: ComicArtifactReference[], value: unknown): void => {
  if (isRecord(value) && typeof value['path'] === 'string' && typeof value['sha256'] === 'string') {
    references.push({ path: value['path'], sha256: value['sha256'] })
  }
}

export const discoverComicProjectionArtifactReferences = (
  item: PipelineManifestItem
): ComicArtifactReference[] | undefined => {
  const comic = item.metadata['comic']
  if (!isRecord(comic) || !isRecord(comic['stages']) || !isRecord(comic['audio'])) return undefined
  const references: ComicArtifactReference[] = []
  for (const stage of Object.values(comic['stages'])) {
    if (!isRecord(stage) || !Array.isArray(stage['artifactRefs'])) return undefined
    for (const reference of stage['artifactRefs']) appendReference(references, reference)
  }
  const audio = comic['audio']
  for (const key of ['structuredScript', 'dialoguePlanRef', 'snapshotRef', 'mixPlanRef', 'finalTimelineRef', 'soundscapePlanRef', 'soundEffectRenderPlanRef', 'soundEffectRenderResultRef'] as const) {
    appendReference(references, audio[key])
  }
  if (Array.isArray(audio['finalOutputRefs'])) {
    for (const reference of audio['finalOutputRefs']) appendReference(references, reference)
  }
  if (Array.isArray(audio['selectedAudioRuns'])) {
    for (const run of audio['selectedAudioRuns']) {
      if (isRecord(run) && typeof run['audioRunRef'] === 'string' && typeof run['audioRunSha256'] === 'string') {
        references.push({ path: run['audioRunRef'], sha256: run['audioRunSha256'] })
      }
    }
  }
  if (Array.isArray(audio['selectedSoundscapeRuns'])) {
    for (const run of audio['selectedSoundscapeRuns']) {
      if (isRecord(run) && typeof run['audioRunRef'] === 'string' && typeof run['audioRunSha256'] === 'string') {
        references.push({ path: run['audioRunRef'], sha256: run['audioRunSha256'] })
      }
      if (isRecord(run)) appendReference(references, run['masterRef'])
    }
  }
  const presentation = comic['presentation']
  if (isRecord(presentation)) {
    for (const key of ['planRef', 'resolvedTimelineRef', 'runRef'] as const) appendReference(references, presentation[key])
    if (Array.isArray(presentation['finalOutputRefs'])) {
      for (const reference of presentation['finalOutputRefs']) appendReference(references, reference)
    }
  }
  return references
}

const verifyComicArtifactReference = async (rootDir: string, reference: ComicArtifactReference): Promise<boolean> => {
  if (!isSafeRelativePath(rootDir, reference.path)) return false
  try {
    const bytes = await readFileBytes(resolve(rootDir, reference.path))
    return new Bun.CryptoHasher('sha256').update(bytes).digest('hex') === reference.sha256
  } catch {
    return false
  }
}

export const verifyComicProjectionArtifacts = async (
  rootDir: string,
  item: PipelineManifestItem
): Promise<boolean> => {
  const references = discoverComicProjectionArtifactReferences(item)
  if (!references) return false
  const results = await Promise.all(references.map((reference) => verifyComicArtifactReference(rootDir, reference)))
  return results.every(Boolean)
}
