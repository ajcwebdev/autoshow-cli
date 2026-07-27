export type SelectorFlagMap = Record<string, string>

export type SelectorNormalizationResult = {
  flags: Record<string, unknown>
  explicitFlags: Set<string>
  rawArgs?: string[] | undefined
}

export type ExtractSelectorInputRoutes = {
  media: boolean
  document: boolean
  article?: boolean | undefined
}

