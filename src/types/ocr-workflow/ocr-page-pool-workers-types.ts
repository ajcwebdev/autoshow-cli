import type { OcrTarget, RunOcrPagePoolOptions } from '~/types'

export type WorkerTarget = {
  index: number
  target: OcrTarget
}

export type OcrPoolWorkerOptions = Pick<
  RunOcrPagePoolOptions,
  'requestedTargets' | 'targetsToRun' | 'providerConcurrency' | 'localConcurrency' | 'getTargetConcurrency' | 'processPage' | 'classifyFailure' | 'onCheckpoint'
>
