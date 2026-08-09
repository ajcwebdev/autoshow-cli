import { beforeAll, afterAll } from 'bun:test'
import { cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from '../../../../../../test-utils/test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../../test-utils/budget'
import { runCommandAndExpectOutputDir } from '../../../../../../test-utils/service-test-kit'
import { assertSttExtractRun } from '../../../../../../test-utils/assert-stt-extract-run'

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

budgetedTest('transcribe-whisperfile-tiny', 'whisperfile transcribes local audio', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'whisperfile transcribes local audio'
  const outputDir = await runCommandAndExpectOutputDir(
    STABLE_EXAMPLE_AUDIO_TITLE,
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'whisperfile=tiny'],
    { testName }
  )

  await assertSttExtractRun(outputDir, {
    transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
    target: { service: 'whisperfile', model: 'tiny', local: true, origin: 'explicit' },
    modelMatch: { contains: 'whisper-tiny.llamafile' },
    expectPrompt: true,
    resolvedStep2: true,
    providerStates: true,
    splitSegmentsDir: false
  })
}, E2E_TEST_TIMEOUT_MS)
