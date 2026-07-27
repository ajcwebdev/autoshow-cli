import type { AllShortcutFlag, RuntimeModelOptions, TargetCounts } from '~/types'

export type BuildDomainOptionsContext = {
  mergedFlags: Record<string, unknown>
  explicitFlags: Set<string>
  configuredFlags: Set<string>
  allShortcutFlags: Record<AllShortcutFlag, boolean>
  modelOptions: RuntimeModelOptions
  targetCounts: TargetCounts
}
