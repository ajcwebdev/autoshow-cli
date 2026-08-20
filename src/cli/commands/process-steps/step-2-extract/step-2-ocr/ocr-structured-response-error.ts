import { writeFile } from '~/utils/cli-utils'
import type { OcrProviderFailureSummary } from '~/types'
import { AppValidationError, collectErrorChain, extractErrorMetadata, serializeDiagnosticError } from '~/utils/error-handler'
import { sanitizeLogText } from '~/utils/app-logger/redaction'

// A provider returned a 200 whose body does not parse as the requested structure:
// deterministic, so re-requesting the same response would fail identically.
export class OcrStructuredResponseError extends AppValidationError {
  readonly rawResponse: string

  constructor(message: string, rawResponse: string) {
    super(message, { stage: 'ocr:structured-response', retryable: false })
    this.name = 'OcrStructuredResponseError'
    this.rawResponse = rawResponse
  }
}

// Uses the shared `collectErrorChain` rather than a private cause walker, so cycle and
// depth handling stay identical to the rest of the diagnostics layer.
export const findOcrStructuredResponseError = (
  error: unknown
): OcrStructuredResponseError | undefined =>
  collectErrorChain(error).find(
    (entry) => entry instanceof OcrStructuredResponseError
  ) as OcrStructuredResponseError | undefined

export const writeInvalidOcrStructuredResponse = async (
  providerDir: string,
  error: unknown
): Promise<'invalid-structured-response.txt' | undefined> => {
  const structuredError = findOcrStructuredResponseError(error)
  if (!structuredError) {
    return undefined
  }

  await writeFile(`${providerDir}/invalid-structured-response.txt`, sanitizeLogText(structuredError.rawResponse))
  await writeFile(`${providerDir}/invalid-structured-response.json`, JSON.stringify({
    error: sanitizeLogText(structuredError.message),
    rawResponseFile: 'invalid-structured-response.txt'
  }, null, 2))
  return 'invalid-structured-response.txt'
}

export const writeOcrProviderError = async (
  providerDir: string,
  error: unknown,
  failure: OcrProviderFailureSummary
): Promise<Pick<OcrProviderFailureSummary, 'errorFile' | 'rawResponseFile'>> => {
  let rawResponseFile: OcrProviderFailureSummary['rawResponseFile'] = await writeInvalidOcrStructuredResponse(providerDir, error)
  const metadata = extractErrorMetadata(error)
  const rawResponse = metadata['rawResponse'] ?? metadata['body']
  if (rawResponseFile === undefined && rawResponse !== undefined) {
    rawResponseFile = 'raw-response.json'
    await writeFile(`${providerDir}/${rawResponseFile}`, JSON.stringify(serializeDiagnosticError(rawResponse), null, 2))
  }
  await writeFile(`${providerDir}/error.json`, JSON.stringify({
    message: sanitizeLogText(failure.message),
    category: failure.category,
    failureKind: failure.failureKind,
    retryable: failure.retryable,
    ...(failure.quota ? { quota: true } : {}),
    ...(failure.providerWide ? { providerWide: true } : {}),
    ...(failure.blockedReason ? { blockedReason: sanitizeLogText(failure.blockedReason) } : {}),
    ...(failure.stage ? { stage: failure.stage } : {}),
    ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
    ...(rawResponseFile ? { rawResponseFile } : {}),
    error: serializeDiagnosticError(error)
  }, null, 2))
  return {
    errorFile: 'error.json',
    ...(rawResponseFile ? { rawResponseFile } : {})
  }
}
