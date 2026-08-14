import type {
  TtsProviderRequestAttempt,
  TtsProviderRequestLifecycle,
  TtsRequestEvidenceScope,
  TtsSerializedRequestObservation,
} from '~/types'
import { extractErrorMetadata } from '~/utils/error-handler'

export type TtsProviderAdmissionDisposition = 'rejected' | 'ambiguous'

export const classifyTtsProviderAdmissionError = (error: unknown): TtsProviderAdmissionDisposition => {
  const explicit = error && typeof error === 'object' && 'ttsAdmissionDisposition' in error
    ? (error as { ttsAdmissionDisposition?: unknown }).ttsAdmissionDisposition
    : undefined
  if (explicit === 'rejected' || explicit === 'ambiguous') return explicit

  const metadata = extractErrorMetadata(error)
  const status = typeof metadata['status'] === 'number' ? metadata['status'] : undefined
  return status !== undefined
    && status >= 400
    && status < 500
    && status !== 408
    && status !== 409
    ? 'rejected'
    : 'ambiguous'
}

const NOOP_REQUEST_LIFECYCLE: TtsProviderRequestLifecycle = {
  accepted: async () => {}
}

export const dispatchTtsProviderRequest = async <T>(
  evidence: TtsRequestEvidenceScope | undefined,
  observation: TtsSerializedRequestObservation,
  requestAttempt: TtsProviderRequestAttempt,
  operation: (lifecycle: TtsProviderRequestLifecycle) => Promise<T>
): Promise<T> => evidence
  ? await evidence.dispatch(observation, requestAttempt, operation)
  : await operation(NOOP_REQUEST_LIFECYCLE)
