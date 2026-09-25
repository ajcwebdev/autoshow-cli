import { expect, test } from 'bun:test'
import { join, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { prepareTtsInput } from '~/cli/commands/audio/tts/tts-single-run'
import { runTtsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { normalizeTtsTurnControls } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { validateTtsBenchmarkContent } from '~/tools/tts-benchmark-content'
import type { TtsTurnControls } from '~/types'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { FLASH, LITE, unary } from './gemini-fixtures'

const { makeTempDir } = setupTtsContractLifecycle()
const runner = resolve('src/tools/tts-controls-benchmark.ts')
const entries = async (suite: string) => (await Bun.file('test/fixtures/tts-controls/' + suite + '/benchmark-plan.json').json()).cases.filter((entry: { provider: string }) => entry.provider === 'gemini')

for (const suite of ['emotion', 'speed-pauses']) for (const model of [FLASH, LITE]) {
  test(model + ' ' + suite + ' benchmark dispatch separates five spoken turns and documented metadata; mocked audio proves integrity only', async () => {
    const entry = (await entries(suite)).find((entry: { model: string }) => entry.model === model)
    validateTtsBenchmarkContent(entry)
    process.env['GEMINI_API_KEY'] = 'benchmark-fixture'
    const calls = installMockFetch(() => jsonResponse(unary()))
    const options = { ...buildOptsFromFlags(entry.flags, {}, new Set(Object.keys(entry.flags)), { scope: 'tts' }), ttsTurnControls: normalizeTtsTurnControls(entry.turnControls as TtsTurnControls), ttsChunkConcurrency: 1 }
    const prepared = await prepareTtsInput(entry.input, options, new Date().toISOString())
    const output = await makeTempDir('gemini-benchmark-controls-')
    const result = await runTtsForTargets(prepared.text, output, options, collectTtsTargets(options), prepared)
    expect(result.metadata).toHaveLength(1)
    expect(calls).toHaveLength(5)
    const spoken = suite === 'emotion'
      ? ['I sound calm. All is well.', 'I sound excited! This is great news!', 'I sound sad. I miss my friend.', 'I sound angry. That is not fair!', 'I sound afraid. Please stay with me.']
      : ['I speak at a normal pace. One, two, three, four, five.', 'I speak slowly. One, two, three, four, five.', 'I speak fast. One, two, three, four, five.', 'I pause here. <short pause> Then I speak.', 'I take a long pause here. <long pause> Then I speak.']
    const styles = suite === 'emotion' ? ['calm reassurance', 'bright excitement', 'sincere sadness', 'controlled anger', 'clear fear'] : ['ordinary', 'slow', 'fast', 'qualitative inline pause', 'qualitative inline pause']
    for (const [index, call] of calls.entries()) {
      expect(JSON.stringify(call.bodyJson)).not.toContain('"speaker":')
      expect(call).toMatchObject({ url: 'https://generativelanguage.googleapis.com/v1beta/interactions', method: 'POST', bodyJson: { model, input: [{ content: [{ text: spoken[index], annotations: [{ type: 'speech_metadata', style: expect.stringContaining(styles[index]!) }] }] }], response_format: { mime_type: 'audio/wav' }, generation_config: { speech_config: [{ voice: 'Kore' }] } } })
    }
    expect(result.metadata[0]?.audioFileSize).toBeGreaterThan(44)
  }, 20000)
}

test('benchmark provider filtering and price are isolated; run rejects the conservative combined bound before dispatch', async () => {
  const root = await makeTempDir('gemini-benchmark-price-')
  for (const suite of ['emotion', 'speed-pauses']) {
    const cases = await entries(suite)
    for (const entry of cases) entry.input = resolve(entry.input)
    await Bun.write(join(root, 'input/examples/tts/controls', suite, 'benchmark-plan.json'), JSON.stringify({ schemaVersion: 1, cases }))
  }
  const ledgerPath = join(root, 'input/examples/tts/controls/benchmark-plan.json')
  const ledger = JSON.stringify({ schemaVersion: 2, priorEstimatedCents: 100, outputBase: 'benchmark-output' })
  await Bun.write(ledgerPath, ledger)
  const invoke = async (args: string[]) => {
    const process = Bun.spawn([Bun.which('bun')!, '--no-env-file', runner, ...args], { cwd: root, env: { PATH: Bun.env['PATH'] ?? '' }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
    return { stdout, stderr, code }
  }
  const price = await invoke(['--provider', 'gemini', '--price'])
  expect(price.code).toBe(0)
  const result = JSON.parse(price.stdout)
  expect(result.cases).toHaveLength(4)
  expect(result.incrementalAuthorizationCents).toBeGreaterThan(result.incrementalCents)
  const selected = await invoke(['--provider', 'gemini=' + LITE, '--suite', 'emotion', '--price'])
  expect(selected.code).toBe(0)
  expect(JSON.parse(selected.stdout).cases.map((entry: { id: string }) => entry.id)).toEqual(['gemini-' + LITE + '-instructions'])
  const run = await invoke(['--provider', 'gemini', '--run'])
  expect(run.code).not.toBe(0)
  expect(run.stderr).toContain('Combined spending bound exceeds')
  const missing = await invoke(['--provider', 'gemini=unknown', '--price'])
  expect(missing.code).not.toBe(0)
  expect(missing.stderr).toContain('No documented cases')
  expect(await Bun.file(ledgerPath).text()).toBe(ledger)
  expect(await readdir(root)).toEqual(['input'])
})
