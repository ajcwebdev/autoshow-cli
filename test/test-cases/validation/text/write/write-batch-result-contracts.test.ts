import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { runCliInProcess } from '~/cli/create-cli'
import { configureOutputRoot, getOutputRoot } from '~/cli/commands/command-shared/output-root'
import { resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { captureProcessOutput } from '../../../../test-utils/console-capture'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY'],
  tempPrefix: 'autoshow-write-batch-result-',
  beforeEachExtra: () => {
    process.env['OPENAI_API_KEY'] = 'synthetic-key'
  }
})

describe('write batch terminal results', () => {
  for (const concurrency of [1, 2]) {
    test(`concurrency ${concurrency} publishes one JSON result for both completed writes`, async () => {
      const root = await tempDirs.make()
      const input = join(root, 'input')
      const output = join(root, 'output')
      await mkdir(input)
      await Bun.write(join(input, 'first.txt'), 'A workshop repairs bicycles.')
      await Bun.write(join(input, 'second.txt'), 'A library lends books.')
      const calls = installMockFetch(() => jsonResponse({
        model: 'gpt-6-astra',
        output_text: '{"episodeDescription":"A brief synthetic summary."}',
        usage: { input_tokens: 40, output_tokens: 12 }
      }))
      const previousOutputRoot = getOutputRoot()

      try {
        const captured = await captureProcessOutput(() => runCliInProcess([
          'write', input, '--provider', 'openai=gpt-6-astra', '--prompt', 'shortSummary',
          '--batch-limit', 'all', '--batch-concurrency', String(concurrency), '--output-dir', output,
          '--config-path', join(root, 'absent-config.json'), '--json'
        ]))
        const results = captured.stdout.trim().split('\n').map(line => JSON.parse(line))
        expect(captured.result, captured.stderr).toBe(0)
        const manifest = await Bun.file(join(output, 'manifest.json')).json()
        expect(calls).toHaveLength(2)
        expect(results).toHaveLength(1)
        expect(results[0]).toMatchObject({ status: 'success', exitCode: 0, data: { outputDir: output, files: { manifest: join(output, 'manifest.json') } } })
        expect(manifest.items).toHaveLength(2)
        expect(manifest.items.map((item: { status: string }) => item.status)).toEqual(['full', 'full'])
        expect(captured.stderr).not.toContain('without staging a terminal result')
      } finally {
        resetPinnedRunDir()
        configureOutputRoot(previousOutputRoot)
      }
    })
  }

  test('a batch whose inputs all fail publishes a failure result', async () => {
    const root = await tempDirs.make()
    const input = join(root, 'input')
    const output = join(root, 'output')
    await mkdir(input)
    await Bun.write(join(input, 'first.txt'), '')
    await Bun.write(join(input, 'second.txt'), '')
    const calls = installMockFetch(() => {
      throw new Error('Empty inputs must fail before provider dispatch')
    })
    const previousOutputRoot = getOutputRoot()

    try {
      const captured = await captureProcessOutput(() => runCliInProcess([
        'write', input, '--provider', 'openai=gpt-6-astra', '--prompt', 'shortSummary',
        '--batch-limit', 'all', '--output-dir', output, '--config-path', join(root, 'absent-config.json'), '--json'
      ]))
      const results = captured.stdout.trim().split('\n').map(line => JSON.parse(line))

      expect(captured.result).not.toBe(0)
      expect(calls).toHaveLength(0)
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({ status: 'failure', message: 'Batch processing failed for 2 item(s)' })
      expect(captured.stderr).not.toContain('without staging a terminal result')
    } finally {
      resetPinnedRunDir()
      configureOutputRoot(previousOutputRoot)
    }
  })
})
