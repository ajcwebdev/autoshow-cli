import type { ParsedSpaceInput, SpacesArtifact } from '~/types'

export type XSpaceExtractionArtifacts = {
  artifact: SpacesArtifact
  extractionMarkdown: string
  label: string
  outputDir: string
  parsedInput: ParsedSpaceInput
  sourceUrl: string
}
