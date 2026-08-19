import { expect } from 'bun:test'
import { fileExists } from './test-helpers'
import { readCanonicalRecord } from './manifest-helpers'
import type { SttExtractRunExpectation } from '~/types'

export const assertSttExtractRun = async (
  outputDir: string,
  expectation: SttExtractRunExpectation
): Promise<void> => {
  expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

  const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
  expect(transcriptContent.length).toBeGreaterThan(0)
  if (typeof expectation.transcriptMatch === 'string') {
    expect(transcriptContent).toContain(expectation.transcriptMatch)
  } else {
    expect(transcriptContent).toMatch(expectation.transcriptMatch)
  }

  expect(await fileExists(`${outputDir}/result.json`)).toBe(true)
  expect(await fileExists(`${outputDir}/transcription.evidence.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/transcription.raw.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/prompt.md`)).toBe(expectation.expectPrompt)
  expect(await fileExists(`${outputDir}/text.json`)).toBe(false)

  const metadata = await readCanonicalRecord(outputDir)
  const step2 = metadata['step2'] as { transcriptionService?: string, transcriptionModel?: string } | undefined
  expect(step2?.transcriptionService).toBe(expectation.target.service)
  if (expectation.modelMatch.equals !== undefined) {
    expect(step2?.transcriptionModel).toBe(expectation.modelMatch.equals)
  } else {
    expect(step2?.transcriptionModel).toContain(expectation.modelMatch.contains)
  }

  const { service, model, local, origin } = expectation.target
  if (expectation.resolvedStep2) {
    expect(metadata['resolvedStep2']).toMatchObject({
      route: 'stt',
      sourceKind: 'media',
      providers: [{ service, model, origin }]
    })
  }
  expect(metadata['requestedProviders']).toMatchObject([{ service, model, local }])
  if (expectation.providerStates) {
    expect(metadata['providerStates']).toMatchObject([{
      service,
      model,
      local,
      artifactDir: '.',
      status: 'succeeded'
    }])
  }
  expect(metadata['missingProviders']).toEqual([])

  if (expectation.splitSegmentsDir !== false) {
    expect(await fileExists(`${outputDir}/${expectation.splitSegmentsDir}`)).toBe(true)
  }
}
