import { expect } from 'bun:test'
import {
  fileExists,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
} from './test-helpers'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineBudgetedLiveServiceTest,
  formatCommandFailureDiagnostics,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
import { readCanonicalRecord } from './manifest-helpers'
import { isTransientMinimaxTtsFailure, TERMINAL_TTS_FAILURES } from './provider-failure-classifiers'
import type { RunCommandResult, TtsExtraArgs } from '~/types'

const resolveTtsExtraArgs = async (
  extraArgs: TtsExtraArgs | undefined,
  model: string
): Promise<readonly string[]> => {
  if (!extraArgs) return []
  return typeof extraArgs === 'function' ? await extraArgs(model) : extraArgs
}

const throwOnKnownProviderFailure = (
  ttsService: string,
  model: string,
  args: string[],
  result: RunCommandResult
): void => {
  if (result.exitCode === 0) {
    return
  }

  const terminalFailure = TERMINAL_TTS_FAILURES[ttsService]
  if (!terminalFailure || !terminalFailure.matches(`${result.stdout}\n${result.stderr}`)) {
    return
  }

  throw new Error(`${terminalFailure.describe(model)}\n${formatCommandFailureDiagnostics(args, result)}`)
}

const assertTtsArtifacts = async (
  outputDir: string,
  { ttsService, model, resolveExpectedSpeaker }: {
    ttsService: string
    model: string
    resolveExpectedSpeaker?: ((model: string) => string | Promise<string>) | undefined
  }
): Promise<void> => {
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

      const outputDir = await runCommandAndExpectOutputDir(inputTitle, args, undefined, {
        // MiniMax is the one TTS provider whose transport failures are worth a single retry.
        ...(ttsService === 'minimax'
          ? {
              transient: {
                isTransient: isTransientMinimaxTtsFailure,
                providerLabel: `transient MiniMax TTS error for ${model}`,
                persistedLabel: `MiniMax transient TTS error persisted for ${model}`,
              }
            }
          : {}),
        onResult: (result) => { throwOnKnownProviderFailure(ttsService, model, args, result) },
        // TTS reports the raw command failure; live-availability classification is not applied.
        classifyAvailability: false
      })

      await assertTtsArtifacts(outputDir, { ttsService, model, resolveExpectedSpeaker })
    }, timeoutMs)
  }
}
