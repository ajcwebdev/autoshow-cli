import { afterEach } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildVoiceQualityReport } from '~/cli/commands/setup-and-utilities/benchmark/tts-voice-quality-report/report-writing'
import { runCommand } from '../../../../test-utils/test-helpers'
import { writeSyntheticWav } from '../../../../test-utils/media-fixtures'

const tempDirs: string[] = []
const originalFetch = globalThis.fetch
const envKeys = ['OPENAI_API_KEY', 'ASSEMBLYAI_API_KEY'] as const
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<typeof envKeys[number], string | undefined>

export const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

export const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n')
}

export const makeMockFetch = (
  fn: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>
): typeof fetch => Object.assign(fn, { preconnect: () => undefined }) as typeof fetch

export const installVoiceQualityReportHooks = (): void => {
  afterEach(async () => {
    globalThis.fetch = originalFetch
    for (const key of envKeys) {
      const value = originalEnv[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })
}

export const makeSingleProviderTtsRun = async (): Promise<{
  runDir: string
  inputText: string
}> => {
  const runDir = await makeTempRoot('autoshow-voice-quality-strict-')
  const inputText = 'Hello world. This sample checks strict paid scoring behavior for text to speech benchmarks.'
  await writeFile(join(runDir, 'input.txt'), inputText + '\n')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'tts',
    metadata: {
      input: inputText,
      tts: [
        {
          ttsService: 'openai',
          ttsModel: 'gpt-4o-mini-tts',
          speaker: 'alloy',
          processingTime: 1000,
          audioFileName: 'speech-openai-gpt-4o-mini-tts.wav',
          audioFileSize: 100,
          chunkCount: 1
        }
      ]
    }
  })
  await writeSyntheticWav(join(runDir, 'speech-openai-gpt-4o-mini-tts.wav'), {
    durationSeconds: 4.5,
    amplitude: 0.35,
    frequencyHz: 220
  })
  return { runDir, inputText }
}

export const makeAudioJudgeFixtureRun = async (): Promise<{
  runDir: string
  inputText: string
  fixturesPath: string
}> => {
  const { runDir, inputText } = await makeSingleProviderTtsRun()
  const fixturesPath = join(runDir, 'voice-quality-fixtures.json')
  await writeJson(fixturesPath, {
    providers: { 'openai/gpt-4o-mini-tts': { stt: { 'assemblyai/universal-2': inputText } } }
  })
  return { runDir, inputText, fixturesPath }
}

export const voiceQualityToolCallResponse = (argumentsJson: string): Response =>
  new Response(JSON.stringify({
    choices: [{
      message: {
        tool_calls: [{
          type: 'function',
          function: { name: 'record_tts_voice_quality', arguments: argumentsJson }
        }]
      }
    }]
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

export const buildSingleProviderReport = async (
  runDir: string,
  inputText: string,
  overrides?: Partial<Parameters<typeof buildVoiceQualityReport>[0]>
) => buildVoiceQualityReport({
  runDir,
  inputText,
  inputTextLabel: 'test-input',
  mode: 'full',
  allowPaid: true,
  metricFixturesPath: null,
  roundtripDir: null,
  markdownOut: null,
  jsonOut: null,
  keepTemp: false,
  audioJudgeModel: 'gpt-audio',
  ...overrides
})

export { join, mkdir, runCommand, writeFile, writeSyntheticWav }
