import type { HostedConcurrencyCoordinator, HostedConcurrencyMode, Step2SelectionOriginOptions, SttRuntimeOptions } from '~/types'

export type ProcessingSource =
  | { url: string, filePath?: never }
  | { filePath: string, url?: never }

type ProcessingSttOptions = Partial<Omit<
  SttRuntimeOptions,
  | 'sttProviderConcurrency'
  | 'sttLocalConcurrency'
  | 'sttSegmentConcurrency'
  | 'sttPreflightConcurrency'
>>

type ProcessingExtractOptions = {
  concurrencyMode: HostedConcurrencyMode
  hostedConcurrencyCoordinator?: HostedConcurrencyCoordinator | undefined
  configPath: string | undefined
  youtubeCaptions: boolean
}

export type ProcessingOptions = ProcessingSource
  & Step2SelectionOriginOptions
  & ProcessingSttOptions
  & Partial<ProcessingExtractOptions>
  & { outputDir: string }
