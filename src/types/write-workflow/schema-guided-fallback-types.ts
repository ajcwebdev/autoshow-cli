import type { Step3Metadata } from '~/types'

export type SchemaGuidedStructuredResponse = {
  parsedJson: unknown
  rawResponse: string
  metadata: Step3Metadata
}
