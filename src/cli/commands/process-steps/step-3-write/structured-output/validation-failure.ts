export type StructuredValidationFailureEnvelope = {
  _raw: string
  _validationError: string
}

export const buildStructuredValidationFailureEnvelope = (
  rawResponse: string,
  validationIssue: string
): StructuredValidationFailureEnvelope => ({
  _raw: rawResponse,
  _validationError: validationIssue
})

export const isStructuredValidationFailureEnvelope = (
  value: unknown
): value is StructuredValidationFailureEnvelope =>
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && typeof (value as Record<string, unknown>)['_raw'] === 'string'
  && typeof (value as Record<string, unknown>)['_validationError'] === 'string'
