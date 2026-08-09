import { beforeAll, afterAll } from 'bun:test'
import { cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from '../../../../../../test-utils/test-helpers'
import { budgetedTest } from '../../../../../../test-utils/budget'
import { runCommandAndExpectOutputDir } from '../../../../../../test-utils/service-test-kit'
import { assertSttExtractRun } from '../../../../../../test-utils/assert-stt-extract-run'

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

budgetedTest('transcribe-reverb', 'reverb processes local audio with speaker diarization', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'reverb processes local audio with speaker diarization'
  const outputDir = await runCommandAndExpectOutputDir(
    STABLE_EXAMPLE_AUDIO_TITLE,
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'reverb'],
    { testName }
  )

  await assertSttExtractRun(outputDir, {
    transcriptMatch: '[SPEAKER_',
    target: { service: 'reverb', model: 'reverb', local: true, origin: 'explicit' },
    modelMatch: { equals: 'reverb_asr_v1' },
    expectPrompt: true,
    resolvedStep2: true,
    providerStates: true,
    splitSegmentsDir: false
  })
})
