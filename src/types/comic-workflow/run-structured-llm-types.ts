import type { Step3Metadata, ValibotSchema } from '~/types'

export type ComicStructuredSchema = {
  schemaName: string
  valibotSchema: ValibotSchema
  jsonSchema: Record<string, unknown>
}

export type ComicStructuredLlmResult = {
  text: string
  metadata: Step3Metadata
}
