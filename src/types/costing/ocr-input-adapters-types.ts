type OcrInputFamily =
  | 'html'
  | 'epub'
  | 'office'
  | 'rtf'
  | 'csv'
  | 'cbz'
  | 'image'
  | 'pdf'

export type OcrInputAdapter = {
  family: OcrInputFamily
}
