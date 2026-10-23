import { expect, test } from 'bun:test'
import { resolvePriceSelection } from '../../../../test-runner/price-commands/resolve'
import { inspectBudgetSource } from './budget-source-inspection'

const expectedCoverage = [
  ['test/test-cases/e2e/service/text/write/gemini-3.8-flash.test.ts', 'write-gemini-gemini-3.8-flash'],
  // OCR PDF and image cases are separate tests, each with its own budget key.
  ['test/test-cases/e2e/service/text/ocr/gemini-3.8-flash.test.ts', 'extract-gemini-gemini-3.8-flash', 'extract-gemini-gemini-3.8-flash-image'],
  ['test/test-cases/e2e/service/text/ocr/anthropic-claude-fable-5-1.test.ts', 'extract-anthropic-claude-fable-5-1', 'extract-anthropic-claude-fable-5-1-image'],
  ['test/test-cases/e2e/service/text/ocr/openai-gpt-6-astra.test.ts', 'extract-openai-gpt-6-astra', 'extract-openai-gpt-6-astra-image'],
  ['test/test-cases/e2e/service/text/ocr/mistral-ocr-4-1.test.ts', 'extract-mistral-mistral-ocr-4-1', 'extract-mistral-mistral-ocr-4-1-image'],
  ['test/test-cases/e2e/service/stt/diarization/gemini-3.5-transcribe.test.ts', 'transcribe-gemini-stt-gemini-3.5-transcribe'],
  ['test/test-cases/e2e/service/visuals/image/grok-imagine-image-2.0.test.ts', 'image-grok-grok-imagine-image-2.0'],
  ['test/test-cases/e2e/service/visuals/video/gemini-omni-1.1-flash.test.ts', 'video-gemini-gemini-omni-1.1-flash'],
  ['test/test-cases/e2e/service/visuals/video/grok-imagine-video-1.5.test.ts', 'video-grok-grok-imagine-video-1.5'],
  ['test/test-cases/e2e/service/audio/music/gemini-lyria-3.5.test.ts', 'music-gemini-lyria-3.5'],
] as const

for (const [file, ...keys] of expectedCoverage) {
  test(`P1 e2e and budget coverage: ${keys[0]}`, async () => {
    const source = await Bun.file(file).text()
    const inspection = inspectBudgetSource(file, source)
    expect(inspection.issues).toEqual([])
    expect(inspection.keys).toEqual(keys)
    const commands = resolvePriceSelection([file], [file], { budgetSkippableOnly: true }).commands
    expect(commands.map(command => command.key)).toEqual(keys)
    for (const command of commands) expect(command.args).toContain('--price')
  })
}
