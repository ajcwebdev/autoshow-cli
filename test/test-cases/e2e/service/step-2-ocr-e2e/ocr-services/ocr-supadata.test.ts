import { expect } from 'bun:test'
import { rm } from 'node:fs/promises'
import { budgetedTest } from '../../../../../test-utils/budget'
import { runCommand, fileExists } from '../../../../../test-utils/test-helpers'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../../test-utils/service-test-kit'
import type { OcrE2eExtractMetadata } from '~/types'

const articleUrl = 'https://ajcwebdev.com'

budgetedTest('extract-supadata-url', 'bun autoshow extract https://ajcwebdev.com --url-provider supadata', async () => {
  await requireConfiguredEnvVar('SUPADATA_API_KEY', 'SUPADATA_API_KEY not configured')

  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'supadata'],
      { testName: 'bun autoshow extract https://ajcwebdev.com --url-provider supadata' }
    )
    expect(result.exitCode).toBe(0)

    outputDir = result.outputDir
    if (!outputDir) {
      throw new Error('Expected output directory for supadata URL extraction')
    }

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+supadata')
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
