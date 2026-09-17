import type { CliFlagOccurrence, SelectorNormalizationResult } from '~/types'
import { WRITE_STT_PROVIDER_TARGETS } from './provider-targets'
import {
  createGenericProviderOptionSelectors,
  type GenericOptionAssignment,
  type GenericOptionDomain
} from './generic-provider-option-selectors'
import { GENERIC_STT_OPTION_FLAGS, sttControlsForFlag, type GenericSttOptionFlag } from './generic-stt-controls'

export const STT_OPTION_DOMAIN: GenericOptionDomain = {
  label: 'STT',
  allSelectedFlag: 'all-stt',
  providerTargets: WRITE_STT_PROVIDER_TARGETS,
  retiredProviders: new Set<string>(),
  flagNames: GENERIC_STT_OPTION_FLAGS,
  controlsFor: sttControlsForFlag,
  identityProviders: () => []
}

const selectors = createGenericProviderOptionSelectors(STT_OPTION_DOMAIN)

export const readSelectedSttProviders = (flags: Record<string, unknown>): string[] =>
  selectors.readSelectedProviders(flags)

export const resolveGenericSttOptionAssignments = (
  flags: Record<string, unknown>,
  flagOccurrences: readonly CliFlagOccurrence[],
  flagName: GenericSttOptionFlag,
  selectedProviders: string[]
): GenericOptionAssignment[] => selectors.resolveAssignments(flags, flagOccurrences, flagName, selectedProviders)

export const normalizeGenericSttOptionFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  flagOccurrences: readonly CliFlagOccurrence[]
): SelectorNormalizationResult => selectors.normalizeFlags(flags, explicitFlags, flagOccurrences)

export const sttOptionSelectors = selectors
