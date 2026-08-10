import { describe, expect, beforeAll, afterAll } from 'bun:test'
import {
  runCommand,
  fileExists,
  findLatestDirectory,
  cleanupTestOutput,
  stopLlamafileServer,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE,
} from '../../../../../test-utils/test-helpers'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import { readCanonicalRecord } from '../../../../../test-utils/manifest-helpers'

// Uses the smallest prebuilt bundle (Qwen3.5-0.8B-Q8_0, ~1.6 GB) to bound the download.
const LLAMAFILE_MODEL = 'Qwen3.5-0.8B-Q8_0'

describe('write subcommand with llamafile', () => {
  beforeAll(async () => {
    await stopLlamafileServer()
    await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  })

  afterAll(async () => {
    await stopLlamafileServer()
    await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)
  })

  budgetedTest('write-llamafile-qwen3.5-0.8b', `write ${STABLE_EXAMPLE_AUDIO_URL} --llm llamafile=${LLAMAFILE_MODEL}`, async () => {
    await stopLlamafileServer()

    const result = await runCommand(
      ['src/cli/create-cli.ts', 'write', STABLE_EXAMPLE_AUDIO_URL, '--llm', `llamafile=${LLAMAFILE_MODEL}`]
    )

    expect(result.exitCode).toBe(0)

    const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
    expect(outputDir).not.toBeNull()

    if (outputDir) {
      const summaryExists = await fileExists(`${outputDir}/text.json`)
      expect(summaryExists).toBe(true)

      const summaryJson = await Bun.file(`${outputDir}/text.json`).json() as unknown
      expect(summaryJson).toBeDefined()

      const metadata = await readCanonicalRecord(outputDir) as {
        completionStatus?: string
        step3?: { llmModel?: string; llmService?: string }
      }
      expect(metadata.completionStatus).toBe('full')
      expect(metadata.step3?.llmModel).toBe(LLAMAFILE_MODEL)
      expect(metadata.step3?.llmService).toBe('llamafile')
    }
  }, E2E_TEST_TIMEOUT_MS)
})
