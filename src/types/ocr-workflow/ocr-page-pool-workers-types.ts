import type { RunOcrPagePoolOptions } from '~/types'

export type OcrPoolWorkerOptions = Pick<
  RunOcrPagePoolOptions,
  'requestedTargets' | 'targetsToRun' | 'providerConcurrency' | 'localConcurrency' | 'getTargetConcurrency' | 'processPage' | 'classifyFailure' | 'onCheckpoint'
>
