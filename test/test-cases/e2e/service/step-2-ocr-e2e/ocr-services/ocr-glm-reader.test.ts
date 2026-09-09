import { expect } from 'bun:test'

import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { cleanupOutputDir } from '../../../../../test-utils/test-helpers'
import {
  defineBudgetedLiveServiceTest,
  runCommandAndExpectOutputDir
} from '../../../../../test-utils/service-test-kit'
import type { OcrE2eExtractMetadata } from '~/types'
import { expectArtifact } from '../../../../../test-utils/value-assertions'

const articleUrl = 'https://ajcwebdev.com'

defineBudgetedLiveServiceTest('extract-glm-reader-url', 'bun autoshow extract https://ajcwebdev.com --provider glm-reader', ['GLM_API_KEY'], async () => {
  let outputDir: string | null = null

  try {
    const args = ['src/cli/create-cli.ts', 'extract', articleUrl, '--provider', 'glm-reader']
    outputDir = await runCommandAndExpectOutputDir(
      'GLM Reader URL extraction',
      args,
      { testName: 'bun autoshow extract https://ajcwebdev.com --provider glm-reader' }
    )

    await expectArtifact(`${outputDir}/extraction.txt`)

    const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+glm-reader')
  } finally {
    await cleanupOutputDir(outputDir)
  }
})
