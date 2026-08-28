export type OcrOutputFormat = 'text' | 'tsv'

export type TesseractOcrResult = {
  text: string
  confidence?: number
}
