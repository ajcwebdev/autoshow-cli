import { afterEach, expect, test } from 'bun:test'
import { mkdir, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { runCliInProcess } from '~/cli/create-cli'
import { resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { configureOutputRoot, getOutputRoot } from '~/cli/commands/command-shared/output-root'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { readObservedAudio } from '~/cli/commands/audio/tts/script-to-audio/attempt-io'
import { dispatchResume } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { captureConsoleText, captureProcessOutput } from '../../../../../test-utils/console-capture'
import { jsonResponse } from '../../../../../test-utils/rest-contract-helpers'
import type { MockFetchCall } from '~/types'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { LITE, batchAudio, wav } from './gemini-fixtures'

const { makeTempDir } = setupTtsContractLifecycle()
const originalOutputRoot = getOutputRoot()
afterEach(() => { resetPinnedRunDir(); configureOutputRoot(originalOutputRoot) })
const emptyConfig = 'test/test-utils/fixtures/empty-autoshow-config.json'
const providers = ['--provider', `gemini=${LITE}`, '--provider', 'soniox=tts-rt-v2', '--gemini-tts-mode', 'batch']
// Same documented Soniox REST endpoint asserted in soniox-contracts.test.ts.
const SONIOX_URL = 'https://tts-rt.soniox.com/tts'

const prepareInput = async (directory: boolean, extension = 'txt') => {
  const root = await makeTempDir('gemini-mixed-provider-')
  const input = join(root, directory ? 'input' : `source.${extension}`)
  if (directory) {
    await mkdir(input)
    await Bun.write(join(input, '01.txt'), 'The first short narration.')
    await Bun.write(join(input, '02.txt'), 'The second short narration.')
  } else await Bun.write(input, 'A short narration for both providers.')
  return { root, input, outputRoot: join(root, 'outputs') }
}

const writeBudgetConfig = async (root: string, maxCents: number) => {
  const path = join(root, `budget-${maxCents}.json`)
  await Bun.write(path, JSON.stringify({ pricing: { maxCents } }))
  return path
}

const runCli = async (args: string[], config = emptyConfig, quiet = true) => {
  const captured = await captureProcessOutput(() => runCliInProcess([...args, '--config-path', config, '--json', ...(quiet ? ['--quiet'] : [])]))
  const lines = captured.stdout.trim().split('\n')
  expect(lines, captured.stdout).toHaveLength(1)
  return { exitCode: captured.result, envelope: JSON.parse(lines[0]!), stderr: captured.stderr }
}

const runJson = async (args: string[], config = emptyConfig) => {
  const { exitCode, envelope } = await runCli(args, config)
  expect(exitCode, JSON.stringify(envelope)).toBe(0)
  expect(envelope).toMatchObject({ type: 'result', status: 'success', exitCode: 0 })
  return envelope.data
}

// Resolves Gemini's pending batch with one inline response per submitted request.
const installProviderMocks = (options: { sonioxStatus?: number, invalidGeminiAudio?: boolean, holdBatchUntilSoniox?: boolean } = {}) => {
  let requests: Array<{ metadata: { key: string } }> = []
  let releaseBatch!: () => void
  const sonioxDispatched = new Promise<void>(resolve => { releaseBatch = resolve })
  const calls = installMockFetch(async (call: MockFetchCall) => {
    if (call.method === 'POST' && call.url === SONIOX_URL) {
      releaseBatch()
      return options.sonioxStatus ? new Response('{"error":"rejected by fixture"}', { status: options.sonioxStatus }) : new Response(wav)
    }
    if (call.method === 'POST' && call.url.endsWith(`/models/${LITE}:batchGenerateContent`)) {
      const body = call.bodyJson as { batch: { inputConfig: { requests: { requests: typeof requests } } } }
      requests = body.batch.inputConfig.requests.requests
      return jsonResponse({ name: 'batches/mixed', metadata: { state: 'BATCH_STATE_PENDING' } })
    }
    if (call.method === 'GET' && call.url.endsWith('/batches/mixed')) {
      if (options.holdBatchUntilSoniox) {
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Soniox was not dispatched while the Gemini Batch wait was in progress')), 5000) })
        try { await Promise.race([sonioxDispatched, timeout]) } finally { clearTimeout(timer) }
      }
      const data = options.invalidGeminiAudio ? Buffer.from('invalid WAV').toString('base64') : undefined
      return jsonResponse({ name: 'batches/mixed', done: true, response: { inlinedResponses: { inlinedResponses: requests.map(request => ({ metadata: request.metadata, response: batchAudio(data) })) } } })
    }
    throw Error(`Unexpected fixture request: ${call.method} ${call.url}`)
  })
  return calls
}

const setCredentials = () => {
  process.env['GEMINI_API_KEY'] = 'mixed-gemini-fixture'
  process.env['SONIOX_API_KEY'] = 'mixed-soniox-fixture'
}

for (const directory of [false, true]) test(`mixed ${directory ? 'directory' : 'file'} price publishes one combined estimate with zero provider calls`, async () => {
  const { root, input, outputRoot } = await prepareInput(directory)
  const calls = installMockFetch(() => { throw Error('Network is not authorized for price preflight') })
  const base = ['tts', input, '--output-root', outputRoot, '--price']
  const gemini = await runJson([...base, '--provider', `gemini=${LITE}`, '--gemini-tts-mode', 'batch'])
  const soniox = await runJson([...base, '--provider', 'soniox=tts-rt-v2'])
  const combined = await runJson([...base, ...providers])
  expect(combined.dryRun).toBe(true)
  expect(combined.estimate.steps).toEqual([...gemini.estimate.steps, ...soniox.estimate.steps])
  expect(combined.estimate.totalEstimatedCostCents).toBeCloseTo(gemini.estimate.totalEstimatedCostCents + soniox.estimate.totalEstimatedCostCents, 10)
  // Separately scheduled workflows have no single processing time, so none is claimed.
  expect(combined.estimate.timing).toBeUndefined()
  expect(combined.geminiBatch).toEqual({ authorizationBoundCents: gemini.authorizationBoundCents, remoteJobs: gemini.remoteJobs, providerCalls: 0 })
  expect(combined.otherProviders).toEqual(soniox.estimate.timing ? { timing: soniox.estimate.timing } : {})
  expect(calls).toHaveLength(0)
  expect(await readdir(root)).toEqual([directory ? 'input' : 'source.txt'])
})

test('mixed text-mode price prints the combined total and the Gemini Batch bound', async () => {
  const { input, outputRoot } = await prepareInput(false)
  installMockFetch(() => { throw Error('Network is not authorized for price preflight') })
  const combined = await runJson(['tts', input, ...providers, '--output-root', outputRoot, '--price'])
  let exitCode: number | undefined
  const text = await captureConsoleText(async () => { exitCode = await runCliInProcess(['tts', input, ...providers, '--output-root', outputRoot, '--price', '--config-path', emptyConfig]) })
  expect(exitCode).toBe(0)
  const line = `${text.stdout}${text.stderr}`.split('\n').find(entry => entry.includes('Estimate: 2 steps'))
  expect(line).toContain(`(${combined.estimate.totalEstimatedCostCents.toFixed(3)}¢)`)
  expect(line).toContain(`Gemini Batch bound ${combined.geminiBatch.authorizationBoundCents.toFixed(3)}¢`)
})

test('Gemini-only text-mode price prints its estimate and bound', async () => {
  const { input, outputRoot } = await prepareInput(false)
  installMockFetch(() => { throw Error('Network is not authorized for price preflight') })
  let exitCode: number | undefined
  const text = await captureConsoleText(async () => { exitCode = await runCliInProcess(['tts', input, '--provider', `gemini=${LITE}`, '--gemini-tts-mode', 'batch', '--output-root', outputRoot, '--price', '--config-path', emptyConfig]) })
  expect(exitCode).toBe(0)
  expect(`${text.stdout}${text.stderr}`).toMatch(/Estimate: 1 step, .*\(\d+\.\d{3}¢\), Gemini Batch bound \d+\.\d{3}¢/)
})

test('mixed directory price with --max-model-cents keeps Gemini out of direct synthesis', async () => {
  const { input, outputRoot } = await prepareInput(true)
  installMockFetch(() => { throw Error('Network is not authorized for price preflight') })
  const combined = await runJson(['tts', input, ...providers, '--output-root', outputRoot, '--price', '--max-model-cents', '1000'])
  const geminiSteps = combined.estimate.steps.filter((step: { provider: string }) => step.provider === 'gemini')
  expect(geminiSteps).toHaveLength(2)
  expect(geminiSteps.every((step: { executionMode: string }) => step.executionMode === 'batch')).toBe(true)
  expect(combined.estimate.steps.filter((step: { provider: string }) => step.provider === 'soniox')).toHaveLength(2)
})

for (const price of [false, true]) test(`mixed Batch --output-dir is rejected before provider dispatch${price ? ' in price mode too' : ''}`, async () => {
  const { input, outputRoot } = await prepareInput(false)
  const calls = installMockFetch(() => { throw Error('No dispatch is authorized') })
  const { exitCode, envelope } = await runCli(['tts', input, ...providers, '--output-dir', outputRoot, ...(price ? ['--price'] : [])])
  expect(exitCode).toBe(2)
  expect(envelope.message).toContain('--output-root')
  expect(calls).toHaveLength(0)
})

test('mixed Batch rejects an unsupported input file before Gemini submission', async () => {
  const { input, outputRoot } = await prepareInput(false, 'rtf')
  setCredentials()
  const calls = installMockFetch(() => { throw Error('No dispatch is authorized') })
  const { exitCode, envelope } = await runCli(['tts', input, ...providers, '--output-root', outputRoot])
  expect(exitCode).toBe(2)
  expect(envelope.message).toContain('only accepts .md or .txt')
  expect(calls).toHaveLength(0)
  expect(await Bun.file(outputRoot).exists()).toBe(false)
})

test('mixed Batch rejects a blocked other provider before Gemini submission', async () => {
  const { input, outputRoot } = await prepareInput(false)
  process.env['GEMINI_API_KEY'] = 'mixed-gemini-fixture'
  delete process.env['SONIOX_API_KEY']
  const calls = installMockFetch(() => { throw Error('No dispatch is authorized') })
  const { exitCode, envelope } = await runCli(['tts', input, ...providers, '--output-root', outputRoot])
  expect(exitCode).toBe(2)
  expect(envelope.message).toContain('no Gemini Batch jobs were submitted')
  expect(envelope.message).toContain('SONIOX_API_KEY')
  expect(calls).toHaveLength(0)
})

test('mixed Batch enforces --max-cents on the combined bound before dispatch, and --allow-over-budget overrides only the combined overage', async () => {
  const { root, input, outputRoot } = await prepareInput(false)
  setCredentials()
  installMockFetch(() => { throw Error('Network is not authorized for price preflight') })
  const priced = await runJson(['tts', input, ...providers, '--output-root', outputRoot, '--price'])
  const bound = priced.geminiBatch.authorizationBoundCents as number
  const sonioxCents = (priced.estimate.steps as Array<{ provider: string, totalCostCents: number }>).find(step => step.provider === 'soniox')!.totalCostCents
  expect(sonioxCents).toBeGreaterThan(0)

  const between = await writeBudgetConfig(root, bound + sonioxCents / 2)
  let calls = installProviderMocks()
  const rejected = await runCli(['tts', input, ...providers, '--output-root', outputRoot], between)
  expect(rejected.exitCode).toBe(2)
  expect(rejected.envelope.message).toContain('plus other providers\' estimate')
  expect(calls).toHaveLength(0)

  const belowBound = await writeBudgetConfig(root, bound / 2)
  const boundRejected = await runCli(['tts', input, ...providers, '--output-root', outputRoot, '--allow-over-budget'], belowBound)
  expect(boundRejected.exitCode).toBe(2)
  expect(boundRejected.envelope.message).toContain('Gemini Batch conservative bound')
  expect(calls).toHaveLength(0)

  calls = installProviderMocks()
  const allowed = await runCli(['tts', input, ...providers, '--output-root', outputRoot, '--gemini-tts-batch-wait-seconds', '0', '--allow-over-budget'], between, false)
  expect(allowed.exitCode, JSON.stringify(allowed.envelope)).toBe(0)
  expect(allowed.stderr).toContain('continuing because --allow-over-budget is set')
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(2)
}, 20000)

for (const directory of [false, true]) for (const wait of [0, 60]) test(`transport success and decoded artifact integrity: mixed ${directory ? 'directory' : 'file'} synthesis with Batch wait=${wait} publishes both workflows once`, async () => {
  const { input, outputRoot } = await prepareInput(directory)
  setCredentials()
  const calls = installProviderMocks()
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
  const standardRoot = resolve(result.otherProviders.outputDir), batchRoot = resolve(result.geminiBatch.outputDir)
  expect(standardRoot).not.toBe(batchRoot)
  const standardManifest = (await readManifest(standardRoot))!
  expect(standardManifest.items.map(item => item.status)).toEqual(Array(itemCount).fill('full'))
  expect(standardManifest.items.every(item => item.providers[0]?.service === 'soniox')).toBe(true)
  expect((await readManifest(batchRoot))?.providerJobs?.provider).toBe('gemini')
  // Transport success: one Batch submission plus one Soniox request per item.
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1 + itemCount)
  expect(calls.filter(call => call.method === 'GET')).toHaveLength(wait === 0 ? 0 : 1)
  // Decoded artifact integrity: every Soniox output decodes to the fixture duration.
  const audioFiles = Object.entries(result.otherProviders.files as Record<string, string>).filter(([key]) => key.startsWith('audio'))
  expect(audioFiles).toHaveLength(itemCount)
  for (const [, path] of audioFiles) expect((await readObservedAudio(standardRoot, resolve(path))).durationMs).toBe(300)
  await dispatchResume(batchRoot, { 'provider-job-action': 'wait' })
  await dispatchResume(standardRoot, {})
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1 + itemCount)
}, 20000)

