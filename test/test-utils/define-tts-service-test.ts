import { expect } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
} from './test-helpers'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineBudgetedLiveServiceTest,
  defineInvalidModelTest,
  formatCommandFailureDiagnostics,
  requireConfiguredEnvVar,
  withOutputLifecycle
} from './service-test-kit'
import { readCanonicalRecord } from './manifest-helpers'
import { l } from '~/utils/app-logger/app-logger'
import type { TtsExtraArgs } from '~/types'

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const isTransientMinimaxTtsFailure = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /minimax-tts-chunk-\d+: deadline exceeded/i.test(clean) ||
    /MiniMax TTS (task creation|task query|download) failed \((408|425|429|500|502|503|504)\)/i.test(clean) ||
    /fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(clean)
  )
}

const isRunwayInsufficientCreditsFailure = (output: string): boolean =>
  output.includes('You do not have enough credits to run this task.')

const isGroqTermsAcceptanceFailure = (output: string): boolean =>
  /requires terms acceptance/i.test(stripAnsi(output))

const resolveTtsExtraArgs = async (
  extraArgs: TtsExtraArgs | undefined,
  model: string
): Promise<readonly string[]> => {
  if (!extraArgs) return []
  return typeof extraArgs === 'function' ? await extraArgs(model) : extraArgs
}

export const defineTTSServiceTest = ({
  models,
  provider,
  ttsService,
  envVarKey,
  envVarDescription,
  inputPath = STABLE_TTS_MD_PATH,
  inputTitle = STABLE_TTS_MD_TITLE,
  extraArgs,
  resolveExpectedSpeaker,
  generationTimeoutMs,
  generationTimeoutMsByModel,
}: {
  models: readonly string[]
  provider: string
  ttsService: string
  envVarKey: string
  envVarDescription: string
  inputPath?: string
  inputTitle?: string
  extraArgs?: TtsExtraArgs
  resolveExpectedSpeaker?: (model: string) => string | Promise<string>
  generationTimeoutMs?: number
  generationTimeoutMsByModel?: Readonly<Record<string, number>>
}): void => {
  withOutputLifecycle(inputTitle)

  defineInvalidModelTest(`rejects invalid ${ttsService} model`, [
    'src/cli/create-cli.ts',
    'tts',
    inputPath,
    '--provider',
    `${provider}=invalid-model`
  ])

  for (const model of models) {
    const budgetKey = `tts-${ttsService}-${model}`
    const timeoutMs = generationTimeoutMsByModel?.[model] ?? generationTimeoutMs ?? E2E_TEST_TIMEOUT_MS

    defineBudgetedLiveServiceTest(budgetKey, `${model} generates speech.wav`, [envVarKey], async () => {
      await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)

      const resolvedExtraArgs = await resolveTtsExtraArgs(extraArgs, model)

      const args = [
        'src/cli/create-cli.ts',
        'tts',
        inputPath,
        '--provider',
        `${provider}=${model}`,
        ...resolvedExtraArgs
      ]
      let result = await runCommand(args)

      if (result.exitCode !== 0 && ttsService === 'minimax') {
        const combinedOutput = `${result.stdout}\n${result.stderr}`
        if (isTransientMinimaxTtsFailure(combinedOutput)) {
          l.warn(`Retrying once after transient MiniMax TTS error for ${model}`)
          await Bun.sleep(2_000)
          result = await runCommand(args)

          if (result.exitCode !== 0) {
            const retryOutput = `${result.stdout}\n${result.stderr}`
            if (isTransientMinimaxTtsFailure(retryOutput)) {
              throw new Error(`MiniMax transient TTS error persisted for ${model}\n${formatCommandFailureDiagnostics(args, result)}`)
            }
          }
        }
      }
      if (result.exitCode !== 0 && ttsService === 'runway') {
        const combinedOutput = `${result.stdout}\n${result.stderr}`
        if (isRunwayInsufficientCreditsFailure(combinedOutput)) {
          throw new Error(`Runway account does not have enough credits to run this task\n${formatCommandFailureDiagnostics(args, result)}`)
        }
      }
      if (result.exitCode !== 0 && ttsService === 'groq') {
        const combinedOutput = `${result.stdout}\n${result.stderr}`
        if (isGroqTermsAcceptanceFailure(combinedOutput)) {
          throw new Error(`Groq terms acceptance is required for ${model}\n${formatCommandFailureDiagnostics(args, result)}`)
        }
      }

      if (result.exitCode !== 0) {
        throw new Error(formatCommandFailureDiagnostics(args, result))
      }

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(inputTitle, result.outputRoot)
      if (!outputDir) {
        throw new Error(`Expected output directory for ${inputTitle}`)
      }

      const audioExists = await fileExists(`${outputDir}/speech.wav`)
      expect(audioExists).toBe(true)

      const audioFile = Bun.file(`${outputDir}/speech.wav`)
      expect(audioFile.size).toBeGreaterThan(0)

      const metadata = await readCanonicalRecord(outputDir) as {
        tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string, audioFileName?: string }>
      }
      expect(metadata.tts?.[0]?.ttsService).toBe(ttsService)
      expect(metadata.tts?.[0]?.ttsModel).toBe(model)
      if (resolveExpectedSpeaker) {
        const expectedSpeaker = await resolveExpectedSpeaker(model)
        expect(metadata.tts?.[0]?.speaker).toBe(expectedSpeaker)
      }
      expect(metadata.tts?.[0]?.audioFileName).toBe('speech.wav')
    }, timeoutMs)
  }
}
