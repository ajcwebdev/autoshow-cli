import type * as v from 'valibot'

export type DesignReferenceSnapshotManifest = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/design-reference').DesignReferenceSnapshotManifestSchema>

export type SceneDesignReference = { key: string; sourcePath: string; usage: string }

export type ResolvedDesignReference = { key: string; usage: string; path: string }
