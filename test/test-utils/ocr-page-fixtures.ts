import type { PageResult } from '~/types'

export const pagesForOcrRange = (startPage: number, endPage: number): PageResult[] => {
  const pages: PageResult[] = []
  for (let pageNumber = 1; pageNumber <= endPage - startPage + 1; pageNumber++) {
    pages.push({
      pageNumber,
      method: 'ocr',
      text: `page ${startPage + pageNumber - 1}`
    })
  }
  return pages
}
