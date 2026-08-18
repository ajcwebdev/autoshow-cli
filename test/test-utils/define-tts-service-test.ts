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
  formatCommandFailureDiagnostics,
  requireConfiguredEnvVar,
  withOutputLifecycle
} from './service-test-kit'
import { readCanonicalRecord } from './manifest-helpers'
import { l } from '~/utils/app-logger/app-logger'
import type { RunCommandResult, TtsExtraArgs } from '~/types'

const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/g, '')

const isTransientMinimaxTtsFailure = (output: string): boolean => {
  const clean = stripAnsi(output)
  return (
    /minimax-tts-chunk-\d+: deadline exceeded/i.test(clean) ||
    /MiniMax TTS (task creation|task query|download) failed \((408|425|429|500|502|503|504)\)/i.test(clean) ||
    /fetch failed|network error|econnreset|econnrefused|etimedout|socket hang up|dns/i.test(clean)
  )
}

const isGroqTermsAcceptanceFailure = (output: string): boolean =>
  /requires terms acceptance/i.test(stripAnsi(output))

// Terminal per-service account states: no retry inside the run can clear them, so the
// suite fails with the account-state message instead of a generic command failure.
// Adding a provider quirk is a row here, not another branch in the test body.
const TERMINAL_TTS_FAILURES: Record<string, {
  matches: (output: string) => boolean
  describe: (model: string) => string
}> = {
  groq: {
    matches: isGroqTermsAcceptanceFailure,
    describe: (model) => `Groq terms acceptance is required for ${model}`,
  },
}

const resolveTtsExtraArgs = async (
  extraArgs: TtsExtraArgs | undefined,
  model: string
): Promise<readonly string[]> => {
  if (!extraArgs) return []
  return typeof extraArgs === 'function' ? await extraArgs(model) : extraArgs
}

// MiniMax alone gets one retry, because its transient chunk/deadline failures clear on a
// second attempt. A transient failure that survives the retry is reported as such rather
// than as a plain command failure.
const runTtsWithMinimaxRetry = async (
  args: string[],
  ttsService: string,
  model: string
): Promise<RunCommandResult> => {
  const result = await runCommand(args)
  if (result.exitCode === 0 || ttsService !== 'minimax') {
    return result
  }

  if (!isTransientMinimaxTtsFailure(`${result.stdout}\n${result.stderr}`)) {
    return result
  }

  l.warn(`Retrying once after transient MiniMax TTS error for ${model}`)
  await Bun.sleep(2_000)
  const retried = await runCommand(args)

  if (retried.exitCode !== 0 && isTransientMinimaxTtsFailure(`${retried.stdout}\n${retried.stderr}`)) {
    throw new Error(`MiniMax transient TTS error persisted for ${model}\n${formatCommandFailureDiagnostics(args, retried)}`)
  }

  return retried
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

      const result = await runTtsWithMinimaxRetry(args, ttsService, model)
      throwOnKnownProviderFailure(ttsService, model, args, result)

      if (result.exitCode !== 0) {
        throw new Error(formatCommandFailureDiagnostics(args, result))
      }

      expect(result.exitCode).toBe(0)

      const outputDir = result.outputDir ?? await findLatestDirectory(inputTitle, result.outputRoot)
      if (!outputDir) {
        throw new Error(`Expected output directory for ${inputTitle}`)
      }

      await assertTtsArtifacts(outputDir, { ttsService, model, resolveExpectedSpeaker })
    }, timeoutMs)
  }
}
