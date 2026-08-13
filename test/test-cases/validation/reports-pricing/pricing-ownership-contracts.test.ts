import { describe, expect, test } from 'bun:test'
import { buildDocumentPrompt } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-write-prompt'

describe('pricing and prompt ownership contracts', () => {
  test('provider-neutral pricing utilities never import CLI command implementations', async () => {
    const offenders: string[] = []
    const glob = new Bun.Glob('src/utils/pricing/**/*.ts')
    for await (const file of glob.scan({ cwd: process.cwd() })) {
      const source = await Bun.file(file).text()
      if (/from\s+['"]~\/cli\/commands\//.test(source)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })

  test('retired deep OCR helper paths are absent', async () => {
    expect(await Bun.file('src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/doc-prompt-utils.ts').exists()).toBe(false)
    expect(await Bun.file('src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing.ts').exists()).toBe(false)
  })

  test('the Step 1 document-write prompt preserves the established prompt contract', () => {
    const prompt = buildDocumentPrompt('Body text', {
      title: 'Example',
      slug: 'example',
      author: 'Author',
      pageCount: 2,
      format: 'pdf',
      fileSize: 123
    }, 'Summarize faithfully.')
    expect(prompt).toContain('title: "Example"')
    expect(prompt).toContain('author: "Author"')
    expect(prompt).toContain('Summarize faithfully.')
    expect(prompt).toEndWith('Document Text:\nBody text')
  })
})
