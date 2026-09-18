import { expect } from "bun:test"
import {
  fileExists,
} from "./test-helpers"
import { E2E_TEST_TIMEOUT_MS } from './budget'
import { readCanonicalRecord } from './manifest-helpers'
import { assertSummaryFields, assertTextContent, containedArtifactPath } from './assert-generated-content'
import {
  defineBudgetedLiveServiceTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
export const defineLLMWriteTest = ({
  models,
  provider,
  llmService,
  requiresEnvVar,
  promptProfiles,
  inputPath = 'input/examples/tts/00-tts-shortest.txt',
  inputTitle = '00-tts-shortest',
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

      const commandArgs = ["src/cli/create-cli.ts", "write", inputPath, '--provider', `${provider}=${model}`]
      const promptProfile = promptProfiles?.[model]
      if (promptProfile) {
        commandArgs.push('--prompt', promptProfile)
      }

      const outputDir = await runCommandAndExpectOutputDir(inputTitle, commandArgs)

      const metadataExists = await fileExists(`${outputDir}/manifest.json`)
      expect(metadataExists).toBe(true)

      const metadata = await readCanonicalRecord(outputDir) as {
        step3?: { llmModel?: string; llmService?: string; outputFileName?: string }
      }
      const outputFileName = metadata.step3?.outputFileName ?? 'text.json'
      const outputPath = containedArtifactPath(outputDir, outputFileName)
      expect(await fileExists(outputPath)).toBe(true)

      if (outputFileName.endsWith('.json')) {
        const summaryJson = await Bun.file(outputPath).json() as unknown
        assertSummaryFields(summaryJson, promptProfile ?? 'default')
      } else {
        const summaryContent = await Bun.file(outputPath).text()
        assertTextContent(summaryContent)
      }

      expect(metadata.step3?.llmModel).toBe(model)
      expect(metadata.step3?.llmService).toBe(llmService)
    }, E2E_TEST_TIMEOUT_MS)
  }
}
