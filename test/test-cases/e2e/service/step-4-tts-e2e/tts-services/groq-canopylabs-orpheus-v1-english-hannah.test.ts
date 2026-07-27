import { expect } from 'bun:test'
import { budgetedTest } from '../../../../../test-utils/budget'
import {
  fileExists,
  findLatestDirectory,
  runCommand,
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../../test-utils/service-test-kit'

const SHORT_TTS_INPUT_PATH = 'input/examples/tts/0-tts-short.txt'
const SHORT_TTS_INPUT_TITLE = '0-tts-short'

budgetedTest('tts-groq-canopylabs/orpheus-v1-english', 'orpheus english with --groq-voice hannah generates speech.wav', async () => {
  await requireConfiguredEnvVar('GROQ_API_KEY', 'GROQ_API_KEY is required for Groq TTS test')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    SHORT_TTS_INPUT_PATH,
    '--provider',
    'groq=canopylabs/orpheus-v1-english',
    '--groq-voice',
    'hannah'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(SHORT_TTS_INPUT_TITLE, result.outputRoot)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('groq')
    expect(metadata.tts?.[0]?.ttsModel).toBe('canopylabs/orpheus-v1-english')
    expect(metadata.tts?.[0]?.speaker).toBe('hannah')
  }
})
