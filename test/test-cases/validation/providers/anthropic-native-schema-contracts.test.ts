import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import * as v from 'valibot'
import { transformAnthropicJsonSchema } from '~/utils/anthropic/anthropic-json-schema'
import { runAnthropicModel } from '~/cli/commands/text/write/write-services/write-anthropic/run-anthropic'
import { collectLlmTargets, runLlmTargetsForStructuredPrompt } from '~/cli/commands/text/write/run-llm'
import { resolveStructuredSchema } from '~/cli/commands/text/write/structured-output/schema-resolver'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['ANTHROPIC_API_KEY'], tempPrefix: 'autoshow-claude-native-schema-' })
const model = 'claude-haiku-5-5'
const unsupportedKeys = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'maxItems', 'uniqueItems'])
const assertSupportedSchema = (node: unknown): void => {
  if (Array.isArray(node)) {
    for (const value of node) assertSupportedSchema(value)
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      expect(unsupportedKeys.has(key)).toBe(false)
      assertSupportedSchema(value)
    }
  }
}

describe('Claude native JSON-schema compatibility', () => {
  // Independent contract: raw output_config.format rejects numeric/string
  // bounds and array constraints other than minItems 0/1, per the official
  // structured-outputs documentation read 2026-10-17. Local validation remains.
  test('transformation preserves field names, supported patterns, descriptions and original constraints', () => {
    const original = {
      type: 'object', properties: {
        minLength: { type: 'string', minLength: 1, maxLength: 10, description: 'A label.' },
        amount: { type: 'number', minimum: 1, maximum: 5, exclusiveMinimum: 0, multipleOf: 0.5 },
        tags: { type: 'array', minItems: 3, maxItems: 5, uniqueItems: true, items: { type: 'string', minLength: 1 } },
        timestamp: { type: 'string', pattern: '^\\d{2}:\\d{2}:\\d{2}$' },
        identifier: { type: 'string', format: 'uuid' },
        formatted: { type: 'string', format: 'custom-format' }
      }, required: ['minLength'],
      $defs: { Nested: { type: 'object', properties: { note: { anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] } } } }
    }
    const before = JSON.stringify(original)
    const wire = transformAnthropicJsonSchema(original)
    expect(JSON.stringify(original)).toBe(before)
    expect(wire).toMatchObject({
      additionalProperties: false,
      properties: {
        minLength: { type: 'string', description: 'A label.\nConstraints checked locally: minLength=1; maxLength=10.' },
        amount: { type: 'number', description: expect.stringContaining('minimum=1') },
        tags: { type: 'array', minItems: 1, description: expect.stringContaining('minItems=3') },
        timestamp: { pattern: '^\\d{2}:\\d{2}:\\d{2}$' },
        identifier: { format: 'uuid' },
        formatted: { description: expect.stringContaining('format="custom-format"') }
      },
      $defs: { Nested: { additionalProperties: false, properties: { note: { anyOf: [{ type: 'string', description: expect.stringContaining('minLength=1') }, { type: 'null' }] } } } }
    })
    const properties = wire['properties'] as Record<string, Record<string, unknown>>
    expect(properties['minLength']).not.toHaveProperty('minLength')
    expect(properties['amount']).not.toHaveProperty('minimum')
    expect(properties['tags']).not.toHaveProperty('maxItems')
    expect(properties['formatted']).not.toHaveProperty('format')
  })

  for (const preset of ['freeform', 'shortSummary', 'pdfChapterBoundaries'] as const) {
    test(`resolved ${preset} schema dispatch transforms unsupported constraints before the Claude request`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-claude-key'
      const resolved = await resolveStructuredSchema(preset === 'freeform' ? [] : [preset], { fallbackToFreeformEnvelope: preset === 'freeform' })
      const original = JSON.stringify(resolved.jsonSchema)
      const calls = installMockFetch(() => Response.json({ content: [{ type: 'text', text: '{"content":"synthetic"}' }], usage: { input_tokens: 10, output_tokens: 5 } }))
      await runAnthropicModel('Return the requested structured output.', model, { schemaName: resolved.schemaName, schema: resolved.jsonSchema, strict: false, strategy: 'native' })
      expect(calls).toHaveLength(1)
      expect(calls[0]?.url).toBe('https://api.anthropic.com/v1/messages')
      const output = calls[0]?.bodyJson?.['output_config'] as { format: { type: string, schema: Record<string, unknown> } }
      expect(output.format.type).toBe('json_schema')
      assertSupportedSchema(output.format.schema)
      expect(JSON.stringify(output.format.schema)).toContain('Constraints checked locally:')
      expect(JSON.stringify(resolved.jsonSchema)).toBe(original)
    })
  }

  for (const valid of [true, false]) {
    test(`actual Claude dispatch keeps ${valid ? 'valid' : 'empty invalid'} freeform output subject to its original local validator`, async () => {
      process.env['ANTHROPIC_API_KEY'] = 'mock-claude-key'
      const resolved = await resolveStructuredSchema([], { fallbackToFreeformEnvelope: true })
      const content = valid ? 'Synthetic text.' : ''
      const calls = installMockFetch(() => Response.json({ model, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ content }) }], usage: { input_tokens: 10, output_tokens: 5 } }))
      await lifecycle.withDir(async dir => {
        const result = await runLlmTargetsForStructuredPrompt({ prompt: 'Write a brief note.', outputDir: dir, targets: collectLlmTargets({ outputDir: dir, anthropicModels: [model] }), structuredSchema: resolved, structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] } })
        expect(result[0]?.metadata.validationFailed).toBe(!valid)
        const saved = await Bun.file(join(dir, 'text.json')).json()
        expect(saved).toMatchObject(valid ? { content } : { _raw: '{"content":""}', _validationError: expect.any(String) })
        expect(v.safeParse(resolved.schema, { content: '' }).success).toBe(false)
        for (const call of calls) {
          const config = call.bodyJson?.['output_config'] as { format: { schema: Record<string, unknown> } }
          assertSupportedSchema(config.format.schema)
        }
      })
      expect(calls).toHaveLength(valid ? 1 : 2)
    })
  }
})
