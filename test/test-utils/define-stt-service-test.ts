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
import { expect } from 'bun:test'

export type SttServiceTestCase = Readonly<{ model: string, budgetKey: string, name: string, args: readonly string[] }>

/** The exact invocations a defineSTTServiceTest config registers; the price registry must match them. */
export const sttServiceTestCases = ({
  models,
  provider,
  sttService,
  extraArgs,
  inputPath = STABLE_EXAMPLE_AUDIO_URL,
}: {
  models: readonly string[]
  provider: string
  sttService: string
  extraArgs?: readonly string[] | undefined
  inputPath?: string | undefined
}): SttServiceTestCase[] => models.map((model) => ({
  model,
  budgetKey: `transcribe-${sttService}-${model}`,
  name: `${sttService} ${model} transcribes local audio`,
  args: ['src/cli/create-cli.ts', 'extract', inputPath, '--provider', `${provider}=${model}`, ...(extraArgs ?? [])]
}))

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

  for (const { model, budgetKey, name, args } of sttServiceTestCases({ models, provider, sttService, extraArgs, inputPath })) {
    defineBudgetedLiveServiceTest(
      budgetKey,
      name,
      [envVarKey, ...(extraEnvVarKeys ?? [])],
      async () => {
        await requireConfiguredEnvVar(envVarKey, `${envVarKey} is required for ${envVarDescription}`)
        for (const extraEnvVarKey of extraEnvVarKeys ?? []) {
          await requireConfiguredEnvVar(extraEnvVarKey, `${extraEnvVarKey} is required for ${envVarDescription}`)
        }

        if (shouldSkipReadiness && await shouldSkipReadiness()) {
          throw new Error(`${sttService} ${model} readiness prerequisite failed`)
        }

        const outputDir = await runCommandAndExpectOutputDir(inputTitle, [...args])

        await assertSttExtractRun(outputDir, {
          transcriptMatch: /\[\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]/,
          target: { service: sttService, model, local: false, origin: 'explicit' },
          modelMatch: { equals: model },
          expectPrompt: true,
          resolvedStep2: true,
          providerStates: true,
          splitSegmentsDir: false
        })
        if (inputPath === STABLE_EXAMPLE_AUDIO_URL || inputPath === 'input/examples/audio/1-audio.mp3') {
          // Opening words in the saved 1-audio reference transcript, independent of provider metadata.
          const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
          expect(transcript).toMatch(/James\s+Perkins/i)
          expect(transcript).toMatch(/welcome\s+to\s+the\s+show/i)
        }
      },
      timeoutMs
    )
  }
}
