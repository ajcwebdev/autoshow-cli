import { articleFlags, batchFlags } from './shared-flags'
import { withHelpGroup } from './flag-utils'
import type { CliFlagsDefinition } from '~/types'

const metadataDocumentFlags = {
  password: { description: 'Password for encrypted PDFs', type: String }
} as const satisfies CliFlagsDefinition

const metadataOutputFlags = {
  markdown: {
    description: 'Output metadata as Markdown frontmatter YAML',
    type: Boolean,
    default: false,
    negatable: false
  },
  save: {
    description: 'Save run.json to disk (and metadata.md with --markdown)',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const metadataFlags = {
  ...withHelpGroup(metadataDocumentFlags, 'document-options'),
  ...withHelpGroup(metadataOutputFlags, 'metadata-output'),
  ...withHelpGroup(articleFlags, 'article-extraction'),
  ...withHelpGroup(batchFlags, 'batch-processing'),
} as const satisfies CliFlagsDefinition
