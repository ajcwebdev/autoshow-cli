import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { WriteRuntimeOptions } from '~/types'
import { runTextWrite } from '~/cli/commands/text/write/run-text-write'
import { runOpenAIModel } from '~/cli/commands/text/write/write-services/write-openai/run-openai'
import { llmRequestSettings } from '~/cli/commands/text/write/write-utils/llm-request-settings'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, structuredOpts, withTempDir } from '../../providers/openai-rest-contracts/shared'

installOpenAIRestContractHooks()

const PROMPT_MARKER = 'UNIQUE-PROMPT-MARKER-7f3a'

describe('write provider settings in run records', () => {
  test('recorded request settings drop prompt text and hash JSON schemas', () => {
    const settings = llmRequestSettings({
      model: 'gpt-5.6-sol',
      input: PROMPT_MARKER,
      reasoning: { effort: 'high' },
      text: { format: { type: 'json_schema', name: 'summary', schema: { type: 'object' } } },
    })
    expect(JSON.stringify(settings)).not.toContain(PROMPT_MARKER)
    expect(settings).toEqual({
      model: 'gpt-5.6-sol',
      reasoning: { effort: 'high' },
      text: { format: { type: 'json_schema', name: 'summary', schemaSha256: expect.stringMatching(/^[0-9a-f]{64}$/) } },
    })
  })

  test('OpenAI runner reports the dispatched request settings, not the requested flags', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-key'
    const calls = installFetch(() => jsonResponse({ model: 'gpt-5.6-sol', output_text: '{"summary":"ok"}', usage: { input_tokens: 5, output_tokens: 3 } }))
    const result = await runOpenAIModel(PROMPT_MARKER, 'gpt-5.6-sol', { ...structuredOpts, requestedReasoningEffort: 'high' })
    expect(calls).toHaveLength(1)
    const body = calls[0]?.bodyJson as Record<string, unknown>
    expect(result.metadata.requestSettings).toEqual(llmRequestSettings(body))
    expect(result.metadata.requestSettings).toMatchObject({ model: 'gpt-5.6-sol', stream: false, reasoning: { effort: 'high' } })
  })

  test('write manifest records one provider entry with request and local settings', async () => {
    await withTempDir(async (dir) => {
      process.env['OPENAI_API_KEY'] = 'openai-key'
      const calls = installFetch(() => jsonResponse({ model: 'gpt-5.6-sol', output_text: '{"summary":"ok"}', usage: { input_tokens: 5, output_tokens: 3 } }))
      const inputPath = join(dir, 'notes.md')
      await Bun.write(inputPath, `# Notes\n\n${PROMPT_MARKER} body text.\n`)
      const promptFile = join(dir, 'prompt.txt')
      await Bun.write(promptFile, 'Summarize briefly.')
      const flags = { openai: 'gpt-5.6-sol', 'prompt-file': promptFile }
      const opts = {
        ...buildOptsFromFlags(flags, {}, new Set(Object.keys(flags)), { scope: 'write' }),
        configPath: undefined,
      } as WriteRuntimeOptions
      const { outputDir } = await runTextWrite(inputPath, dir, opts)
      const manifest = await readManifest(outputDir)
      const providers = manifest?.items[0]?.providers ?? []
      expect(providers).toHaveLength(1)
      const provider = providers[0]
      expect(provider).toMatchObject({ service: 'openai', model: 'gpt-5.6-sol', status: 'succeeded', options: {} })
      expect(provider?.settings).toMatchObject({
        schemaVersion: 1,
        settingsSchema: 'openai.write.v1',
        local: { promptFile: { sha256: expect.stringMatching(/^[0-9a-f]{64}$/) }, structuredMode: 'native' },
      })
      expect(calls).toHaveLength(1)
      expect(provider?.settings?.request).toEqual({ ...llmRequestSettings(calls[0]?.bodyJson as Record<string, unknown>), effectiveReasoningEffort: 'default' })
      expect(JSON.stringify(manifest)).not.toContain(PROMPT_MARKER)
      const step3 = manifest?.items[0]?.metadata['step3'] as Record<string, unknown>
      expect(step3).not.toHaveProperty('requestSettings')
    })
  })
})
