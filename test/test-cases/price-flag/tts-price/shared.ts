import { expect } from 'bun:test'
import { runCommand } from '../../../test-utils/test-helpers'

export const MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603'
export const MISTRAL_REF_AUDIO_PATH = 'input/examples/audio/anthony-voice.mp3'

const NO_PAID_TTS_ENV = {
  ANTHROPIC_API_KEY: '',
  DEEPGRAM_API_KEY: '',
  ELEVENLABS_API_KEY: '',
  GEMINI_API_KEY: '',
  GOOGLE_APPLICATION_CREDENTIALS: '',
  GOOGLE_CLOUD_PROJECT: '',
  GROK_API_KEY: '',
  HUME_API_KEY: '',
  GROQ_API_KEY: '',
  MISTRAL_API_KEY: '',
  MINIMAX_API_KEY: '',
  OPENAI_API_KEY: '',
  CARTESIA_API_KEY: '',
  SPEECHIFY_API_KEY: '',
  XAI_API_KEY: ''
} as const

export const runTtsPriceCommand = async (
  args: string[],
  env: Record<string, string | undefined> = {}
) => await runCommand(args, {
  env: {
    ...NO_PAID_TTS_ENV,
    ...env
  }
})

export const expectPriceEstimateForModel = (
  result: Awaited<ReturnType<typeof runCommand>>,
  model: string
): void => {
  expect(result.exitCode).toBe(0)
  expect(result.outputDir).toBeNull()
  const output = `${result.stdout}\n${result.stderr}`
  expect(output).toContain('Cost Estimate')
  expect(output).toContain(model)
}
