import { dirname } from 'node:path'
import { validateGlmOcrModel } from '~/cli/commands/setup-and-utilities/models/ocr-models'
import type { ChatImageOcrOptions, DocumentMetadata } from '~/types'
import { runGlmVisionOcr } from './glm-vision-ocr'

export const runGlmOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  options: Partial<ChatImageOcrOptions> = {}
) => {
  validateGlmOcrModel(model)
  const run = await runGlmVisionOcr(filePath, step1Metadata, model, {
    ...options,
    dpi: options.dpi ?? 144,
    outputDir: options.outputDir ?? dirname(filePath)
  })
  return { ...run, markdown: run.pages.map(page => page.text).join('\n\n') }
}
