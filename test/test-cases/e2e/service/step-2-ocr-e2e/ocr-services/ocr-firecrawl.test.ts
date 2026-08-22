import { expect } from 'bun:test'
import { budgetedTest } from '../../../../../test-utils/budget'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { cleanupOutputDir } from '../../../../../test-utils/test-helpers'
import {
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir
} from '../../../../../test-utils/service-test-kit'
import type { OcrE2eExtractMetadata } from '~/types'
import { expectArtifact } from '../../../../../test-utils/value-assertions'

const articleUrl = 'https://ajcwebdev.com'

budgetedTest('extract-firecrawl-url', 'bun autoshow extract https://ajcwebdev.com --provider firecrawl', async () => {
  await requireConfiguredEnvVar('FIRECRAWL_API_KEY', 'FIRECRAWL_API_KEY not configured')

  let outputDir: string | null = null

  try {
    outputDir = await runCommandAndExpectOutputDir(
      'Firecrawl URL extraction',
      ['src/cli/create-cli.ts', 'extract', articleUrl, '--provider', 'firecrawl'],
      { testName: 'bun autoshow extract https://ajcwebdev.com --provider firecrawl' }
    )

    await expectArtifact(`${outputDir}/extraction.txt`)

    const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+firecrawl')
  } finally {
    await cleanupOutputDir(outputDir)
  }
})
