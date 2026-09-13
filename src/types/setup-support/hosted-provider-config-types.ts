export type HostedProviderStatus = 'configured' | 'missing'

export type HostedProviderEnvCheck = {
  providerId: string
  envVar: string
  label: string
  hintUrl: string
  stages: readonly string[]
  /** Dotted paths; append =value for an exact enum selector rather than presence. */
  configPaths: readonly string[]
  ttsPreflight?: {
    provider: import('~/types').TtsProvider
    label: string
  } | undefined
  liveProbe?: 'voice-catalog' | undefined
}

export type HostedProviderConfigurationRow = {
  provider: string
  status: HostedProviderStatus
  envKey: string
  detail: string
}

export type HostedProviderConfigurationSummary = {
  configured: number
  missing: number
  total: number
}

export type HostedProviderConfigurationLogMode = 'all' | 'missing'
