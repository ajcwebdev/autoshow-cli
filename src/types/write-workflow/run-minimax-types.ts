import type { OpenAIChatCompletionResponse } from '~/types'

export type MiniMaxChatCompletionResponse = OpenAIChatCompletionResponse & {
  base_resp?: {
    status_code?: number | undefined
    status_msg?: string | undefined
  } | undefined
}
