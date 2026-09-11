import type * as v from 'valibot'

export type CharacterReferenceManifest = v.InferOutput<typeof import('~/cli/commands/visuals/comic/comic-utils/character-reference-snapshot').CharacterReferenceManifestSchema>
