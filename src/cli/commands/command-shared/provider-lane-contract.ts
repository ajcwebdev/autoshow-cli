import { ValidationError } from '~/utils/error-handler'
import type { ProviderLaneIdentity } from '~/types'

export const DEFAULT_PROVIDER_LANE_SCOPE_LABEL = 'configured-account'

const normalizeProviderLaneScopeLabel = (
  scopeLabel: string | undefined,
  fallback = DEFAULT_PROVIDER_LANE_SCOPE_LABEL
): string => {
  const normalized = scopeLabel?.trim() || fallback
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(normalized)) {
    throw ValidationError('Provider lane scope labels must be stable non-secret identifiers using letters, numbers, dot, underscore, colon, or hyphen.')
  }
  if (/^[a-f0-9]{64}$/i.test(normalized) || /^(?:sk|key|token|secret)[-_][a-z0-9_-]{12,}$/i.test(normalized)) {
    throw ValidationError('Provider lane scope labels must be non-secret names, not credentials or credential hashes.')
  }
  return normalized
}

export const createProviderLaneIdentity = <TService extends string>(
  service: TService,
  scopeLabel?: string | undefined,
  fallbackScopeLabel?: string | undefined
): ProviderLaneIdentity<TService> => {
  const normalizedScopeLabel = normalizeProviderLaneScopeLabel(scopeLabel, fallbackScopeLabel)
  return Object.freeze({
    service,
    scopeLabel: normalizedScopeLabel,
    laneKey: `${service}:${normalizedScopeLabel}`
  })
}
