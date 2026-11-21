import type { ComicSourceIdentity, StructuredScriptData } from '~/types'

export type ExpandedScriptBlock = {
  text: string
  followsBoldLabelInSameBlock?: boolean
}

export type PreparedStructuredScript = {
  scriptPath: string
  sourceIdentity: ComicSourceIdentity
  structuredScript: StructuredScriptData
  structuredBytes: string
}