test('transport success: other providers synthesize while the Gemini Batch wait is still in progress', async () => {
  const { input, outputRoot } = await prepareInput(false)
  setCredentials()
  // The Batch poll only completes once Soniox has been called, so sequential workflows would time out here.
  const calls = installProviderMocks({ holdBatchUntilSoniox: true })
  const result = await runJson(['tts', input, ...providers, '--gemini-tts-batch-wait-seconds', '60', '--output-root', outputRoot])
  expect(result.geminiBatch.completedSlots).toBe(1)
  expect(calls.filter(call => call.url === SONIOX_URL)).toHaveLength(1)
  expect(calls.filter(call => call.method === 'GET')).toHaveLength(1)
}, 20000)

test('an other-provider failure keeps the submitted Gemini Batch pointer in the failure result', async () => {
  const { input, outputRoot } = await prepareInput(false)
  setCredentials()
  const calls = installProviderMocks({ sonioxStatus: 400 })
  const { exitCode, envelope } = await runCli(['tts', input, ...providers, '--gemini-tts-batch-wait-seconds', '0', '--output-root', outputRoot])
  expect(exitCode).toBe(2)
  expect(envelope.status).toBe('failure')
  expect(envelope.message).toContain('Gemini Batch: Gemini Batch submitted')
  expect(envelope.message).toContain('Other providers failed')
  const gemini = envelope.error.metadata.geminiBatch
  expect(gemini.providerJobs).toEqual([{ jobId: 'batches/mixed', state: 'pending', model: LITE }])
  expect(await Bun.file(join(resolve(gemini.outputDir), 'gemini-provider-jobs.json')).exists()).toBe(true)
  expect(envelope.hints).toContain(`Gemini remote jobs retained. Resume: ${gemini.resumeCommand}`)
  expect(envelope.error.metadata.otherProviders.error.message).toBeString()
  expect(calls.filter(call => call.method === 'POST' && call.url !== SONIOX_URL)).toHaveLength(1)
}, 20000)

test('decoded artifact integrity: a failed Gemini Batch slot still publishes the other providers\' audio', async () => {
  const { input, outputRoot } = await prepareInput(false)
  setCredentials()
  installProviderMocks({ invalidGeminiAudio: true })
  const { exitCode, envelope } = await runCli(['tts', input, ...providers, '--gemini-tts-batch-wait-seconds', '60', '--output-root', outputRoot])
  expect(exitCode).toBe(2)
  expect(envelope.message).toContain('Gemini Batch failed')
  expect(envelope.message).toContain('Other providers: Complete')
  const { geminiBatch, otherProviders } = envelope.error.metadata
  expect(geminiBatch.failedSlots).toEqual([expect.objectContaining({ error: 'invalid-or-incomplete-audio' })])
  expect(geminiBatch.outputs).toEqual([])
  const audio = Object.entries(otherProviders.files as Record<string, string>).filter(([key]) => key.startsWith('audio'))
  expect(audio).toHaveLength(1)
  expect((await readObservedAudio(resolve(otherProviders.outputDir), resolve(audio[0]![1]))).durationMs).toBe(300)
}, 20000)
