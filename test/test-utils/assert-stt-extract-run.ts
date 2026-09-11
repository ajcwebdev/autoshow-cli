import { expect } from 'bun:test'
import { requireCondition } from './require-condition'
import { artifactExists as fileExists, assertContains } from '../scenarios/local-cli-contracts'
import { readCanonicalRecord } from './manifest-helpers'
import type { SttExtractRunExpectation } from '~/types'

export const assertSttExtractRun = async (
  outputDir: string,
  expectation: SttExtractRunExpectation,
  readRecord = readCanonicalRecord
): Promise<void> => {
  expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

  const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
  requireCondition(transcriptContent.length > 0)
  if (typeof expectation.transcriptMatch === 'string') {
    requireCondition(transcriptContent.includes(expectation.transcriptMatch))
  } else {
    expect(transcriptContent).toMatch(expectation.transcriptMatch)
  }

  expect(await fileExists(`${outputDir}/result.json`)).toBe(true)
  expect(await fileExists(`${outputDir}/transcription.evidence.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/transcription.raw.json`)).toBe(false)
  expect(await fileExists(`${outputDir}/prompt.md`)).toBe(expectation.expectPrompt)
  expect(await fileExists(`${outputDir}/text.json`)).toBe(false)

  const metadata = await readRecord(outputDir)
  const step2 = metadata['step2'] as { transcriptionService?: string, transcriptionModel?: string } | undefined
  expect(step2?.transcriptionService).toBe(expectation.target.service)
  if (expectation.modelMatch.equals !== undefined) {
    expect(step2?.transcriptionModel).toBe(expectation.modelMatch.equals)
  } else {
    requireCondition(expectation.modelMatch.contains, 'Expected a nonempty model descriptor')
    requireCondition(step2?.transcriptionModel?.includes(expectation.modelMatch.contains))
  }

  const { service, model, local, origin } = expectation.target
  if (expectation.resolvedStep2) {
    assertContains(metadata['resolvedStep2'], {
      route: 'stt',
      sourceKind: 'media',
      providers: [{ service, model, origin }]
    })
  }
  assertContains(metadata['requestedProviders'], [{ service, model, local }])
  if (expectation.providerStates) {
    assertContains(metadata['providerStates'], [{
      service,
      model,
      local,
      artifactDir: '.',
      status: 'succeeded'
    }])
  }
  expect(metadata['missingProviders']).toStrictEqual([])

  if (expectation.splitSegmentsDir !== false) {
    expect(await fileExists(`${outputDir}/${expectation.splitSegmentsDir}`)).toBe(true)
  }
}
