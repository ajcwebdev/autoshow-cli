import type * as v from 'valibot'

export type DependencyMetadata =
  v.InferOutput<typeof import('~/cli/commands/setup-and-utilities/setup/dependency-metadata').DependencyMetadataSchema>
