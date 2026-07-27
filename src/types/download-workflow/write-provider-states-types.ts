import type { SttProviderSuccess, SttTarget, WriteSttFailure } from '~/types'

export type BuildWriteSttProviderStatesContext = {
  sttTargets: SttTarget[]
  successfulSttProviders: SttProviderSuccess[]
  sttFailures: WriteSttFailure[]
}
