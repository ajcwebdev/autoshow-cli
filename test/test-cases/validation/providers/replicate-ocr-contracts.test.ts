import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { REPLICATE_DEEPSEEK_OCR_VERSION, runReplicateOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/replicate-ocr/run-replicate-ocr'

const originalFetch = globalThis.fetch
const originalToken = process.env['REPLICATE_API_TOKEN']

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalToken === undefined) delete process.env['REPLICATE_API_TOKEN']
  else process.env['REPLICATE_API_TOKEN'] = originalToken
})

describe('Replicate DeepSeek OCR contracts', () => {
  test('pins the reviewed deployment and serializes its image-to-Markdown request', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-test-token'
    const calls: Array<{ url: string, body: Record<string, unknown> }> = []
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> })
      return Response.json({ id: 'prediction-1', status: 'succeeded', output: '# Parsed document' })
    }) as typeof fetch

    const dir = await mkdtemp(join(tmpdir(), 'autoshow-replicate-ocr-'))
    try {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = { slug: 'page', pageCount: 1, format: 'png', fileSize: 3 }

      const result = await runReplicateOcr(imagePath, metadata, 'lucataco/deepseek-ocr')

      expect(result.pages).toEqual([{ pageNumber: 0, method: 'ocr', text: '# Parsed document' }])
      expect(calls).toEqual([{
        url: 'https://api.replicate.com/v1/predictions',
        body: {
          version: `lucataco/deepseek-ocr:${REPLICATE_DEEPSEEK_OCR_VERSION}`,
          input: {
            image: `data:image/png;base64,${Buffer.from(new Uint8Array([1, 2, 3])).toString('base64')}`,
            task_type: 'Convert to Markdown',
            reference_text: '',
            resolution_size: 'Gundam (Recommended)'
          }
        }
      }])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
