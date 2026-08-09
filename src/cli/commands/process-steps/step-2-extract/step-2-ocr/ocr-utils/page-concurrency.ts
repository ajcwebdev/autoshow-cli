import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'
import { InternalError } from '~/utils/error-handler'

export const normalizeOcrPageConcurrency = (
  concurrency: number | undefined,
  fallback = DEFAULT_OCR_CONCURRENCY
): number => {
  const value = typeof concurrency === 'number' && Number.isFinite(concurrency)
    ? Math.trunc(concurrency)
    : fallback
  return Math.max(1, value)
}

export const runOrderedOcrPageTasks = async <TInput, TResult>(
  inputs: readonly TInput[],
  concurrency: number | undefined,
  worker: (input: TInput, index: number) => Promise<TResult>,
  onResult?: (
    result: TResult,
    input: TInput,
    index: number,
    results: ReadonlyArray<TResult | undefined>
  ) => Promise<void> | void
): Promise<TResult[]> => {
  if (inputs.length === 0) {
    return []
  }

  const normalizedConcurrency = normalizeOcrPageConcurrency(concurrency)
  const results: Array<TResult | undefined> = new Array(inputs.length)
  let next = 0
  let stopped = false

  const runWorker = async (): Promise<void> => {
    while (true) {
      if (stopped) {
        return
      }

      const index = next
      next += 1
      if (index >= inputs.length) {
        return
      }

      const input = inputs[index] as TInput
      try {
        const result = await worker(input, index)
        results[index] = result
        await onResult?.(result, input, index, results)
      } catch (error) {
        stopped = true
        throw error
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, inputs.length) }, async () => {
      await runWorker()
    })
  )

  return results.map((result, index) => {
    if (result === undefined) {
      throw InternalError(`OCR page task ${index + 1} did not produce a result.`, { stage: 'ocr:page-concurrency' })
    }
    return result
  })
}
