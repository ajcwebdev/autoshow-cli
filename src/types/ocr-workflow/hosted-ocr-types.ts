import type { HostedOcrRun } from '~/types'

export type HostedOcrService = HostedOcrRun['ocrService']


export type HostedDirectImageFormatSet = {
  direct: Set<string>
  bunToPng: Set<string>
  imagemagickToPng: Set<string>
}

export type HostedDirectImageInputStrategy = 'direct' | 'bun-png' | 'imagemagick-png' | 'unsupported'

export type HostedOcrIdentity = Pick<
  HostedOcrRun,
  'extractionMethod' | 'ocrService' | 'ocrModel' | 'requestedReasoningEffort' | 'effectiveReasoningEffort'
>
