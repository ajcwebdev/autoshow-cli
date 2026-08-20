import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { DocumentMetadata } from '~/types'
import { REPLICATE_DEEPSEEK_OCR_VERSION, runReplicateOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/replicate-ocr/run-replicate-ocr'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['REPLICATE_API_TOKEN'],
  tempPrefix: 'autoshow-replicate-ocr-'
})

describe('Replicate DeepSeek OCR contracts', () => {
  test('pins the reviewed deployment and serializes its image-to-Markdown request', async () => {
    process.env['REPLICATE_API_TOKEN'] = 'replicate-test-token'
    const calls = installMockFetch(() => Response.json({ id: 'prediction-1', status: 'succeeded', output: '# Parsed document' }))

    await tempDirs.withDir(async (dir) => {
      const imagePath = join(dir, 'page.png')
      await writeFile(imagePath, new Uint8Array([1, 2, 3]))
      const metadata: DocumentMetadata = { slug: 'page', pageCount: 1, format: 'png', fileSize: 3 }

      const result = await runReplicateOcr(imagePath, metadata, 'lucataco/deepseek-ocr')

      expect(result.pages).toEqual([{ pageNumber: 0, method: 'ocr', text: '# Parsed document' }])
      expect(calls.map((call) => ({ url: call.url, body: call.bodyJson }))).toEqual([{
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
    })
  })
})
