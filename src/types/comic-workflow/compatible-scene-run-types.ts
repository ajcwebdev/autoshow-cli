import type { CanonicalComicItemMetadata, ComicSourceIdentity, PipelineManifest, StructuredScriptData } from '~/types'

export type CompatibleComicSceneRun = {
  sceneRunDir: string
  manifest: PipelineManifest
  sourceIdentity: ComicSourceIdentity
  structuredScript: StructuredScriptData
  structuredScriptBytes: Uint8Array
  comicMetadata: CanonicalComicItemMetadata
}
