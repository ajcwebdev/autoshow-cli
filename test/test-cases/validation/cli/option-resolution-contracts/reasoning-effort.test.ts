import { describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import * as v from 'valibot'
import type { ExtractionOptions, LLMTarget, PipelineManifestItem, ResolvedStructuredSchema, Step3Metadata, StructuredRequestOptions, WriteRuntimeOptions } from '~/types'
import { resolveOcrExtractionOptions } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-extraction-options'
import { runLlmTargetsForStructuredPrompt } from '~/cli/commands/process-steps/step-3-write/run-llm'
import { writeResumeConfig } from '~/cli/commands/setup-and-utilities/resume/write/write-resume'
import {
  applyAnthropicReasoning,
  applyOpenAIResponsesReasoning
} from '~/cli/commands/setup-and-utilities/models/reasoning-request-mappers'
import {
  parseReasoningEffort,
  resolveReasoningPolicy
} from '~/cli/commands/setup-and-utilities/models/reasoning-resolver'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildLlmEstimates } from '~/cli/commands/pricing-orchestration/aggregate-pricing/llm-estimates'
import { buildExtractEstimates } from '~/cli/commands/process-steps/step-2-extract/extract-pricing/build-extract-estimates'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

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

describe('ADR-010 Reasoning Effort Resolution Contracts', () => {
  describe('parseReasoningEffort', () => {
    it('returns undefined for undefined input', () => {
      expect(parseReasoningEffort(undefined)).toBeUndefined()
    })

    it('parses all valid normalized reasoning effort levels', () => {
      expect(parseReasoningEffort('default')).toBe('default')
      expect(parseReasoningEffort('disabled')).toBe('disabled')
      expect(parseReasoningEffort('minimal')).toBe('minimal')
      expect(parseReasoningEffort('low')).toBe('low')
      expect(parseReasoningEffort('medium')).toBe('medium')
      expect(parseReasoningEffort('high')).toBe('high')
      expect(parseReasoningEffort('max')).toBe('max')
    })

    it('rejects invalid reasoning effort values', () => {
      expect(() => parseReasoningEffort('invalid')).toThrow()
      expect(() => parseReasoningEffort('extreme')).toThrow()
    })
  })

  describe('resolveReasoningPolicy - Adapter Defaults & Explicit Overrides', () => {
    it('returns adapter defaults only when the flag is omitted', () => {
      const groqPolicy = resolveReasoningPolicy({
        step: 'llm',
        service: 'groq',
        model: 'openai/gpt-oss-120b',
        requestedReasoningEffort: undefined
      })
      expect(groqPolicy.effective).toBe('low')

      const geminiOcrPolicy = resolveReasoningPolicy({
        step: 'extract',
        service: 'gemini',
        model: 'gemini-3.1-pro-preview',
        requestedReasoningEffort: 'default'
      })
      expect(geminiOcrPolicy.requested).toBe('default')
      expect(geminiOcrPolicy.effective).toBe('default')

      const kimiK26Policy = resolveReasoningPolicy({
        step: 'llm',
        service: 'kimi',
        model: 'kimi-k2.6',
        requestedReasoningEffort: undefined
      })
      expect(kimiK26Policy.effective).toBe('disabled')

      const kimiK3Policy = resolveReasoningPolicy({
        step: 'llm',
        service: 'kimi',
        model: 'kimi-k3',
        requestedReasoningEffort: undefined
      })
      expect(kimiK3Policy.effective).toBe('max')
    })

    it('accepts valid supported explicit effort overrides', () => {
      const groqPolicy = resolveReasoningPolicy({
        step: 'llm',
        service: 'groq',
        model: 'openai/gpt-oss-120b',
        requestedReasoningEffort: 'medium'
      })
      expect(groqPolicy.requested).toBe('medium')
      expect(groqPolicy.effective).toBe('medium')

      const geminiPolicy = resolveReasoningPolicy({
        step: 'llm',
        service: 'gemini',
        model: 'gemini-3.1-pro-preview',
        requestedReasoningEffort: 'high'
      })
      expect(geminiPolicy.requested).toBe('high')
      expect(geminiPolicy.effective).toBe('high')

      expect(resolveReasoningPolicy({
        step: 'llm',
        service: 'openai',
        model: 'gpt-5.4-nano',
        requestedReasoningEffort: 'disabled'
      }).effective).toBe('disabled')

      expect(resolveReasoningPolicy({
        step: 'llm',
        service: 'openai',
        model: 'gpt-5.6-sol',
        requestedReasoningEffort: 'max'
      }).effective).toBe('max')
    })

    it('rejects explicit effort on unsupported models before dispatch', () => {
      expect(() =>
        resolveReasoningPolicy({
          step: 'llm',
          service: 'anthropic',
          model: 'claude-haiku-4-5',
          requestedReasoningEffort: 'medium'
        })
      ).toThrow()

    })

    it('rejects disabled effort when model requires reasoning', () => {
      expect(() =>
        resolveReasoningPolicy({
          step: 'llm',
          service: 'kimi',
          model: 'kimi-k3',
          requestedReasoningEffort: 'disabled'
        })
      ).toThrow()

      expect(() =>
        resolveReasoningPolicy({
          step: 'llm',
          service: 'anthropic',
          model: 'claude-fable-5',
          requestedReasoningEffort: 'disabled'
        })
      ).toThrow()

      expect(resolveReasoningPolicy({
        step: 'llm',
        service: 'anthropic',
        model: 'claude-opus-5',
        requestedReasoningEffort: 'disabled'
      }).effective).toBe('disabled')
    })

    it('rejects disabled effort unless the model explicitly allows it', () => {
      expect(() =>
        resolveReasoningPolicy({
          step: 'llm',
          service: 'gemini',
          model: 'gemini-3.1-pro-preview',
          requestedReasoningEffort: 'disabled'
        })
      ).toThrow('does not support disabling reasoning')
    })

    it('rejects named effort levels for binary reasoning controls', () => {
      expect(() =>
        resolveReasoningPolicy({
          step: 'llm',
          service: 'kimi',
          model: 'kimi-k2.6',
          requestedReasoningEffort: 'medium'
        })
      ).toThrow('exposes no named effort levels')

      expect(resolveReasoningPolicy({
        step: 'llm',
        service: 'kimi',
        model: 'kimi-k2.6',
        requestedReasoningEffort: 'disabled'
      }).effective).toBe('disabled')
    })
  })

  describe('provider request mappings', () => {
    it('uses the nested Responses API reasoning object for OpenAI', () => {
      const requestBody: Record<string, unknown> = {}
      applyOpenAIResponsesReasoning(requestBody, 'high')
      expect(requestBody).toEqual({ reasoning: { effort: 'high' } })

      applyOpenAIResponsesReasoning(requestBody, 'disabled')
      expect(requestBody).toEqual({ reasoning: { effort: 'none' } })
    })

    it('uses Anthropic output_config effort without dropping existing output config', () => {
      const requestBody: Record<string, unknown> = {
        output_config: { format: { type: 'json_schema' } }
      }
      applyAnthropicReasoning(requestBody, 'medium')
      expect(requestBody).toEqual({
        output_config: {
          format: { type: 'json_schema' },
          effort: 'medium'
        }
      })
    })
  })

  describe('planning and dispatch integration', () => {
    it('retains the normalized policy in validated OCR execution options', () => {
      const options = resolveOcrExtractionOptions(
        '/tmp/input.pdf',
        { reasoningEffort: 'medium' } as Partial<ExtractionOptions>,
        '/tmp/output',
        'auto'
      )
      expect(options.reasoningEffort).toBe('medium')
    })

    it('passes the normalized request into a structured LLM target', async () => {
      const outputDir = await makeTempDir('autoshow-reasoning-dispatch-')
      let receivedOptions: StructuredRequestOptions | undefined
      const target: LLMTarget = {
        service: 'openai',
        label: 'OpenAI stub',
        model: 'gpt-5.5',
        run: async (_prompt, model, options) => {
          receivedOptions = options
          const metadata: Step3Metadata = {
            llmService: 'openai',
            llmModel: model,
            processingTime: 1,
            inputTokenCount: 1,
            outputTokenCount: 1,
            outputFileName: '',
            outputFormat: 'json',
            structuredMode: 'native',
            structuredPresetNames: []
          }
          return { result: '{"content":"ok"}', metadata }
        }
      }

      try {
        await runLlmTargetsForStructuredPrompt({
          prompt: 'Test prompt',
          outputDir,
          targets: [target],
          structuredSchema,
          structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] },
          reasoningEffort: 'high'
        })
        expect(receivedOptions?.requestedReasoningEffort).toBe('high')
      } finally {
        await rm(outputDir, { recursive: true, force: true })
      }
    })

    it('rejects an invalid multi-target policy before any target starts', async () => {
      let attempts = 0
      const target = (service: LLMTarget['service'], model: string): LLMTarget => ({
        service,
        label: service,
        model,
        run: async () => {
          attempts += 1
          throw new Error('target must not run')
        }
      })

      await expect(runLlmTargetsForStructuredPrompt({
        prompt: 'Test prompt',
        outputDir: '/tmp/autoshow-reasoning-preflight-not-used',
        targets: [
          target('openai', 'gpt-5.5'),
          target('anthropic', 'claude-haiku-4-5')
        ],
        structuredSchema,
        structuredValidationContext: { leafPromptNames: ['content'], presetNames: [] },
        reasoningEffort: 'high'
      })).rejects.toThrow('does not support reasoning effort configuration')
      expect(attempts).toBe(0)
    })

    it('validates and reports requested and effective effort during price planning', async () => {
      const estimates = await buildLlmEstimates({
        openaiModels: ['gpt-5.5'],
        reasoningEffort: 'high'
      }, false)
      expect(estimates).toHaveLength(1)
      expect(estimates[0]?.requestedReasoningEffort).toBe('high')
      expect(estimates[0]?.effectiveReasoningEffort).toBe('high')

      await expect(buildLlmEstimates({
        anthropicModels: ['claude-haiku-4-5'],
        reasoningEffort: 'high'
      }, false)).rejects.toThrow('does not support reasoning effort configuration')
    })

    it('does not apply hosted reasoning overrides to local OCR price targets', async () => {
      const estimates = await buildExtractEstimates(
        'input/examples/document/1-document.png',
        {
          route: 'ocr',
          sourceKind: 'image',
          providers: [{ service: 'tesseract', model: 'tesseract' }]
        },
        { reasoningEffort: 'high' }
      )
      expect(estimates).toHaveLength(1)
      expect(estimates[0]?.requestedReasoningEffort).toBeUndefined()
      expect(estimates[0]?.effectiveReasoningEffort).toBe('default')
    })

    it('rejects an explicit write-resume policy that differs from stored effective effort', () => {
      const entry: Step3Metadata = {
        llmService: 'openai',
        llmModel: 'gpt-5.5',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: [],
        requestedReasoningEffort: 'low',
        effectiveReasoningEffort: 'low'
      }
      const item = { status: 'incomplete', metadata: {}, providers: [] } as PipelineManifestItem
      const validateResume = writeResumeConfig.validateManifestForResume

      expect(validateResume?.(item, [entry], {
        reasoningEffort: 'high',
        openaiModels: ['gpt-5.5']
      } as WriteRuntimeOptions))
        .toContain('reasoning policy mismatch')
      expect(validateResume?.(item, [entry], {
        reasoningEffort: 'low',
        openaiModels: ['gpt-5.5']
      } as WriteRuntimeOptions))
        .toBeUndefined()
    })
  })

  describe('Option Resolution Flag Integration', () => {
    it('reads --reasoning-effort flag into buildOptsFromFlags', () => {
      const opts = buildOptsFromFlags(false, {
        'reasoning-effort': 'high',
        prompt: 'test prompt'
      })
      expect(opts.reasoningEffort).toBe('high')
    })

    it('defaults reasoningEffort to undefined when flag is omitted', () => {
      const opts = buildOptsFromFlags(false, {
        prompt: 'test prompt'
      })
      expect(opts.reasoningEffort).toBeUndefined()
    })
  })
})
