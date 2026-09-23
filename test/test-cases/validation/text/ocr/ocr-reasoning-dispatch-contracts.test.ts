import { expect, test } from 'bun:test'
import { processOcrSingle } from '~/cli/commands/sources/download/download-targets/single/document-runner'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const lifecycle = setupContractSuiteLifecycle({ envKeys: ['XAI_API_KEY'], tempPrefix: 'autoshow-ocr-reasoning-' })
for (const effort of [undefined, 'low', 'xhigh', 'default'] as const) {
  test(`document input carries ${effort ?? 'omitted'} reasoning through Grok dispatch and saved identity`, async () => {
    await lifecycle.withDir(async dir => {
      process.env['XAI_API_KEY'] = 'test'
      const calls = installMockFetch(() => Response.json({ model: 'grok-4.6', choices: [{ message: { content: 'A workshop repairs bicycles.' } }], usage: { prompt_tokens: 100, completion_tokens: 10 } }))
      const flags = { 'grok-ocr': 'grok-4.6', ...(effort ? { 'reasoning-effort': effort } : {}) }
      const opts = buildOptsFromFlags(flags, {}, new Set(Object.keys(flags)), { scope: 'extract' })
      const { outputDir } = await processOcrSingle('input/examples/document/1-document.png', dir, opts)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.bodyJson?.['reasoning_effort']).toBe(effort && effort !== 'default' ? effort : undefined)
      const manifest = await readManifest(outputDir)
      const metadata = manifest?.items[0]?.providers[0]?.metadata
      expect(metadata?.['requestedReasoningEffort']).toBe(effort)
      expect(metadata?.['effectiveReasoningEffort']).toBe(effort ?? 'default')
    })
  })
}
