import type { ProviderIdentity } from '~/types'

export type AdditiveResumeProviderSelection<TProvider extends ProviderIdentity> = {
  requestedProviders: TProvider[]
  providersToRun: TProvider[]
  skippedSuccessfulProviders: TProvider[]
}
