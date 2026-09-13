import { expect, test } from 'bun:test'
import { getMissingConfiguredHostedProviderCredentials } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { requireHostedUrlProviderApiKey } from '~/cli/commands/text/url/url-utils'
import { runSyncCommand } from '~/utils/sync-subprocess'
import { boundedReadinessFetch } from '~/utils/readiness-request'
import { dockerClientEnvironment } from '../../../../src/tools/docker-process'
import { renderEnvironmentReference } from '../../../../src/tools/environment-reference'
import { buildTestWorkerEnv } from '../../../test-runner/process-execution'
import { shouldRelaunchSetupWithNoOrphans } from '~/cli/create-cli'
import { readConfiguredEnvVarSync } from '../../../test-utils/test-helpers'
import { findUnevaluatedBudgetKeys, shouldSkipBudgetKeys } from '../../../test-utils/budget'
import { withEnv } from '../../../test-utils/rest-contract-helpers'

for (const [provider, envKey] of Object.entries({ firecrawl: 'FIRECRAWL_API_KEY', 'glm-reader': 'GLM_API_KEY', spider: 'SPIDER_API_KEY', supadata: 'SUPADATA_API_KEY', zyte: 'ZYTE_API_KEY' })) {
  test(`doctor selects only ${provider} URL credentials`, () => {
    const config = { defaults: { extract: { url: { provider } } } } as Parameters<typeof getMissingConfiguredHostedProviderCredentials>[1]
    expect(getMissingConfiguredHostedProviderCredentials({}, config).map(spec => spec.envVar)).toEqual([envKey])
    expect(getMissingConfiguredHostedProviderCredentials({ [envKey]: '  valid  ' }, config)).toEqual([])
  })
}

test('injected destinations never receive ambient keys; explicit keys are normalized', async () => {
  await withEnv({ FIRECRAWL_API_KEY: 'opaque-synthetic-value' }, async () => {
    expect(requireHostedUrlProviderApiKey('firecrawl', 'test', false)).toBeUndefined()
    expect(requireHostedUrlProviderApiKey('firecrawl', 'test', true)).toBe('opaque-synthetic-value')
    expect(requireHostedUrlProviderApiKey('firecrawl', 'test', false, ' injected ')).toBe('injected')
  })
})

