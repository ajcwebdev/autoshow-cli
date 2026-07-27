import type { StructuredScriptSourceSegment } from '~/types'

type SourceCoverageField = 'speakerLabel' | 'delivery' | 'text'

export type SourceCoverageItem = {
  id: string
  type: StructuredScriptSourceSegment['type']
  field: SourceCoverageField
  text: string
}

export type SourcePromptFile = {
  path: string
  content: string
}

export type SourceCoverageReport = {
  complete: boolean
  totalSegments: number
  coveredSegments: number
  missingSegments: Array<{
    id: string
    type: StructuredScriptSourceSegment['type']
    excerpt: string
  }>
  missingItems: Array<{
    id: string
    type: StructuredScriptSourceSegment['type']
    field: SourceCoverageField
    excerpt: string
  }>
  promptFiles: string[]
}
