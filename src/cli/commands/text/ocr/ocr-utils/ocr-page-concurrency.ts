import { DEFAULT_OCR_CONCURRENCY } from '~/utils/concurrency-defaults'

export const normalizeOcrPageConcurrency = (
  concurrency: number | undefined,
  fallback = DEFAULT_OCR_CONCURRENCY
): number => {
  const value = typeof concurrency === 'number' && Number.isFinite(concurrency)
    ? Math.trunc(concurrency)
    : fallback
  return Math.max(1, value)
}