test('sync children and fixture workers exclude unrelated secrets and arbitrary test-prefixed names', async () => {
  await withEnv({ OPENAI_API_KEY: 'opaque-synthetic', AUTOSHOW_TEST_UNRELATED_SECRET: 'opaque-synthetic', AUTOSHOW_TEST_CREDENTIAL_MODE: 'fixture', AUTOSHOW_TEST_OUTPUT_DIR: '/tmp/explicit-test-output' }, async () => {
    const result = runSyncCommand(process.execPath, ['--no-env-file', '-e', 'console.log(JSON.stringify(process.env))'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).not.toContain('opaque-synthetic')
    const worker = buildTestWorkerEnv([], { runDir: '/tmp/test', commandLogPath: '/tmp/commands', metricsLogPath: '/tmp/metrics' } as Parameters<typeof buildTestWorkerEnv>[1], true, {})
    expect(worker).not.toHaveProperty('OPENAI_API_KEY')
    expect(worker).not.toHaveProperty('AUTOSHOW_TEST_UNRELATED_SECRET')
    expect(worker['PATH']).toBe(process.env['PATH'])
    expect(worker['AUTOSHOW_TEST_CREDENTIAL_MODE']).toBe('fixture')
    expect(worker['AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY']).toBe('1')
    expect(worker['AUTOSHOW_TEST_OUTPUT_DIR']).toBe('/tmp/explicit-test-output')
  })
  expect(shouldRelaunchSetupWithNoOrphans(['setup', '--doctor'], {}, false)).toBe(false)
})

test('missing and malformed budget evidence fail closed and readers normalize exports', async () => {
  await withEnv({ AUTOSHOW_TEST_BUDGET_EVALUATED_KEYS: undefined, AUTOSHOW_TEST_BUDGET_SKIP_KEYS: '{', OPENAI_API_KEY: 'your_openai_api_key_here' }, async () => {
    expect(findUnevaluatedBudgetKeys('paid')).toEqual(['paid'])
    expect(shouldSkipBudgetKeys('paid')).toBe(true)
    expect(readConfiguredEnvVarSync('OPENAI_API_KEY')).toBeUndefined()
  })
})

test('readiness bounds ignored abort signals and distinguishes rejected credentials', async () => {
  const hanging = (() => new Promise(() => {})) as unknown as typeof fetch
  const start = Date.now()
  await expect(boundedReadinessFetch(hanging, { timeoutMs: 5 })('https://example.invalid')).rejects.toThrow('timed out')
  expect(Date.now() - start).toBeLessThan(500)
  const denied = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch
  await expect(boundedReadinessFetch(denied)('https://example.invalid')).rejects.toThrow('401')
})

test('generated capabilities stay synchronized and Docker shares its connection contract', async () => {
  const report = Bun.file('docs/reports/high-priority-metareport-2026-09-11.md')
  // Reports are ignored and may be absent in a fresh checkout.
  if (await report.exists()) expect(await report.text()).toContain(renderEnvironmentReference())
  const source = { PATH: '/bin', HOME: '/home/test', DOCKER_HOST: 'tcp://fixture:2376', DOCKER_CONTEXT: 'fixture', DOCKER_TLS_VERIFY: '1', DOCKER_CERT_PATH: '/certs', DOCKER_CONFIG: '/config', XDG_RUNTIME_DIR: '/run/test', OPENAI_API_KEY: 'secret' }
  const { OPENAI_API_KEY: _secret, ...expected } = source
  expect(dockerClientEnvironment(source)).toEqual(expected)
  const workflow = await Bun.file('.github/workflows/docker-publish.yml').text()
  expect(workflow).not.toContain('https://x-access-token:')
  expect(workflow.match(/credential.helper= /g)).toHaveLength(2)
  expect(workflow).toContain('--password-stdin')
})

test('readiness bounds stalled response bodies and refuses requests after the operation deadline', async () => {
  const stalled = (async () => new Response(new ReadableStream({ start() {} }))) as unknown as typeof fetch
  await expect(boundedReadinessFetch(stalled, { timeoutMs: 5 })('https://example.invalid')).rejects.toThrow('timed out')
  let calls = 0
  const request = (async () => { calls++; return Response.json({}) }) as unknown as typeof fetch
  await expect(boundedReadinessFetch(request, { deadline: Date.now() - 1 })('https://example.invalid')).rejects.toThrow('deadline')
  expect(calls).toBe(0)
})

test('setup and diagnostic children preserve tool settings without secrets', async () => {
  const { buildSetupChildEnv } = await import('~/cli/create-cli')
  const { buildNetworkProbeChildEnv } = await import('~/cli/commands/setup-and-utilities/setup/network-check')
  await withEnv({ OPENAI_API_KEY: 'opaque-child-secret', AUTOSHOW_TEST_UNRELATED_SECRET: 'opaque-child-secret', AUTOSHOW_DISABLE_HTTP_KEEPALIVE: '1' }, async () => {
    for (const env of [buildSetupChildEnv(), buildNetworkProbeChildEnv(1234)]) {
      const child = Bun.spawnSync([process.execPath, '--no-env-file', '-e', 'console.log(JSON.stringify(process.env))'], { env, stdout: 'pipe', stderr: 'pipe' })
      expect(child.exitCode).toBe(0)
      expect(child.stdout.toString()).not.toContain('opaque-child-secret')
      expect(JSON.parse(child.stdout.toString())['AUTOSHOW_DISABLE_HTTP_KEEPALIVE']).toBe('1')
    }
    expect(buildNetworkProbeChildEnv(1234)['AUTOSHOW_NETWORK_CHECK_CHILD_TIMEOUT_MS']).toBe('1234')
  })
})

test('caption media probes exclude unrelated secrets at the actual spawn boundary', async () => {
  const { withTempDir } = await import('../../../test-utils/temp-dirs')
  const { chmod } = await import('node:fs/promises')
  const { configureBinDir, getConfiguredBinDir } = await import('~/utils/runtime-paths')
  const { probeCaptionMedia } = await import('~/cli/commands/stt/workflows/captions/embed-caption-tracks')
  await withTempDir('autoshow-caption-env-', async root => {
    const previous = getConfiguredBinDir()
    await Bun.write(`${root}/ffprobe`, `#!/bin/sh\n/usr/bin/env > '${root}/observed-env'\nprintf '{"streams":[]}'\n`)
    await chmod(`${root}/ffprobe`, 0o755)
    configureBinDir(root)
    try {
      await withEnv({ OPENAI_API_KEY: 'opaque-media-secret' }, async () => {
        expect(await probeCaptionMedia('/synthetic-input')).toEqual({ streams: [] })
        expect(await Bun.file(`${root}/observed-env`).text()).not.toContain('opaque-media-secret')
      })
    } finally { configureBinDir(previous ?? '') }
  })
})

test('fake Docker observes the same host, context and TLS choices through the package launcher and acceptance runner', async () => {
  const { withTempDir } = await import('../../../test-utils/temp-dirs')
  const { chmod } = await import('node:fs/promises')
  const { createDockerProcessRunner } = await import('../../../../src/tools/docker-process')
  await withTempDir('autoshow-docker-env-', async root => {
    const observed = `${root}/observed-env`
    await Bun.write(`${root}/docker`, `#!/bin/sh\n/usr/bin/env > '${observed}'\nexit 71\n`)
    await chmod(`${root}/docker`, 0o755)
    const env = { PATH: `${root}:${process.env['PATH']}`, HOME: root, DOCKER_HOST: 'tcp://fixture:2376', DOCKER_CONTEXT: 'fixture-context', DOCKER_CONFIG: '/fixture/config', DOCKER_TLS_VERIFY: '1', DOCKER_CERT_PATH: '/fixture/certs', XDG_RUNTIME_DIR: '/fixture/runtime', OPENAI_API_KEY: 'opaque-docker-secret' }
    await Bun.write(`${root}/synthetic.env`, 'SYNTHETIC_KEY=value\n')
    const child = Bun.spawn([process.execPath, '--no-env-file', 'src/tools/docker-launcher.ts', 'compare', '--env-file', `${root}/synthetic.env`, '--output', `${root}/comparison.json`], { env, stdout: 'ignore', stderr: 'ignore' })
    expect(await child.exited).not.toBe(0)
    const launcherEnv = await Bun.file(observed).text()
    const runner = createDockerProcessRunner(`${root}/docker`, env)
    expect((await runner(['version'], 1000, `${root}/logs/docker`)).exitCode).toBe(71)
    const runnerEnv = await Bun.file(observed).text()
    for (const [key, value] of Object.entries(dockerClientEnvironment(env))) {
      expect(launcherEnv.split('\n')).toContain(`${key}=${value}`)
      expect(runnerEnv.split('\n')).toContain(`${key}=${value}`)
    }
    expect(launcherEnv + runnerEnv).not.toContain('opaque-docker-secret')
    const packageJson = await Bun.file('package.json').json()
    for (const name of ['baseline:docker', 'compare:env', 't:docker']) expect(packageJson.scripts[name]).toContain('src/tools/docker-launcher.ts')
    for (const path of ['src/tools/bun-env-compat.ts', 'src/tools/docker-bun-baseline.ts']) expect(await Bun.file(path).text()).toContain('env: dockerClientEnvironment(process.env)')
  })
})

test('live workers require an explicit credential list and live callbacks scope their child credentials', async () => {
  const { liveCredentialContext } = await import('../../../test-utils/live-credential-context')
  const { buildChildEnv } = await import('../../../test-utils/test-command-options')
  const artifacts = { runDir: '/tmp/test', commandLogPath: '/tmp/commands', metricsLogPath: '/tmp/metrics' } as Parameters<typeof buildTestWorkerEnv>[1]
  await withEnv({ AUTOSHOW_TEST_CREDENTIAL_MODE: 'live', AUTOSHOW_TEST_CREDENTIAL_KEYS: '["OPENAI_API_KEY"]', OPENAI_API_KEY: 'selected', GEMINI_API_KEY: 'unrelated' }, () => {
    const env = buildTestWorkerEnv([], artifacts, true, {})
    expect(env['OPENAI_API_KEY']).toBe('selected')
    expect(env).not.toHaveProperty('GEMINI_API_KEY')
    expect(buildChildEnv(undefined)).not.toHaveProperty('OPENAI_API_KEY')
    liveCredentialContext.run({ OPENAI_API_KEY: 'selected' }, () => {
      expect(buildChildEnv(undefined)['OPENAI_API_KEY']).toBe('selected')
      expect(buildChildEnv(undefined)).not.toHaveProperty('GEMINI_API_KEY')
    })
  })
})

test('voice and soundscape selections reject absent credentials before provider work', async () => {
  const { advancedProvider } = await import('~/cli/commands/audio/voice/voice-command-support')
  const { createStabilitySoundEffectAdapter } = await import('~/cli/commands/audio/tts/soundscape/stability-stable-audio-adapter')
  const { createElevenLabsSoundEffectAdapter } = await import('~/cli/commands/audio/tts/soundscape/elevenlabs-sfx-adapter')
  const { createReplicateAudioGenAdapter } = await import('~/cli/commands/audio/tts/soundscape/replicate-audiogen-adapter')
  for (const [provider, envKey] of [['elevenlabs', 'ELEVENLABS_API_KEY'], ['grok', 'XAI_API_KEY'], ['mistral', 'MISTRAL_API_KEY'], ['hume', 'HUME_API_KEY'], ['cartesia', 'CARTESIA_API_KEY'], ['inworld', 'INWORLD_API_KEY'], ['speechify', 'SPEECHIFY_API_KEY']] as const) {
    await withEnv({ [envKey]: '  ' }, () => expect(() => advancedProvider(provider)).toThrow(envKey))
  }
  expect(() => createStabilitySoundEffectAdapter({ apiKey: 'your_stability_api_key_here' })).toThrow('STABILITY_API_KEY')
  expect(() => createElevenLabsSoundEffectAdapter({ apiKey: 'your_elevenlabs_api_key_here' })).toThrow('ELEVENLABS_API_KEY')
  expect(() => createReplicateAudioGenAdapter({ apiToken: 'your_replicate_api_token_here' })).toThrow('REPLICATE_API_TOKEN')
})

test('Stability and ElevenLabs send normalized credentials through their default transports', async () => {
  const { createStabilitySoundEffectAdapter, STABILITY_STABLE_AUDIO_SELECTOR } = await import('~/cli/commands/audio/tts/soundscape/stability-stable-audio-adapter')
  const { createElevenLabsSoundEffectAdapter, resolveSoundEffectTarget } = await import('~/cli/commands/audio/tts/soundscape/elevenlabs-sfx-adapter')
  const original = globalThis.fetch
  const headers: Headers[] = []
  globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    headers.push(new Headers(init?.headers))
    if (String(_input).includes('api.stability.ai') && init?.method === 'POST') return new Response(JSON.stringify({ id: 'synthetic-generation' }), { status: 202 })
    return new Response(new Uint8Array([1]), { headers: { 'content-type': 'audio/wav' } })
  }) as unknown as typeof fetch
  try {
    for (const [selector, adapter] of [
      [STABILITY_STABLE_AUDIO_SELECTOR, createStabilitySoundEffectAdapter({ apiKey: '  normalized-stability  ', wait: async () => {} })],
      ['elevenlabs=eleven_text_to_sound_v2', createElevenLabsSoundEffectAdapter({ apiKey: '  normalized-elevenlabs  ' })]
    ] as const) {
      const target = resolveSoundEffectTarget(selector)
      await adapter.generate({ taskId: 'synthetic-task', cueId: 'synthetic-cue', kind: 'action-sfx', prompt: 'glass shatter', durationSeconds: 4, requestIdentity: 'synthetic-request', outputFormat: target.outputFormat, promptInfluence: target.promptInfluence, generationIdentity: 'synthetic-generation', required: true, loop: false }, target, 1, new AbortController().signal)
    }
    expect(headers[0]?.get('Authorization')).toBe('Bearer normalized-stability')
    expect(headers[1]?.get('Authorization')).toBe('Bearer normalized-stability')
    expect(headers[2]?.get('xi-api-key')).toBe('normalized-elevenlabs')
  } finally { globalThis.fetch = original }
})

