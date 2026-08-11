import type { AllShortcutFlag, BuildOptsDefaults, CliFlagOccurrence } from '~/types'

export type ResolvedModelOptions =
  ReturnType<typeof import('~/cli/options/option-resolution/download-model-options').readRuntimeModelOptions>

export type ResolvedFlagContext = {
  mergedFlags: Record<string, unknown>
  explicitFlags: Set<string>
  configuredFlags: Set<string>
  flagOccurrences: readonly CliFlagOccurrence[]
  defaults: BuildOptsDefaults
  allShortcutFlags: Record<AllShortcutFlag, boolean>
  modelOptions: ResolvedModelOptions
}
