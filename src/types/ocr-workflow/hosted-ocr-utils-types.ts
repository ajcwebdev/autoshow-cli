import type { PageResult } from '~/types'
export type HostedOcrImageResult = {
  page: PageResult
  promptTokens?: number
  completionTokens?: number
}
