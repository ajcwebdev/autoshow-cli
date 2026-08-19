import type { HostedConcurrencyTelemetry, OcrConcurrencyMode } from '~/types'

export type HostedOcrTelemetryRoot = {
  lifetime: 'document' | 'run'
  mode: OcrConcurrencyMode
  fixedCap?: number | undefined
  documentPages: number
  documentCount: number
  sharedHostedPolicy: boolean
  hostedConcurrency?: HostedConcurrencyTelemetry | undefined
}
