import { expect } from "bun:test"
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
} from "./test-helpers"
import { E2E_TEST_TIMEOUT_MS } from './budget'
import { readRunMetadata } from './manifest-helpers'
import {
  classifyLiveProviderAvailabilityFailure,
  defineBudgetedLiveServiceTest,
  formatCommandFailureDiagnostics,
  requireConfiguredEnvVar,
  runCommandWithTransientRetry,
  withOutputLifecycle
} from './service-test-kit'
import {
  isGeminiLlmTransientUnavailable,
  isMinimaxTransientUnavailable
} from './provider-failure-classifiers'

const TRANSIENT_RETRY_PREDICATES: Record<string, (output: string) => boolean> = {
  gemini: isGeminiLlmTransientUnavailable,
  minimax: isMinimaxTransientUnavailable,
}

export const defineLLMWriteTest = ({
  models,
  provider,
  llmService,
  requiresEnvVar,
  promptProfiles,
  inputPath = STABLE_EXAMPLE_AUDIO_URL,
  inputTitle = STABLE_EXAMPLE_AUDIO_TITLE,
}: {
  models: readonly string[]
  provider: string
  llmService: string
  requiresEnvVar?: { key: string, description: string }
  promptProfiles?: Partial<Record<string, string>>
  inputPath?: string
  inputTitle?: string
}): void => {
  withOutputLifecycle(inputTitle)

  for (const model of models) {
    const budgetKey = `write-${llmService}-${model}`
    defineBudgetedLiveServiceTest(budgetKey, `${model} model generates summary`, [requiresEnvVar?.key], async () => {
      if (requiresEnvVar) {
        await requireConfiguredEnvVar(requiresEnvVar.key, `${requiresEnvVar.key} is required for ${requiresEnvVar.description}`)
      }

      const commandArgs = ["src/cli/create-cli.ts", "write", inputPath, '--llm', `${provider}=${model}`]
      const promptProfile = promptProfiles?.[model]
      if (promptProfile) {
        commandArgs.push('--prompt', promptProfile)
      }

      const transientPredicate = TRANSIENT_RETRY_PREDICATES[llmService]
      const result = transientPredicate
        ? await runCommandWithTransientRetry(commandArgs, {
            isTransient: transientPredicate,
            providerLabel: `transient ${llmService} availability error for ${model}`,
            persistedLabel: `${llmService} transient availability error persisted for ${model}`,
          })
        : await runCommand(commandArgs)

      if (result.exitCode !== 0) {
        const availabilityReason = classifyLiveProviderAvailabilityFailure(`${result.stdout}\n${result.stderr}`)
        if (availabilityReason) {
          throw new Error(`Live provider availability failure: ${availabilityReason}\n${formatCommandFailureDiagnostics(commandArgs, result)}`)
        }
        throw new Error(formatCommandFailureDiagnostics(commandArgs, result))
      }

      const outputDir = result.outputDir ?? await findLatestDirectory(inputTitle, result.outputRoot)
      if (!outputDir) {
        throw new Error(`Expected output directory for ${inputTitle}`)
      }

      const metadataExists = await fileExists(`${outputDir}/run.json`)
      expect(metadataExists).toBe(true)

      const metadata = await readRunMetadata(outputDir) as {
        step3?: { llmModel?: string; llmService?: string; outputFileName?: string }
      }
      const outputFileName = metadata.step3?.outputFileName ?? 'text.json'
      expect(await fileExists(`${outputDir}/${outputFileName}`)).toBe(true)

      if (outputFileName.endsWith('.json')) {
        const summaryJson = await Bun.file(`${outputDir}/${outputFileName}`).json() as unknown
        expect(summaryJson).toBeDefined()
      } else {
        const summaryContent = await Bun.file(`${outputDir}/${outputFileName}`).text()
        expect(summaryContent.length).toBeGreaterThan(0)
      }

      expect(metadata.step3?.llmModel).toBe(model)
      expect(metadata.step3?.llmService).toBe(llmService)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
