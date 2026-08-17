import {
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
} from './test-helpers'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import {
  defineBudgetedLiveServiceTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
import { assertSttExtractRun } from './assert-stt-extract-run'

export const defineSTTServiceTest = ({
  models,
  provider,
  sttService,
  envVarKey,
  envVarDescription,
  extraEnvVarKeys,
  extraArgs,
  shouldSkipReadiness,
  inputPath = STABLE_EXAMPLE_AUDIO_URL,
  inputTitle = STABLE_EXAMPLE_AUDIO_TITLE,
  timeoutMs = E2E_TEST_TIMEOUT_MS,
}: {
  models: readonly string[]
  provider: string
  sttService: string
  envVarKey: string
  envVarDescription: string
  extraEnvVarKeys?: string[]
  extraArgs?: string[]
  shouldSkipReadiness?: () => Promise<boolean>
  inputPath?: string
  inputTitle?: string
  timeoutMs?: number
}): void => {
  withOutputLifecycle(inputTitle)

  for (const model of models) {
    const budgetKey = `transcribe-${sttService}-${model}`

    defineBudgetedLiveServiceTest(
      budgetKey,
      `${sttService} ${model} transcribes local audio`,
      [envVarKey, ...(extraEnvVarKeys ?? [])],
      async () => {
        await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)
        for (const extraEnvVarKey of extraEnvVarKeys ?? []) {
          await requireConfiguredEnvVar(extraEnvVarKey, `${extraEnvVarKey} is required for ${envVarDescription}`)
        }

        if (shouldSkipReadiness && await shouldSkipReadiness()) {
          throw new Error(`${sttService} ${model} readiness prerequisite failed`)
        }

        const outputDir = await runCommandAndExpectOutputDir(inputTitle, [
          'src/cli/create-cli.ts',
          'extract',
          inputPath,
          '--provider',
          `${provider}=${model}`,
          ...(extraArgs ?? [])
        ])

        await assertSttExtractRun(outputDir, {
          transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
          target: { service: sttService, model, local: false, origin: 'explicit' },
          modelMatch: { equals: model },
          expectPrompt: true,
          resolvedStep2: true,
          providerStates: true,
          splitSegmentsDir: false
        })
      },
      timeoutMs
    )
  }
}
