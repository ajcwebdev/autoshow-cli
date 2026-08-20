import { expect } from 'bun:test'
import { rm } from 'node:fs/promises'
import { budgetedTest } from '../../../../../test-utils/budget'
import { fileExists } from '../../../../../test-utils/test-helpers'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import {
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir
} from '../../../../../test-utils/service-test-kit'
import type { OcrE2eExtractMetadata } from '~/types'

const articleUrl = 'https://ajcwebdev.com'

budgetedTest('extract-glm-reader-url', 'bun autoshow extract https://ajcwebdev.com --url-provider glm-reader', async () => {
  await requireConfiguredEnvVar('GLM_API_KEY', 'GLM_API_KEY not configured')

  let outputDir: string | null = null

  try {
    const args = ['src/cli/create-cli.ts', 'extract', articleUrl, '--url-provider', 'glm-reader']
    outputDir = await runCommandAndExpectOutputDir(
      'GLM Reader URL extraction',
      args,
      { testName: 'bun autoshow extract https://ajcwebdev.com --url-provider glm-reader' }
    )

    expect(await fileExists(`${outputDir}/extraction.txt`)).toBe(true)

    const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+glm-reader')
  } finally {
    if (outputDir && process.env['AUTOSHOW_TEST_PRESERVE_ARTIFACTS'] === '0') {
      await rm(outputDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