test('all hosted URL transports bind ambient credentials to their default destination', async () => {
  const { runFirecrawlUrl } = await import('~/cli/commands/text/url/url-services/firecrawl/run-firecrawl-url')
  const { runGlmReaderUrl } = await import('~/cli/commands/text/url/url-services/glm-reader/run-glm-reader-url')
  const { runSpiderUrl } = await import('~/cli/commands/text/url/url-services/spider/run-spider-url')
  const { runSupadataUrl } = await import('~/cli/commands/text/url/url-services/url-supadata/run-supadata-url')
  const { runZyteUrl } = await import('~/cli/commands/text/url/url-services/zyte/run-zyte-url')
  const original = globalThis.fetch
  let headers = new Headers()
  globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    headers = new Headers(init?.headers)
    expect(init?.redirect).toBe('error')
    throw new Error('synthetic transport stop')
  }) as unknown as typeof fetch
  try {
    for (const [envKey, run] of [['FIRECRAWL_API_KEY', runFirecrawlUrl], ['GLM_API_KEY', runGlmReaderUrl], ['SPIDER_API_KEY', runSpiderUrl], ['SUPADATA_API_KEY', runSupadataUrl], ['ZYTE_API_KEY', runZyteUrl]] as const) {
      await withEnv({ [envKey]: 'opaque-url-secret' }, async () => {
        await expect(run('https://article.invalid', undefined, undefined, 'https://injected.invalid')).rejects.toThrow('synthetic transport stop')
        expect(headers.has('Authorization') || headers.has('x-api-key')).toBe(false)
        await expect(run('https://article.invalid', undefined)).rejects.toThrow('synthetic transport stop')
        expect(headers.has('Authorization') || headers.has('x-api-key')).toBe(true)
        await expect(run('https://article.invalid', undefined, { apiKey: 'explicit-injection' }, 'https://injected.invalid')).rejects.toThrow('synthetic transport stop')
        expect(headers.has('Authorization') || headers.has('x-api-key')).toBe(true)
      })
    }
  } finally { globalThis.fetch = original }
})

test('environment regeneration preserves the consolidated summary and rejects damaged boundaries', async () => {
  const { updateEnvironmentReferenceSection, ENVIRONMENT_REFERENCE_START: start, ENVIRONMENT_REFERENCE_END: end } = await import('../../../../src/tools/environment-reference')
  const summary = `# Summary\n\nEvidence before.\n${start}\nOld content\n${end}\nEvidence after.\n`
  const updated = updateEnvironmentReferenceSection(summary)
  expect(updated.startsWith('# Summary\n\nEvidence before.\n')).toBe(true)
  expect(updated.endsWith('\nEvidence after.\n')).toBe(true)
  expect(updateEnvironmentReferenceSection(updated)).toBe(updated)
  expect(() => updateEnvironmentReferenceSection(`${start}\nMissing end`)).toThrow('markers')
})
