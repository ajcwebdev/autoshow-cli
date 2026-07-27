import type { Step3Metadata } from '~/types'

export type CompatStructuredResponse = {
  parsedJson: unknown
  rawResponse: string
  metadata: Step3Metadata
}
