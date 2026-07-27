import type { OutputFormat } from '~/types'

export type OcrOutputFormat = OutputFormat

export type TesseractOcrResult = {
  text: string
  confidence?: number
}
