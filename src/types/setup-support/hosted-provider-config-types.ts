export type HostedProviderStatus = 'configured' | 'missing'

export type HostedProviderEnvCheck = {
  envVar: string
  label: string
  configPaths: readonly string[]
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
