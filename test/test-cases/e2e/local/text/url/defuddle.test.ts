import { test, expect } from 'bun:test'
import { cleanupOutputDir, runCommand } from '../../../../../test-utils/test-helpers'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { expectArtifact } from '../../../../../test-utils/value-assertions'
import type { OcrE2eExtractMetadata } from '~/types'

const articleUrl = 'https://ajcwebdev.com'

const requireOutputDir = (outputDir: string | null, title: string): string => {
  if (!outputDir) throw new Error(`Expected output directory for ${title}`)
  return outputDir
}

test('bun autoshow extract https://ajcwebdev.com --provider defuddle', async () => {
  let outputDir: string | null = null

  try {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', articleUrl, '--provider', 'defuddle'],
      { testName: 'bun autoshow extract https://ajcwebdev.com --provider defuddle' }
    )
    expect(result.exitCode).toBe(0)

    outputDir = requireOutputDir(result.outputDir, 'defuddle URL extraction')

    await expectArtifact(`${outputDir}/extraction.txt`)

    const metadata = await readCanonicalRecord(outputDir) as OcrE2eExtractMetadata
    expect(metadata.step1?.format).toBe('html')
    expect(metadata.step2?.extractionMethod).toBe('html+defuddle')
    expect(metadata.resolvedStep2).toMatchObject({
      route: 'article',
      sourceKind: 'article',
      providers: [{ service: 'defuddle', model: 'defuddle' }]
    })
    expect(metadata.requestedProviders).toEqual([{ service: 'defuddle', model: 'defuddle' }])
  } finally {
    await cleanupOutputDir(outputDir)
  }
})
