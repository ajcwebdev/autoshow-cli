import { articleFlags, batchFlags, priceFlag } from './shared-flags'
import { boolFlag, strFlag, withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'

const metadataDocumentFlags = {
  password: strFlag('Password for encrypted PDFs')
} as const satisfies CliFlagsDefinition

const metadataOutputFlags = {
  markdown: boolFlag('Output metadata as Markdown frontmatter YAML'),
  save: boolFlag('Save manifest.json to disk (and metadata.md with --markdown)')
} as const satisfies CliFlagsDefinition

export const metadataFlags = {
  ...withHelpGroup(metadataDocumentFlags, 'document-options'),
  ...withHelpGroup(metadataOutputFlags, 'metadata-output'),
  ...withHelpGroup(articleFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
  ...withHelpGroup(priceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition
