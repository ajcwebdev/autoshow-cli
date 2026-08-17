/** Native Tesseract stdout modes: plain text, or TSV rows carrying per-word confidence. */
export type OcrOutputFormat = 'text' | 'tsv'

export type TesseractOcrResult = {
  text: string
  confidence?: number
}
