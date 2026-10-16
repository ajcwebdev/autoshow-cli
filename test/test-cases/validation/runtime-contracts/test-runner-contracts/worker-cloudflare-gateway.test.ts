import { expect, test } from 'bun:test'
import type { TestRunArtifacts } from '~/types'
import { buildTestWorkerEnv } from '../../../../test-runner/process-execution'
import { withEnv } from '../../../../test-utils/rest-contract-helpers'

const artifacts: TestRunArtifacts = {
  rootDir: 'test/test-output',
  runId: 'worker-gateway',
  runDir: 'test/test-output/worker-gateway',
  runnerLogPath: 'test/test-output/worker-gateway/runner.log',
  commandLogPath: 'test/test-output/worker-gateway/commands.log',
  metricsLogPath: 'test/test-output/worker-gateway/metrics.jsonl',
  activeRunPath: 'test/test-output/worker-gateway/active.json',
  junitPath: 'test/test-output/worker-gateway/junit.xml',
  reportJsonPath: 'test/test-output/worker-gateway/report.json',
  e2eReportJsonPath: 'test/test-output/worker-gateway/e2e.json',
  calibrationReportJsonPath: 'test/test-output/worker-gateway/calibration.json',
  metadataDirPath: 'test/test-output/worker-gateway/metadata',
  startedAtMs: 0,
  startedAtIso: '2026-10-15T00:00:00.000Z'
}

const workerEnv = (overrides: Record<string, string> = {}) => buildTestWorkerEnv(
  ['test/test-cases/e2e/service/stt/diarization-off-by-default/cloudflare-whisper.test.ts'],
  artifacts,
  false,
  overrides
)

const observeWorker = async (overrides: Record<string, string> = {}) => {
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `console.log(JSON.stringify({
    gateway: process.env.CLOUDFLARE_AI_GATEWAY_ID ?? null,
    cloudflare: process.env.CLOUDFLARE_API_TOKEN !== undefined,
    unrelated: process.env.GEMINI_API_KEY !== undefined
  }))`], { env: workerEnv(overrides), stdout: 'pipe', stderr: 'pipe' })
  const [output, errors, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ])
  expect(exitCode).toBe(0)
  expect(errors).toBe('')
  return JSON.parse(output) as { gateway: string | null, cloudflare: boolean, unrelated: boolean }
}

test('live Cloudflare workers preserve optional billing route through spawned default, override and reset environments', async () => {
  await withEnv({
    AUTOSHOW_TEST_CREDENTIAL_MODE: 'live',
    AUTOSHOW_TEST_CREDENTIAL_KEYS: JSON.stringify(['CLOUDFLARE_API_TOKEN']),
    CLOUDFLARE_API_TOKEN: 'synthetic-cloudflare-token',
    CLOUDFLARE_AI_GATEWAY_ID: undefined,
    GEMINI_API_KEY: 'unrelated-synthetic-key'
  }, async () => {
    expect(await observeWorker()).toEqual({ gateway: null, cloudflare: true, unrelated: false })
    process.env['CLOUDFLARE_AI_GATEWAY_ID'] = 'prepaid-gateway'
    expect(await observeWorker()).toEqual({ gateway: 'prepaid-gateway', cloudflare: true, unrelated: false })
    expect(await observeWorker({ CLOUDFLARE_AI_GATEWAY_ID: 'explicit-gateway' })).toEqual({ gateway: 'explicit-gateway', cloudflare: true, unrelated: false })
    expect(await observeWorker({ CLOUDFLARE_AI_GATEWAY_ID: '' })).toEqual({ gateway: '', cloudflare: true, unrelated: false })
    delete process.env['CLOUDFLARE_AI_GATEWAY_ID']
    expect(await observeWorker()).toEqual({ gateway: null, cloudflare: true, unrelated: false })
  })
})

test('fixture and unrelated live workers exclude the gateway even with an explicit worker override', async () => {
  await withEnv({
    AUTOSHOW_TEST_CREDENTIAL_MODE: 'fixture',
    AUTOSHOW_TEST_CREDENTIAL_KEYS: JSON.stringify(['CLOUDFLARE_API_TOKEN']),
    CLOUDFLARE_API_TOKEN: 'ambient-synthetic-token',
    CLOUDFLARE_AI_GATEWAY_ID: 'private-routing-choice',
    OPENAI_API_KEY: 'declared-other-provider'
  }, async () => {
    expect(await observeWorker()).toEqual({ gateway: null, cloudflare: false, unrelated: false })
    expect(await observeWorker({ CLOUDFLARE_AI_GATEWAY_ID: 'unrelated-override' })).toEqual({ gateway: null, cloudflare: false, unrelated: false })
    process.env['AUTOSHOW_TEST_CREDENTIAL_MODE'] = 'live'
    process.env['AUTOSHOW_TEST_CREDENTIAL_KEYS'] = JSON.stringify(['OPENAI_API_KEY'])
    expect(await observeWorker()).toEqual({ gateway: null, cloudflare: false, unrelated: false })
    expect(await observeWorker({ CLOUDFLARE_AI_GATEWAY_ID: 'unrelated-override' })).toEqual({ gateway: null, cloudflare: false, unrelated: false })
  })
})

test('the optional Cloudflare gateway remains outside the registered credential list', async () => {
  await withEnv({
    AUTOSHOW_TEST_CREDENTIAL_MODE: 'live',
    AUTOSHOW_TEST_CREDENTIAL_KEYS: JSON.stringify(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_AI_GATEWAY_ID']),
    CLOUDFLARE_API_TOKEN: 'synthetic-cloudflare-token'
  }, async () => {
    expect(() => workerEnv()).toThrow('registered credential names')
  })
})
