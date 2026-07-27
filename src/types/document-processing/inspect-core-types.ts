import type { EpubTocItem } from '~/types'

export type TocBoundary = {
  tocItem: EpubTocItem
  startOffset: number
  tocOrder: number
}
