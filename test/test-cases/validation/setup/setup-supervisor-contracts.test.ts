import { expect, test } from 'bun:test'
import { buildSetupChildEnv, shouldRelaunchSetupWithNoOrphans } from '~/cli/create-cli'
import { buildHostedProviderConfigurationRows, buildSetupProviderPresence, SETUP_PROVIDER_PRESENCE_ENV, setupProviderSummaryEnvironment, summarizeHostedProviderRows } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { withEnv } from '../../../test-utils/rest-contract-helpers'

test('setup previews and diagnostics stay in the read-only invocation', () => {
  for (const flags of [['--dry-run'], ['--dry-run=true'], ['--doctor'], ['--doctor', '--strict'], ['--show']]) {
    expect(shouldRelaunchSetupWithNoOrphans(['setup', ...flags], {}, false)).toBe(false)
  }
  expect(shouldRelaunchSetupWithNoOrphans(['setup'], {}, false)).toBe(true)
  expect(shouldRelaunchSetupWithNoOrphans(['setup', '--step', 'rendering'], {}, false)).toBe(true)
  for (const flags of [['--dry-run=false'], ['--doctor=false'], ['--dry-run', '--dry-run=false']]) {
    expect(shouldRelaunchSetupWithNoOrphans(['setup', ...flags], {}, false)).toBe(true)
  }
  expect(shouldRelaunchSetupWithNoOrphans(['setup', '--dry-run=false', '--dry-run'], {}, false)).toBe(false)
})

test('setup supervisor preserves normalized key presence without forwarding credentials to setup or tools', async () => {
  await withEnv({ OPENAI_API_KEY: 'opaque-supervisor-secret', GEMINI_API_KEY: '  ', ELEVENLABS_API_KEY: 'your_elevenlabs_api_key_here' }, async () => {
    const childEnv = buildSetupChildEnv()
    expect(childEnv).not.toHaveProperty('OPENAI_API_KEY')
    expect(JSON.stringify(childEnv)).not.toContain('opaque-supervisor-secret')
    const configured = JSON.parse(childEnv[SETUP_PROVIDER_PRESENCE_ENV]!)
    expect(configured).toContain('OPENAI_API_KEY')
    expect(configured).not.toContain('GEMINI_API_KEY')
    expect(configured).not.toContain('ELEVENLABS_API_KEY')

    const modulePath = new URL('../../../../src/cli/commands/setup-and-utilities/setup/hosted-provider-config.ts', import.meta.url).pathname
    const child = Bun.spawn([process.execPath, '--no-env-file', '-e', `
      import { buildHostedProviderConfigurationRows, setupProviderSummaryEnvironment } from ${JSON.stringify(modulePath)};
      import { childEnv } from ${JSON.stringify(new URL('../../../../src/utils/child-env.ts', import.meta.url).pathname)};
      console.log(JSON.stringify({ rows: buildHostedProviderConfigurationRows(setupProviderSummaryEnvironment(process.env)), tools: childEnv() }));
    `], { env: childEnv, stdout: 'pipe', stderr: 'pipe' })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exitCode, stderr).toBe(0)
    const actual = JSON.parse(stdout)
    expect(actual.rows.find((row: { envKey: string }) => row.envKey === 'OPENAI_API_KEY').status).toBe('configured')
    expect(actual.tools).not.toHaveProperty(SETUP_PROVIDER_PRESENCE_ENV)
    expect(stdout + stderr).not.toContain('opaque-supervisor-secret')
  })
})

test('presence snapshot is diagnostic-only, allowlisted, and cannot create unknown provider entries', () => {
  const source = { OPENAI_API_KEY: '  opaque  ', GEMINI_API_KEY: 'your_gemini_api_key_here' }
  const snapshot = buildSetupProviderPresence(source)
  expect(JSON.parse(snapshot)).toEqual(['OPENAI_API_KEY'])
  expect(setupProviderSummaryEnvironment({ ...source, [SETUP_PROVIDER_PRESENCE_ENV]: '[]' })).toEqual({ ...source, [SETUP_PROVIDER_PRESENCE_ENV]: '[]' })
  const env = setupProviderSummaryEnvironment({ AUTOSHOW_SETUP_NO_ORPHANS_CHILD: '1', [SETUP_PROVIDER_PRESENCE_ENV]: snapshot })
  expect(summarizeHostedProviderRows(buildHostedProviderConfigurationRows(env)).configured).toBe(1)
  for (const invalid of ['{', '{}', '["UNREGISTERED_API_KEY"]', '[false]']) {
    expect(() => setupProviderSummaryEnvironment({ AUTOSHOW_SETUP_NO_ORPHANS_CHILD: '1', [SETUP_PROVIDER_PRESENCE_ENV]: invalid })).toThrow('Invalid setup provider-presence snapshot')
  }
})
