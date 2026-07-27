import type { SttCompletionContextBase } from '~/types'

export type YoutubeCaptionCompletionContext = SttCompletionContextBase & {
  sourceUrl?: string | undefined
}
