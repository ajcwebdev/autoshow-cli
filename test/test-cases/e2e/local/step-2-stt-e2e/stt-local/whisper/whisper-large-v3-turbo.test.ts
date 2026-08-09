import { beforeAll, afterAll } from 'bun:test'
import { cleanupTestOutput, STABLE_EXAMPLE_AUDIO_URL, STABLE_EXAMPLE_AUDIO_TITLE } from '../../../../../../test-utils/test-helpers'
import { budgetedTest } from '../../../../../../test-utils/budget'
import { runCommandAndExpectOutputDir } from '../../../../../../test-utils/service-test-kit'
import { assertSttExtractRun } from '../../../../../../test-utils/assert-stt-extract-run'

const videoInputPath = 'https://ajc.pics/autoshow/examples/2-video.mp4'
const videoTitleSuffix = '2-video'

const cleanupVideoOutput = async () => {
  await cleanupTestOutput(videoTitleSuffix)
}

beforeAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  await cleanupVideoOutput()
})

afterAll(async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  await cleanupVideoOutput()
})

budgetedTest('transcribe-whisper-large-v3-turbo', 'whisper large-v3-turbo model transcribes local audio', async () => {
  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const testName = 'whisper large-v3-turbo model transcribes local audio'
  const outputDir = await runCommandAndExpectOutputDir(
    STABLE_EXAMPLE_AUDIO_TITLE,
    ['src/cli/create-cli.ts', 'extract', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'whisper=large-v3-turbo'],
    { testName }
  )

  await assertSttExtractRun(outputDir, {
    transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
    target: { service: 'whisper', model: 'large-v3-turbo', local: true, origin: 'explicit' },
    modelMatch: { contains: 'ggml-large-v3-turbo' },
    expectPrompt: true,
    resolvedStep2: true,
    providerStates: true,
    splitSegmentsDir: false
  })
})

budgetedTest('transcribe-whisper-tiny-split', 'whisper tiny with split processes video input', async () => {
  await cleanupVideoOutput()

  const testName = 'whisper tiny with split processes video input'
  const outputDir = await runCommandAndExpectOutputDir(
    videoTitleSuffix,
    ['src/cli/create-cli.ts', 'extract', videoInputPath, '--provider', 'whisper=tiny', '--split'],
    { testName }
  )

  await assertSttExtractRun(outputDir, {
    transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
    target: { service: 'whisper', model: 'tiny', local: true, origin: 'explicit' },
    modelMatch: { contains: 'ggml-tiny' },
    expectPrompt: true,
    resolvedStep2: true,
    providerStates: true,
    splitSegmentsDir: 'split-attempts/pass_001/segments'
  })
})
