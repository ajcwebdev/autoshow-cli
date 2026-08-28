import { expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import type { LLMService, LLMTarget, ResolvedStructuredSchema, Step3Metadata, StructuredRequestOptions } from '~/types'
import { runLlmTargetsForStructuredPrompt } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const buildMetadata = (service: LLMService, model: string): Step3Metadata => ({
  llmService: service,
  llmModel: model,
  processingTime: 1,
  inputTokenCount: 1,
  outputTokenCount: 1,
  outputFileName: '',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: []
})

const structuredSchema: ResolvedStructuredSchema = {
  schemaName: 'content',
  leafPromptNames: ['content'],
  presetNames: [],
  schema: v.object({ content: v.string() }),
  jsonSchema: {
    type: 'object',
    properties: { content: { type: 'string' } },
    required: ['content'],
    additionalProperties: false
  }
}

test('stubbed LLM targets use capability retry budgets and persist one failure envelope', async () => {
  const tempDir = await makeTempDir('autoshow-structured-failure-')
  try {
    const attempts = new Map<LLMService, number>()
    const requestOptions = new Map<LLMService, StructuredRequestOptions[]>()
    const target = (service: LLMService, model: string, result: string): LLMTarget => ({
      service,
      model,
      label: service,
      run: async (_prompt, _model, options) => {
        attempts.set(service, (attempts.get(service) ?? 0) + 1)
        requestOptions.set(service, [...(requestOptions.get(service) ?? []), options as StructuredRequestOptions])
        return { result, metadata: buildMetadata(service, model) }
      }
    })

    const results = await runLlmTargetsForStructuredPrompt({
      prompt: 'Summarize this input.',
      outputDir: tempDir,
      targets: [
        target('openai', 'openai-zero', 'not json'),
        target('anthropic', 'anthropic-one', 'not json'),
        target('minimax', 'minimax-two', 'not json'),
        target('groq', 'groq-success', '{"content":"valid output"}')
      ],
      structuredSchema,
      structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] }
    })

    expect(Object.fromEntries(attempts)).toEqual({
      openai: 1,
      anthropic: 2,
      minimax: 3,
      groq: 1
    })
    expect(requestOptions.get('openai')?.every((options) => options.strategy === 'native')).toBe(true)
    expect(requestOptions.get('anthropic')?.every((options) => options.strategy === 'native')).toBe(true)
    expect(requestOptions.get('minimax')?.every((options) => options.strategy === 'schema-guided')).toBe(true)

    for (const result of results.slice(0, 3)) {
      expect(result.parsedJson).toEqual({
        _raw: 'not json',
        _validationError: 'Response was not valid JSON'
      })
      expect(result.metadata.validationFailed).toBe(true)
      expect(result.renderedText).toContain('## Structured Validation Error')
      expect(result.renderedText).toContain('## Raw Output\n\n```text\nnot json\n```')
      const persisted = await Bun.file(join(tempDir, result.metadata.outputFileName)).text()
      expect(persisted).not.toContain('validationFailed')
    }

    expect(results[3]?.parsedJson).toEqual({ content: 'valid output' })
    expect(results[3]?.metadata.validationFailed).toBe(false)
    expect(results[3]?.renderedText).toBe('valid output')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
