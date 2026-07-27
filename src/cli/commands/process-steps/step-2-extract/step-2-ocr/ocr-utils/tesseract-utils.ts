import type { OcrOutputFormat, TesseractOcrResult } from '~/types'
import { exec } from '~/utils/cli-utils'
import { getTesseractBinary, hasRuntimeTool, resolveTessdataPrefix } from '~/utils/runtime-paths'
import { setupTesseractOcr } from '../ocr-local/tesseract-setup'
import { InfraError } from '~/utils/error-handler'

const parseTsvConfidence = (tsv: string): number | undefined => {
  const rows = tsv.split('\n').map(r => r.trim()).filter(Boolean)
  if (rows.length <= 1) return undefined
  let total = 0
  let count = 0
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]?.split('\t')
    const conf = cols?.[10]
    if (!conf) continue
    const num = Number.parseFloat(conf)
    if (Number.isFinite(num) && num >= 0) {
      total += num
      count++
    }
  }
  if (count === 0) return undefined
  return total / count
}

export const ensureTesseractSetup = async (): Promise<void> => {
  if (hasRuntimeTool('tesseract')) return
  await setupTesseractOcr()
}

export const ocrImage = async (
  imagePath: string,
  lang: string,
  outputFormat: OcrOutputFormat
): Promise<TesseractOcrResult> => {
  await ensureTesseractSetup()
  const args = [imagePath, 'stdout', '-l', lang, '--oem', '1', '--psm', '3']
  if (outputFormat === 'tsv' || outputFormat === 'hocr') {
    args.push(outputFormat)
  }
  const result = await exec(getTesseractBinary(), args, {
    env: {
      OMP_THREAD_LIMIT: '2',
      TESSDATA_PREFIX: resolveTessdataPrefix()
    },
    retry: { operationName: 'Tesseract OCR' }
  })
  if (result.exitCode !== 0) {
    throw InfraError(result.stderr || `OCR failed for ${imagePath}`, { stage: 'ocr:tesseract' })
  }
  if (outputFormat === 'tsv') {
    const confidence = parseTsvConfidence(result.stdout)
    return {
      text: result.stdout,
      ...(confidence !== undefined ? { confidence } : {})
    }
  }
  return { text: result.stdout }
}
