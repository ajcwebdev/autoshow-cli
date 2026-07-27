import { afterEach, beforeEach } from 'bun:test'
import type { StructuredRequestOptions } from '~/types'
import {
  clearEnv,
  createTempDirTracker,
  installMockFetch,
  jsonResponse,
  restoreEnv,
  snapshotEnv
} from '../../../../test-utils/rest-contract-helpers'
import type { EnvSnapshot } from '~/types'

export const originalFetch = globalThis.fetch
export const envKeys = [
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'KIMI_API_KEY',
  'MINIMAX_API_KEY',
  'CEREBRAS_API_KEY',
  'TOGETHER_API_KEY'
]
export const tempDirs = createTempDirTracker('autoshow-openai-rest-')
export const withTempDir = tempDirs.withDir
export const installFetch = installMockFetch

export const structuredOpts: StructuredRequestOptions = {
  schemaName: 'summary',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary'],
    properties: {
      summary: { type: 'string' }
    }
  },
  strict: true,
  strategy: 'native'
}

export const installOpenAIRestContractHooks = (): void => {
  let previousEnv: EnvSnapshot = {}

  beforeEach(() => {
    previousEnv = snapshotEnv(envKeys)
    clearEnv(envKeys)
  })

  afterEach(async () => {
    globalThis.fetch = originalFetch
    restoreEnv(previousEnv)
    await tempDirs.cleanup()
  })
}

export { jsonResponse }
