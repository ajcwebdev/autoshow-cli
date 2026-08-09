import { expect, beforeAll, afterAll } from 'bun:test'
import { runCommand, findLatestDirectory, cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from '../../../../../../test-utils/test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../../test-utils/budget'
import { runCommandAndExpectOutputDir } from '../../../../../../test-utils/service-test-kit'
import { assertSttExtractRun } from '../../../../../../test-utils/assert-stt-extract-run'
import { stripAnsi } from '~/utils/terminal-colors'

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

budgetedTest('transcribe-whisper-tiny', 'default transcribe processes local audio', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'default transcribe processes local audio'
  const outputDir = await runCommandAndExpectOutputDir(
    STABLE_EXAMPLE_AUDIO_TITLE,
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL],
    { testName }
  )

  await assertSttExtractRun(outputDir, {
    transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
    target: { service: 'whisper', model: 'tiny', local: true, origin: 'default' },
    modelMatch: { contains: 'ggml-tiny' },
    expectPrompt: true,
    resolvedStep2: true,
    providerStates: true,
    splitSegmentsDir: false
  })
}, E2E_TEST_TIMEOUT_MS)

for (const modelCase of [
  { model: 'base', metadataSuffix: 'ggml-base' },
  { model: 'tiny', metadataSuffix: 'ggml-tiny' },
]) {
  const budgetKey = modelCase.model === 'base' ? 'transcribe-whisper-base' : 'transcribe-whisper-tiny'

  budgetedTest(budgetKey, `whisper ${modelCase.model} model transcribes local audio`, async () => {
    await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

    const testName = `whisper ${modelCase.model} model transcribes local audio`
    const outputDir = await runCommandAndExpectOutputDir(
      STABLE_EXAMPLE_AUDIO_TITLE,
      ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', `whisper=${modelCase.model}`],
      { testName }
    )

    await assertSttExtractRun(outputDir, {
      transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
      target: { service: 'whisper', model: modelCase.model, local: true, origin: 'explicit' },
      modelMatch: { contains: modelCase.metadataSuffix },
      expectPrompt: true,
      resolvedStep2: true,
      providerStates: true,
      splitSegmentsDir: false
    })
  }, E2E_TEST_TIMEOUT_MS)
}

budgetedTest('transcribe-whisper-split', 'split mode processes audio in segments', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'split mode processes audio in segments'
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--split', '--provider', 'whisper=tiny'],
    { testName }
  )

  expect(result.exitCode).toBe(0)
  expect(stripAnsi(result.stderr)).toContain('STT Segment')

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    await assertSttExtractRun(outputDir, {
      transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
      target: { service: 'whisper', model: 'tiny', local: true, origin: 'explicit' },
      modelMatch: { contains: 'ggml-tiny' },
      expectPrompt: true,
      resolvedStep2: true,
      providerStates: true,
      splitSegmentsDir: 'split-attempts/pass_001/segments'
    })
  }
}, E2E_TEST_TIMEOUT_MS)
