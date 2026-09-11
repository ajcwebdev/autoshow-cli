import { bytesResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

export const imageResponse = (bytes: Uint8Array, contentType: string, headers?: Record<string, string>): Response =>
  bytesResponse(bytes, { headers: { 'content-type': contentType, ...headers } })

export const setupImageRestContractLifecycle = () => setupContractSuiteLifecycle({
  envKeys: ['BFL_API_KEY', 'LUMA_AGENTS_API_KEY', 'REPLICATE_API_TOKEN'],
  tempPrefix: 'autoshow-image-provider-rest-',
  restoreBunSleep: true,
  beforeEachExtra: () => {
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
  }
})
