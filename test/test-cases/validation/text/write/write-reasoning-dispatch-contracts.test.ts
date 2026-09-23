import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { runTextWrite } from '~/cli/commands/text/write/run-text-write'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import type { WriteRuntimeOptions } from '~/types'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, withTempDir } from '../../providers/openai-rest-contracts/shared'

installOpenAIRestContractHooks()
for (const effort of [undefined, 'low', 'xhigh', 'default'] as const) {
  test(`text input carries ${effort ?? 'omitted'} reasoning through dispatch and the manifest`, async () => {
    await withTempDir(async dir => {
      process.env['OPENAI_API_KEY'] = 'test'
      const calls = installFetch(() => jsonResponse({ model: 'gpt-6-astra', output_text: '{"episodeDescription":"A workshop repairs bicycles."}', usage: { input_tokens: 40, output_tokens: 12 } }))
      const input = join(dir, 'source.txt')
      await Bun.write(input, 'A workshop repairs bicycles for residents.')
      const flags = { openai: 'gpt-6-astra', prompt: ['shortSummary'], ...(effort ? { 'reasoning-effort': effort } : {}) }
      const opts = { ...buildOptsFromFlags(flags, {}, new Set(Object.keys(flags)), { scope: 'write' }), configPath: undefined } as WriteRuntimeOptions
      const { outputDir } = await runTextWrite(input, dir, opts)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.bodyJson?.['reasoning']).toEqual(effort && effort !== 'default' ? { effort } : undefined)
      const manifest = await readManifest(outputDir)
      const metadata = manifest?.items[0]?.metadata['step3'] as Record<string, unknown>
      expect(metadata['requestedReasoningEffort']).toBe(effort)
      expect(metadata['effectiveReasoningEffort']).toBe(effort ?? 'default')
      expect(manifest?.items[0]?.providers[0]?.settings?.request['effectiveReasoningEffort']).toBe(effort ?? 'default')
    })
  })
}
