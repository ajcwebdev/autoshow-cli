import type { AdvancedProviderHttpRequest } from '~/types'

export type HumeVoiceCatalogEnvelope = Readonly<{
  voices: unknown[]
  pageNumber: number
  totalPages: number
}>

export type HumeAdvancedProviderOptions = {
  apiKey: string
  request?: AdvancedProviderHttpRequest | undefined
  now?: (() => string) | undefined
}
