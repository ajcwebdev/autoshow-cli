import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata, StructuredRequestOptions } from '~/types'
import {
  installMockFetch,
  jsonResponse,
  setupContractSuiteLifecycle
} from '../../../../test-utils/rest-contract-helpers'

const envKeys = [
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'KIMI_API_KEY',
  'DEEPGRAM_API_KEY',
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

/**
 * Writes one source document and its metadata into a temp dir. Every OCR contract
 * here starts from the same three-byte page; only the slug, format, and page count
 * vary, so those stay explicit at the call site.
 */
export const withOcrDocumentFixture = async <T,>(
  document: { slug: string, format: DocumentMetadata['format'], pageCount?: number | undefined, bytes?: Uint8Array | undefined },
  fn: (fixture: { dir: string, path: string, bytes: Uint8Array, metadata: DocumentMetadata }) => Promise<T>
): Promise<T> => await withTempDir(async (dir) => {
  const bytes = document.bytes ?? new Uint8Array([1, 2, 3])
  const path = join(dir, `${document.slug}.${document.format}`)
  await writeFile(path, bytes)
  const metadata: DocumentMetadata = {
    slug: document.slug,
    pageCount: document.pageCount ?? 1,
    format: document.format,
    fileSize: bytes.byteLength
  }
  return await fn({ dir, path, bytes, metadata })
})

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
  tempDirs = setupContractSuiteLifecycle({
    envKeys,
    tempPrefix: 'autoshow-openai-rest-',
    restoreBunSleep: true,
    beforeEachExtra: () => {
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async () => {}) as typeof Bun.sleep
    }
  })
}

export { jsonResponse }
