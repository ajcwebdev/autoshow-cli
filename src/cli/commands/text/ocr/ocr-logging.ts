import type { OcrPagesProgress, OcrProviderLifecycle } from '~/types'
import * as l from '~/utils/app-logger/app-logger'

export const logOcrProviderLifecycle = (lifecycle: OcrProviderLifecycle): void => {
  const level = lifecycle.status === 'failed' ? 'warn' : 'info'
  l.write(level, `OCR provider ${lifecycle.provider}: ${lifecycle.status}`, {
    category: 'pipeline',
    metadata: lifecycle
  })
}

export const logOcrPagesProgress = (progress: OcrPagesProgress): void => {
  l.write('info', `OCR pages: ${progress.ocrPages}/${progress.totalPages}, ${progress.status}`, {
    category: 'pipeline',
    metadata: progress
  })
}
