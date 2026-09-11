import { normalizeResumeSelectorFlagsForTarget as normalizeResumeSelectorOccurrencesForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { extractStep2CommandFlags } from '~/cli/flags/extract-flags'
import { normalizeExtractGenericSelectorFlags as normalizeExtractGenericSelectorOccurrences } from '~/cli/flags/service-selector-normalization/extract-selectors'
import { normalizeGenericProviderSelectorFlags as normalizeGenericProviderSelectorOccurrences } from '~/cli/flags/service-selector-normalization/generic-provider-selectors'
import { normalizeWriteStepSelectorFlags as normalizeWriteStepSelectorOccurrences } from '~/cli/flags/service-selector-normalization/step-selectors'
import type { ExtractSelectorInputRoutes, ResumeTarget } from '~/types'
import { flagOccurrencesFromValues, parseFlagsAndOccurrences } from '../../../../test-utils/flag-occurrences'

export const normalizeGenericProviderSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  selectorFlag: string,
  targets: Record<string, string>,
  options: { allProvidersTarget?: string, allLocalTarget?: string } = {}
) => normalizeGenericProviderSelectorOccurrences(
  flags,
  explicitFlags,
  flagOccurrencesFromValues(flags, explicitFlags),
  selectorFlag,
  targets,
  options
)

export const normalizeWriteStepSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>
) => normalizeWriteStepSelectorOccurrences(flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags))

export const normalizeExtractGenericSelectorFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  routes: ExtractSelectorInputRoutes
) => normalizeExtractGenericSelectorOccurrences(flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags), routes)

export const normalizeResumeSelectorFlagsForTarget = (
  target: ResumeTarget,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  _rawArgs: string[]
) => normalizeResumeSelectorOccurrencesForTarget(target, flags, explicitFlags, flagOccurrencesFromValues(flags, explicitFlags))

export const normalizeExtractGenericSelectorArgs = (
  argv: string[],
  routes: ExtractSelectorInputRoutes
): string[] => {
  const parsed = parseFlagsAndOccurrences(argv, extractStep2CommandFlags)
  const normalized = normalizeExtractGenericSelectorOccurrences(
    parsed.flags,
    parsed.rawParsed.explicitFlags,
    parsed.rawParsed.flagOccurrences,
    routes
  )
  return normalized.flagOccurrences.flatMap((occurrence) => [
    `--${occurrence.name}`,
    ...(typeof occurrence.value === 'string' ? [occurrence.value] : [])
  ])
}
