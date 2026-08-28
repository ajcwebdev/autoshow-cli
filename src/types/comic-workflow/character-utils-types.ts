import type * as v from 'valibot'

export type CharacterSketchRegistration = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils').CharacterSketchRegistrationSchema>

export type CharacterSketchManifest = v.InferOutput<typeof import('~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils').CharacterSketchManifestSchema>
