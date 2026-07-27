import type { AnthropicRestConfig, RestFetchOptionsBase } from '~/types'

export type AnthropicFetchOptions = RestFetchOptionsBase<AnthropicRestConfig> & {
  beta?: string | string[] | undefined
}
