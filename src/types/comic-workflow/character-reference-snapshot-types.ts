import type * as v from 'valibot'

export type CharacterReferenceManifest = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-snapshot').CharacterReferenceManifestSchema>
