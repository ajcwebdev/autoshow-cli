import type { CliFlagsDefinition } from '~/types'

export const epubInspectFlags = {
  'epub-bun': {
    description: 'EPUB inspect mode with Bun ZIP/XML parser (writes structured EPUB data into run.json)',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition
