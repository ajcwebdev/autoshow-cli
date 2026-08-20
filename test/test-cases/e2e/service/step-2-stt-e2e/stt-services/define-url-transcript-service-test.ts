import { join } from 'node:path'
import { expect } from 'bun:test'
import { E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import { fileExists, isRecord, toRecordArray } from '../../../../../test-utils/test-helpers'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { expectArtifact } from '../../../../../test-utils/value-assertions'
import {
  defineBudgetedLiveServiceTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir
} from '../../../../../test-utils/service-test-kit'

const YOUTUBE_TRANSCRIPT_URL = 'https://www.youtube.com/watch?v=u1-WHqATSQU'
const YOUTUBE_TRANSCRIPT_TITLE = 'u1-WHqATSQU'

const findStep2Metadata = (
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Record<string, unknown> | undefined => {
  const step2 = metadata['step2']
  if (isRecord(step2)) {
    return step2
  }
  return toRecordArray(step2).find((entry) =>
    entry['transcriptionService'] === service && entry['transcriptionModel'] === model
  )
}

const resolveTranscriptArtifactDir = async (
  outputDir: string,
  metadata: Record<string, unknown>,
  service: string,
  model: string
): Promise<string> => {
  const providerState = toRecordArray(metadata['providerStates']).find((entry) =>
    entry['service'] === service && entry['model'] === model
  )
  const artifactDir = providerState && typeof providerState['artifactDir'] === 'string'
    ? providerState['artifactDir']
    : undefined

  if (artifactDir) {
    return join(outputDir, artifactDir)
  }

  if (await fileExists(join(outputDir, 'transcription.txt'))) {
    return outputDir
  }

  return join(outputDir, 'providers', `${service}-${model}`)
}

export const defineUrlTranscriptServiceTest = ({
  service,
  model,
  provider,
  envVarKey,
  envVarDescription,
}: {
  service: string
  model: string
  provider: string
  envVarKey: string
  envVarDescription: string
}): void => {
  const budgetKey = `transcribe-${service}-${model}`

  defineBudgetedLiveServiceTest(budgetKey, `${service} ${model} retrieves YouTube URL transcript`, [envVarKey], async () => {
    await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)

    const outputDir = await runCommandAndExpectOutputDir(YOUTUBE_TRANSCRIPT_TITLE, [
      'src/cli/create-cli.ts',
      'extract',
      YOUTUBE_TRANSCRIPT_URL,
      '--provider',
      `${provider}=${model}`
    ])

    await expectArtifact(join(outputDir, PIPELINE_MANIFEST_FILE))

    const metadata = await readCanonicalRecord(outputDir)
    const step2 = findStep2Metadata(metadata, service, model)
    expect(step2?.['transcriptionService']).toBe(service)
    expect(step2?.['transcriptionModel']).toBe(model)

    const artifactDir = await resolveTranscriptArtifactDir(outputDir, metadata, service, model)
    const transcriptPath = join(artifactDir, 'transcription.txt')
    await expectArtifact(transcriptPath)
    expect((await Bun.file(transcriptPath).text()).length).toBeGreaterThan(0)
    await expectArtifact(join(artifactDir, 'result.json'))
  }, E2E_TEST_TIMEOUT_MS)
}
