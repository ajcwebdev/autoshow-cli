import type { StructuredRequestOptions } from '~/types'
import {
  installMockFetch,
  jsonResponse,
  setupContractSuiteLifecycle
} from '../../../../test-utils/rest-contract-helpers'

export const envKeys = [
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'KIMI_API_KEY',
  'DEEPINFRA_API_KEY',
  'MINIMAX_API_KEY',
  'CEREBRAS_API_KEY',
  'TOGETHER_API_KEY'
]
export const installFetch = installMockFetch
let tempDirs: ReturnType<typeof setupContractSuiteLifecycle> | undefined

export const withTempDir = async <T,>(fn: (dir: string) => Promise<T>): Promise<T> => {
  if (tempDirs === undefined) throw new Error('OpenAI REST contract lifecycle is not installed')
  return await tempDirs.withDir(fn)
}

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
  tempDirs = setupContractSuiteLifecycle({ envKeys, tempPrefix: 'autoshow-openai-rest-' })
}

export { jsonResponse }
