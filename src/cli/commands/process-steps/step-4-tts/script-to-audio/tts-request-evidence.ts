import type {
  TtsProviderRequestAttempt,
  TtsProviderRequestLifecycle,
  TtsRequestEvidenceScope,
  TtsSerializedRequestObservation,
} from '~/types'

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
