import type { AdvancedProviderHttpRequest } from '~/types'

export type SpeechifyAdvancedProviderOptions = {
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  now?: (() => string) | undefined
}
