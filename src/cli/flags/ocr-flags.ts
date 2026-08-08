import type { CliFlagsDefinition } from '~/types'
import { boolFlag } from './flag-utils'

export const epubInspectFlags = {
  'epub-bun': boolFlag('EPUB inspect mode with Bun ZIP/XML parser (writes structured EPUB data into run.json)')
} as const satisfies CliFlagsDefinition
