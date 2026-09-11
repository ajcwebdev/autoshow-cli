import { beforeAll, afterAll } from 'bun:test'
import { cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from '../../../../../test-utils/test-helpers'
import { budgetedTest, LONG_E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import { runCommandAndExpectOutputDir } from '../../../../../test-utils/service-test-kit'
import { assertSttExtractRun } from '../../../../../test-utils/assert-stt-extract-run'

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
})

export const WHISPERFILE_TEST_CASES = [
  { budgetKey: 'transcribe-whisperfile-tiny', id: 'tiny', model: 'tiny', args: ['--provider', 'whisperfile=tiny'], origin: 'explicit' },
  { budgetKey: 'transcribe-whisperfile-tiny.en', id: 'tiny.en', model: 'tiny.en', args: ['--provider', 'whisperfile=tiny.en'], origin: 'explicit' },
  { budgetKey: 'transcribe-whisperfile-small', id: 'small', model: 'small', args: ['--provider', 'whisperfile=small'], origin: 'explicit' },
  { budgetKey: 'transcribe-whisperfile-small.en', id: 'small.en', model: 'small.en', args: ['--provider', 'whisperfile=small.en'], origin: 'explicit' },
  { budgetKey: 'transcribe-whisperfile-default', id: 'default', model: 'tiny', args: [], origin: 'default' },
  { budgetKey: 'transcribe-whisperfile-omitted-model', id: 'omitted-model', model: 'tiny', args: ['--provider', 'whisperfile'], origin: 'explicit' },
  { budgetKey: 'transcribe-whisperfile-split', id: 'split', model: 'tiny', args: ['--provider', 'whisperfile=tiny', '--split'], origin: 'explicit' },
] as const

for (const { budgetKey, ...entry } of WHISPERFILE_TEST_CASES) budgetedTest(budgetKey, `whisperfile ${entry.id} transcribes local audio`, async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  const outputDir = await runCommandAndExpectOutputDir(
    STABLE_EXAMPLE_AUDIO_TITLE,
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, ...entry.args],
    { testName: `whisperfile ${entry.id}`, timeoutMs: LONG_E2E_TEST_TIMEOUT_MS }
  )
  await assertSttExtractRun(outputDir, {
    transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
    target: { service: 'whisperfile', model: entry.model, local: true, origin: entry.origin },
    modelMatch: { contains: `whisper-${entry.model}.llamafile` },
    expectPrompt: true, resolvedStep2: true, providerStates: true,
    splitSegmentsDir: entry.id === 'split' ? 'split-attempts/pass_001/segments' : false
  })
}, LONG_E2E_TEST_TIMEOUT_MS)
