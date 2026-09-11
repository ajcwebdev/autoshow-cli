import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../../test-utils/rest-contract-helpers'

export { installMockFetch as installFetch, jsonResponse }

export const setupCaptionContractLifecycle = () => {
  const tracker = setupContractSuiteLifecycle({
    envKeys: ['OPENAI_API_KEY', 'XAI_API_KEY', 'KIMI_API_KEY', 'DEEPGRAM_API_KEY', 'DEEPINFRA_API_KEY', 'MINIMAX_API_KEY', 'TOGETHER_API_KEY', 'ASSEMBLYAI_API_KEY', 'SPEECHMATICS_API_KEY', 'MISTRAL_API_KEY'],
    tempPrefix: 'autoshow-caption-contract-',
    restoreBunSleep: true,
    beforeEachExtra: () => {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    }
  })
  return { withTempDir: tracker.withDir }
}
