export type AudioProjectionValidationContext = {
  projection: Record<string, unknown>
  targetKey: string
  branchHistory: unknown[]
  readinessAttempts: unknown[]
  renderHistory: unknown[]
  pointerEvents: unknown[]
  createOnlyPaths: Set<string>
  branchIds: Set<string>
  renderIds: Set<string>
  addCreateOnlyPath: (value: unknown) => boolean
}
