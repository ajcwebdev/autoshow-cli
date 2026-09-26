import { afterEach, expect, test } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { runCliInProcess } from '~/cli/create-cli'
import { resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { configureOutputRoot, getOutputRoot } from '~/cli/commands/command-shared/output-root'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { readObservedAudio } from '~/cli/commands/audio/tts/script-to-audio/attempt-io'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { captureProcessOutput } from '../../../../../test-utils/console-capture'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { LITE, batchAudio, wav } from './gemini-fixtures'

const { makeTempDir } = setupTtsContractLifecycle()
const originalOutputRoot = getOutputRoot()
afterEach(() => { resetPinnedRunDir(); configureOutputRoot(originalOutputRoot) })
const configArgs = ['--config-path', 'test/test-utils/fixtures/empty-autoshow-config.json']
const providers = ['--provider', `gemini=${LITE}`, '--provider', 'soniox=tts-rt-v2', '--gemini-tts-mode', 'batch']

const prepareInput = async (directory: boolean) => {
  const root = await makeTempDir('gemini-mixed-provider-')
  const input = join(root, directory ? 'input' : 'source.txt')
  if (directory) {
    await mkdir(input)
    await Bun.write(join(input, '01.txt'), 'The first short narration.')
    await Bun.write(join(input, '02.txt'), 'The second short narration.')
  } else await Bun.write(input, 'A short narration for both providers.')
  return { root, input, outputRoot: join(root, 'outputs') }
}

const runJson = async (args: string[]) => {
  const captured = await captureProcessOutput(() => runCliInProcess([...args, ...configArgs, '--json', '--quiet']))
  expect(captured.result, captured.stdout).toBe(0)
  const lines = captured.stdout.trim().split('\n')
  expect(lines).toHaveLength(1)
  const result = JSON.parse(lines[0]!)
  expect(result).toMatchObject({ type: 'result', status: 'success', exitCode: 0 })
  return result.data
}

for (const directory of [false, true]) test(`mixed ${directory ? 'directory' : 'file'} price publishes one combined estimate with zero provider calls`, async () => {
  const { root, input, outputRoot } = await prepareInput(directory)
  const calls = installMockFetch(() => { throw Error('Network is not authorized for price preflight') })
  const base = ['tts', input, '--output-root', outputRoot, '--price']
  const gemini = await runJson([...base, '--provider', `gemini=${LITE}`, '--gemini-tts-mode', 'batch'])
  const soniox = await runJson([...base, '--provider', 'soniox=tts-rt-v2'])
  const combined = await runJson([...base, ...providers])
  expect(combined.dryRun).toBe(true)
  expect(combined.geminiBatch).toEqual(gemini)
  expect(combined.estimate.steps).toEqual([...gemini.estimate.steps, ...soniox.estimate.steps])
  expect(combined.estimate.totalEstimatedCostCents).toBeCloseTo(gemini.estimate.totalEstimatedCostCents + soniox.estimate.totalEstimatedCostCents, 10)
  expect(calls).toHaveLength(0)
  expect(await readdir(root)).toEqual([directory ? 'input' : 'source.txt'])
})

for (const directory of [false, true]) for (const wait of [0, 60]) test(`mixed ${directory ? 'directory' : 'file'} synthesis with Batch wait=${wait} publishes both workflows once`, async () => {
  const { input, outputRoot } = await prepareInput(directory)
  process.env['GEMINI_API_KEY'] = 'mixed-gemini-fixture'
  process.env['SONIOX_API_KEY'] = 'mixed-soniox-fixture'
  let requests: Array<{ metadata: { key: string } }> = []
  const calls = installMockFetch(call => {
    // Same documented Soniox REST endpoint asserted in soniox-contracts.test.ts.
    if (call.method === 'POST' && call.url === 'https://tts-rt.soniox.com/tts') return new Response(wav)
    if (call.method === 'POST' && call.url.endsWith(`/models/${LITE}:batchGenerateContent`)) {
      const body = call.bodyJson as { batch: { inputConfig: { requests: { requests: typeof requests } } } }
      requests = body.batch.inputConfig.requests.requests
      return jsonResponse({ name: 'batches/mixed', metadata: { state: 'BATCH_STATE_PENDING' } })
    }
    if (call.method === 'GET' && call.url.endsWith('/batches/mixed')) {
      return jsonResponse({ name: 'batches/mixed', done: true, response: { inlinedResponses: { inlinedResponses: requests.map(request => ({ metadata: request.metadata, response: batchAudio() })) } } })
    }
    throw Error(`Unexpected fixture request: ${call.method} ${call.url}`)
  })
  const result = await runJson(['tts', input, ...providers, '--gemini-tts-batch-wait-seconds', String(wait), '--output-root', outputRoot])
  const itemCount = directory ? 2 : 1
  expect(result.dryRun).toBe(false)
  expect(result.geminiBatch).toMatchObject({
    totalSlots: itemCount,
    completedSlots: wait === 0 ? 0 : itemCount,
    providerJobs: [{ jobId: 'batches/mixed', state: wait === 0 ? 'pending' : 'completed', model: LITE }],
  })
  expect(result.geminiBatch.outputs).toHaveLength(wait === 0 ? 0 : itemCount)
  expect(result.geminiBatch.resumeCommand).toContain('resume')
  const standardRoot = resolve(result.outputDir), batchRoot = resolve(result.geminiBatch.outputDir)
  expect(standardRoot).not.toBe(batchRoot)
  const standardManifest = (await readManifest(standardRoot))!
  expect(standardManifest.items.map(item => item.status)).toEqual(Array(itemCount).fill('full'))
  expect(standardManifest.items.every(item => item.providers[0]?.service === 'soniox')).toBe(true)
  expect((await readManifest(batchRoot))?.providerJobs?.provider).toBe('gemini')
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1 + itemCount)
  expect(calls.filter(call => call.method === 'GET')).toHaveLength(wait === 0 ? 0 : 1)
  const audioFiles = Object.entries(result.files as Record<string, string>).filter(([key]) => key.startsWith('audio'))
  expect(audioFiles).toHaveLength(itemCount)
  for (const [, path] of audioFiles) expect((await readObservedAudio(standardRoot, resolve(path))).durationMs).toBe(300)
  await dispatchResume(batchRoot, { 'provider-job-action': 'wait' })
  await dispatchResume(standardRoot, {})
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1 + itemCount)
}, 20000)

test('mixed Batch output-dir rejects the incompatible directory request before provider dispatch', async () => {
  const { input, outputRoot } = await prepareInput(false)
  const calls = installMockFetch(() => { throw Error('No dispatch is authorized') })
  const captured = await captureProcessOutput(() => runCliInProcess(['tts', input, ...providers, '--output-dir', outputRoot, ...configArgs, '--json', '--quiet']))
  expect(captured.result).toBe(2)
  const lines = captured.stdout.trim().split('\n')
  expect(lines).toHaveLength(1)
  expect(JSON.parse(lines[0]!).message).toContain('--output-root')
  expect(calls).toHaveLength(0)
})
