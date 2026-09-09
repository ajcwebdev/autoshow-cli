import { expect, test } from 'bun:test'
import { resolvePriceSelection } from '../../../../test-runner/price-commands/resolve'
import { inspectBudgetSource } from './budget-source-inspection'

// Inspect live test definitions without importing or executing provider calls.
const expectedCoverage = [
  ['test/test-cases/e2e/service/step-3-write-e2e/write-services/gemini-3.8-flash.test.ts', 'write-gemini-gemini-3.8-flash'],
  ['test/test-cases/e2e/service/step-3-write-e2e/write-services/glm-5.3.test.ts', 'write-glm-glm-5.3'],
  ['test/test-cases/e2e/service/step-3-write-e2e/write-services/glm-5.3-flash.test.ts', 'write-glm-glm-5.3-flash'],
  ['test/test-cases/e2e/service/step-3-write-e2e/write-services/together-kimi-k3.test.ts', 'write-together-kimi-k3'],
  ['test/test-cases/e2e/service/step-3-write-e2e/write-services/together-glm-5.3.test.ts', 'write-together-glm-5.3'],
  ['test/test-cases/e2e/service/step-3-write-e2e/write-services/together-glm-5.3-flash.test.ts', 'write-together-glm-5.3-flash'],
  ['test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/gemini-3.8-flash.test.ts', 'extract-gemini-gemini-3.8-flash'],
  ['test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/anthropic-claude-fable-5-1.test.ts', 'extract-anthropic-claude-fable-5-1'],
  ['test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/openai-gpt-6-astra.test.ts', 'extract-openai-gpt-6-astra'],
  ['test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/mistral-ocr-4-1.test.ts', 'extract-mistral-mistral-ocr-4-1'],
  ['test/test-cases/e2e/service/step-2-stt-e2e/stt-services/gemini-3.8-flash.test.ts', 'transcribe-gemini-stt-gemini-3.8-flash'],
  ['test/test-cases/e2e/service/step-4-tts-e2e/tts-services/cartesia-sonic-3.6-2026-08-27.test.ts', 'tts-cartesia-sonic-3.6-2026-08-27'],
  ['test/test-cases/e2e/service/step-4-tts-e2e/tts-services/inworld-realtime-tts-2-flash.test.ts', 'tts-inworld-realtime-tts-2-flash'],
  ['test/test-cases/e2e/service/step-5-image-gen-e2e/grok-imagine-image-2.0.test.ts', 'image-grok-grok-imagine-image-2.0'],
  ['test/test-cases/e2e/service/step-6-video-gen-e2e/ltx-2-5-fast.test.ts', 'video-ltx-ltx-2-5-fast'],
  ['test/test-cases/e2e/service/step-6-video-gen-e2e/ltx-2-5-pro.test.ts', 'video-ltx-ltx-2-5-pro'],
  ['test/test-cases/e2e/service/step-7-music-gen-e2e/gemini-lyria-3.5.test.ts', 'music-gemini-lyria-3.5'],
] as const

for (const [file, key] of expectedCoverage) {
  test(`P1 e2e and budget coverage: ${key}`, async () => {
    const source = await Bun.file(file).text()
    const inspection = inspectBudgetSource(file, source)
    expect(inspection.issues).toEqual([])
    expect(inspection.keys).toEqual([key])
    const commands = resolvePriceSelection([file], [file], { budgetSkippableOnly: true }).commands
    expect(commands.map(command => command.key)).toEqual([key])
    expect(commands[0]?.args).toContain('--price')
  })
}
