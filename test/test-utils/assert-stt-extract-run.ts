import assert from 'node:assert/strict'
import { artifactExists as fileExists, assertContains } from '../scenarios/local-cli-contracts'
import { readCanonicalRecord } from './manifest-helpers'
import type { SttExtractRunExpectation } from '~/types'

export const assertSttExtractRun = async (
  outputDir: string,
  expectation: SttExtractRunExpectation,
  readRecord = readCanonicalRecord
): Promise<void> => {
  assert.equal(await fileExists(`${outputDir}/transcription.txt`), true)

  const transcriptContent = await Bun.file(`${outputDir}/transcription.txt`).text()
  assert(transcriptContent.length > 0)
  if (typeof expectation.transcriptMatch === 'string') {
    assert(transcriptContent.includes(expectation.transcriptMatch))
  } else {
    assert.match(transcriptContent, expectation.transcriptMatch)
  }

  assert.equal(await fileExists(`${outputDir}/result.json`), true)
  assert.equal(await fileExists(`${outputDir}/transcription.evidence.json`), false)
  assert.equal(await fileExists(`${outputDir}/transcription.raw.json`), false)
  assert.equal(await fileExists(`${outputDir}/prompt.md`), expectation.expectPrompt)
  assert.equal(await fileExists(`${outputDir}/text.json`), false)

  const metadata = await readRecord(outputDir)
  const step2 = metadata['step2'] as { transcriptionService?: string, transcriptionModel?: string } | undefined
  assert.equal(step2?.transcriptionService, expectation.target.service)
  if (expectation.modelMatch.equals !== undefined) {
    assert.equal(step2?.transcriptionModel, expectation.modelMatch.equals)
  } else {
    assert(expectation.modelMatch.contains, 'Expected a nonempty model descriptor')
    assert(step2?.transcriptionModel?.includes(expectation.modelMatch.contains))
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
  assert.deepEqual(metadata['missingProviders'], [])

  if (expectation.splitSegmentsDir !== false) {
    assert.equal(await fileExists(`${outputDir}/${expectation.splitSegmentsDir}`), true)
  }
}
