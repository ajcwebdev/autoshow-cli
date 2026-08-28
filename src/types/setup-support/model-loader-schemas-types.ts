export type LifecycleRegistryService = {
  models: Record<string, {
    lifecycle?: {
      replacementModel?: string | undefined
    } | undefined
  }>
}
