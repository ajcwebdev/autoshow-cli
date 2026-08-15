import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  acquireAdaptiveProviderLease,
  classifyAdaptivePressure,
  readAdaptiveConcurrencySnapshot,
  recordAdaptivePressure,
  recordAdaptiveSuccess,
  resolveAdaptiveConcurrencyConfig
} from '../../../test-runner/adaptive-concurrency'
import {
  ADAPTIVE_PROVIDER_VALUE_FLAGS,
  ADAPTIVE_REMOTE_PROVIDERS,
  extractAdaptiveProviderGroups
} from '../../../test-runner/adaptive-provider-groups'
import { runCommand } from '../../../test-utils/test-helpers'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS,
  WRITE_STT_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import type { RunCommandAttemptRunner } from '~/types'

const tempDirs: string[] = []

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-adaptive-concurrency-'))
  tempDirs.push(dir)
  return dir
}

const testConfig = (stateDir: string) => resolveAdaptiveConcurrencyConfig(stateDir, {
  initialProviderLimit: 4,
  rateLimitCooldownMs: 25,
  transientCooldownMs: 10,
  successStreakToIncrease: 2,
  acquirePollMs: 5,
  lockWaitMs: 5,
  lockStaleMs: 1000,
})

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | number | undefined | null
): Promise<string> =>
  stream && typeof stream !== 'number' ? await new Response(stream).text() : ''

const collectChild = async (
  proc: ReturnType<typeof Bun.spawn>
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout),
    readStreamText(proc.stderr),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

const spawnLeaseChild = (
  label: string,
  holdMs: number,
  stateDir: string
): ReturnType<typeof Bun.spawn> => {
  const code = `
    import { acquireAdaptiveProviderLease, resolveAdaptiveConcurrencyConfig } from './test/test-runner/adaptive-concurrency.ts'
    const stateDir = process.env.STATE_DIR
    if (!stateDir) throw new Error('missing STATE_DIR')
    const config = resolveAdaptiveConcurrencyConfig(stateDir, {
      initialProviderLimit: 1,
      acquirePollMs: 5,
      lockWaitMs: 5,
      lockStaleMs: 1000
    })
    const lease = await acquireAdaptiveProviderLease(['tts/minimax'], config, {
      command: '${label}',
      leaseTtlMs: 2000
    })
    console.log('${label}:enter:' + Date.now())
    await Bun.sleep(${holdMs})
    await lease.release()
    console.log('${label}:exit:' + Date.now())
  `

  return Bun.spawn([process.execPath, '--eval', code], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      STATE_DIR: stateDir,
    }
  })
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('adaptive provider group parser', () => {
  test('remote provider mirrors exactly cover target registries minus named local engines', () => {
    const expectedLocalProviders = {
      stt: ['whisper', 'whisperfile'],
      ocr: ['tesseract'],
      url: ['defuddle'],
      llm: [],
      tts: [],
      image: [],
      video: [],
      music: [],
    } as const
    const providerRegistries = {
      stt: Object.keys(WRITE_STT_PROVIDER_TARGETS),
      ocr: Object.keys(WRITE_OCR_PROVIDER_TARGETS),
      url: URL_ARTICLE_BACKENDS,
      llm: Object.keys(WRITE_LLM_PROVIDER_TARGETS),
      tts: Object.keys(STANDALONE_TTS_PROVIDER_TARGETS),
      image: Object.keys(STANDALONE_IMAGE_PROVIDER_TARGETS),
      video: Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS),
      music: Object.keys(STANDALONE_MUSIC_PROVIDER_TARGETS),
    } as const

    for (const kind of Object.keys(providerRegistries) as Array<keyof typeof providerRegistries>) {
      const expected = providerRegistries[kind].filter((provider) =>
        !(expectedLocalProviders[kind] as readonly string[]).includes(provider)
      )
      const actual = ADAPTIVE_REMOTE_PROVIDERS[kind]
      expect({
        missing: expected.filter((provider) => !actual.includes(provider)),
        extra: actual.filter((provider) => !expected.includes(provider)),
      }).toEqual({ missing: [], extra: [] })
    }
  })

  test('value-consuming provider flags exactly cover remote target registries plus the parser core', () => {
    const coreValueFlags = [
      'provider',
      'url-provider',
      'stt',
      'ocr',
      'llm',
      'tts',
      'image',
      'video',
      'music',
      'all-providers',
      'whisper',
      'deepinfra',
    ]
    const targetRegistries = {
      stt: WRITE_STT_PROVIDER_TARGETS,
      ocr: WRITE_OCR_PROVIDER_TARGETS,
      llm: WRITE_LLM_PROVIDER_TARGETS,
      tts: STANDALONE_TTS_PROVIDER_TARGETS,
      image: STANDALONE_IMAGE_PROVIDER_TARGETS,
      video: STANDALONE_VIDEO_PROVIDER_TARGETS,
      music: STANDALONE_MUSIC_PROVIDER_TARGETS,
    } as const
    const expected = new Set(coreValueFlags)

    for (const kind of Object.keys(targetRegistries) as Array<keyof typeof targetRegistries>) {
      const remoteProviders = ADAPTIVE_REMOTE_PROVIDERS[kind]
      for (const [provider, target] of Object.entries(targetRegistries[kind])) {
        if (remoteProviders.includes(provider)) {
          expected.add(target)
        }
      }
    }

    expect({
      missing: [...expected].filter((flag) => !ADAPTIVE_PROVIDER_VALUE_FLAGS.includes(flag)),
      extra: ADAPTIVE_PROVIDER_VALUE_FLAGS.filter((flag) => !expected.has(flag)),
    }).toEqual({ missing: [], extra: [] })
  })

  test('extracts provider groups across processing command shapes', () => {
    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'extract',
      'input/examples/audio/1-audio.mp3',
      '--provider',
      'deepinfra=openai/whisper-large-v3'
    ])).toEqual(['transcribe/deepinfra'])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'extract',
      'input/examples/document/1-document.pdf',
      '--provider=mistral=mistral-ocr-2512',
      '--provider',
      'tesseract'
    ])).toEqual(['extract/mistral'])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'extract',
      'https://example.com/article',
      '--url-provider',
      'firecrawl'
    ])).toEqual(['url/firecrawl'])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'write',
      'https://ajc.pics/autoshow/examples/1-audio.mp3',
      '--stt',
      'deepgram=nova-3',
      '--ocr',
      'anthropic=claude-haiku-4-5',
      '--url-provider',
      'supadata',
      '--llm',
      'openai=gpt-5.5',
      '--tts',
      'minimax=speech-2.8-turbo',
      '--image',
      'openai=gpt-image-2',
      '--video',
      'runway=gen4.5',
      '--music',
      'gemini=lyria-3-clip-preview'
    ])).toEqual([
      'extract/anthropic',
      'image/openai',
      'music/gemini',
      'transcribe/deepgram',
      'tts/minimax',
      'url/supadata',
      'video/runway',
      'write/openai',
    ])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'tts',
      'input/examples/tts/1-tts.md',
      '--provider',
      'openai=gpt-4o-mini-tts-2025-12-15'
    ])).toEqual(['tts/openai'])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'image',
      'a prompt',
      '--provider',
      'gemini=gemini-3.1-flash-lite-image'
    ])).toEqual(['image/gemini'])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'video',
      'a prompt',
      '--provider',
      'minimax=MiniMax-Hailuo-2.3'
    ])).toEqual(['video/minimax'])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'music',
      'a prompt',
      '--provider',
      'elevenlabs=music_v1'
    ])).toEqual(['music/elevenlabs'])

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'image',
      'a prompt',
      '--all-providers'
    ])).toEqual(Object.keys(STANDALONE_IMAGE_PROVIDER_TARGETS).map((provider): `image/${string}` => `image/${provider}`).sort())

    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'video',
      'a prompt',
      '--all-providers'
    ])).toEqual(Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS).map((provider): `video/${string}` => `video/${provider}`).sort())
  })

  test('local-only providers do not create adaptive groups', () => {
    expect(extractAdaptiveProviderGroups([
      'src/cli/create-cli.ts',
      'extract',
      'input/examples/audio/1-audio.mp3',
      '--stt',
      'whisper=tiny'
    ])).toEqual([])
  })
})

describe('adaptive scheduler contracts', () => {
  test('leases coordinate active counts and release state', async () => {
    const stateDir = await makeTempDir()
    const config = testConfig(stateDir)
    const first = await acquireAdaptiveProviderLease(['image/openai'], config, {
      command: 'first',
      leaseTtlMs: 1000,
    })
    const second = await acquireAdaptiveProviderLease(['image/openai'], config, {
      command: 'second',
      leaseTtlMs: 1000,
    })

    let snapshot = await readAdaptiveConcurrencySnapshot(config)
    expect(snapshot.groups['image/openai']).toMatchObject({
      active: 2,
      limit: 4,
    })

    await first.release()
    await second.release()

    snapshot = await readAdaptiveConcurrencySnapshot(config)
    expect(snapshot.groups['image/openai']).toMatchObject({
      active: 0,
      limit: 4,
    })
  })

  test('default provider groups start at concurrency ten', async () => {
    const stateDir = await makeTempDir()
    const config = resolveAdaptiveConcurrencyConfig(stateDir, {
      lockWaitMs: 5,
      lockStaleMs: 1000,
    })

    const deepinfra = await acquireAdaptiveProviderLease(['transcribe/deepinfra'], config, {
      command: 'deepinfra-stt',
      leaseTtlMs: 1000,
    })
    const openaiImage = await acquireAdaptiveProviderLease(['image/openai'], config, {
      command: 'openai-image',
      leaseTtlMs: 1000,
    })

    const snapshot = await readAdaptiveConcurrencySnapshot(config)
    expect(snapshot.groups['transcribe/deepinfra']).toMatchObject({
      active: 1,
      limit: 10,
      maxLimit: 10,
    })
    expect(snapshot.groups['image/openai']).toMatchObject({
      active: 1,
      limit: 10,
      maxLimit: 10,
    })

    await deepinfra.release()
    await openaiImage.release()
  })

  test('provider group limits can be overridden per group', async () => {
    const stateDir = await makeTempDir()
    const config = resolveAdaptiveConcurrencyConfig(stateDir, {
      initialProviderLimit: 8,
      groupInitialLimits: { 'transcribe/deepinfra': 2 },
      lockWaitMs: 5,
      lockStaleMs: 1000,
    })

    const first = await acquireAdaptiveProviderLease(['transcribe/deepinfra'], config, {
      command: 'deepinfra-stt-1',
      leaseTtlMs: 1000,
    })
    const second = await acquireAdaptiveProviderLease(['transcribe/deepinfra'], config, {
      command: 'deepinfra-stt-2',
      leaseTtlMs: 1000,
    })

    const snapshot = await readAdaptiveConcurrencySnapshot(config)
    expect(snapshot.groups['transcribe/deepinfra']).toMatchObject({
      active: 2,
      limit: 2,
      maxLimit: 2,
    })

    await first.release()
    await second.release()
  })

  test('cross-process leases serialize when the group limit is one', async () => {
    const stateDir = await makeTempDir()
    const first = spawnLeaseChild('first', 100, stateDir)
    const config = resolveAdaptiveConcurrencyConfig(stateDir, {
      initialProviderLimit: 1,
      lockWaitMs: 5,
      lockStaleMs: 1000,
    })

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const snapshot = await readAdaptiveConcurrencySnapshot(config)
      if ((snapshot.groups['tts/minimax']?.active ?? 0) > 0) {
        break
      }
      await Bun.sleep(5)
    }

    const second = spawnLeaseChild('second', 0, stateDir)
    const [firstResult, secondResult] = await Promise.all([
      collectChild(first),
      collectChild(second),
    ])

    expect(firstResult.exitCode).toBe(0)
    expect(secondResult.exitCode).toBe(0)
    expect(firstResult.stderr).toBe('')
    expect(secondResult.stderr).toBe('')

    const lines = `${firstResult.stdout}\n${secondResult.stdout}`.trim().split('\n')
    const firstExit = Number(lines.find((line) => line.startsWith('first:exit:'))?.split(':')[2] ?? '0')
    const secondEnter = Number(lines.find((line) => line.startsWith('second:enter:'))?.split(':')[2] ?? '0')
    expect(firstExit).toBeGreaterThan(0)
    expect(secondEnter).toBeGreaterThanOrEqual(firstExit)
  })

  test('pressure signals reduce limits and successful commands restore gradually', async () => {
    const stateDir = await makeTempDir()
    const config = testConfig(stateDir)

    expect(classifyAdaptivePressure('retryable status 429', 1, false)).toBe('rate-limit')
    expect(classifyAdaptivePressure('provider request timed out', 1, false)).toBe('timeout')
    expect(classifyAdaptivePressure('retryable status 503 service unavailable', 1, false)).toBe('transient')
    expect(classifyAdaptivePressure('validation failed', 1, false)).toBeNull()

    // Deterministic failures must not be treated as transient just because their
    // output contains a 5xx-looking number (e.g. "535 characters" in the estimate).
    expect(classifyAdaptivePressure('Cartesia TTS failed (402): quota_exceeded; 535 characters', 1, false)).toBeNull()
    expect(classifyAdaptivePressure('Together transcription failed (503)', 1, false)).toBe('transient')

    const beforeMs = Date.now()
    await recordAdaptivePressure(['image/openai'], 'rate-limit', config)
    await recordAdaptivePressure(['video/gemini'], 'transient', config)
    await recordAdaptivePressure(['tts/minimax'], 'timeout', config)

    let snapshot = await readAdaptiveConcurrencySnapshot(config)
    expect(snapshot.groups['image/openai']?.limit).toBe(1)
    expect(snapshot.groups['image/openai']?.cooldownUntilMs ?? 0).toBeGreaterThan(beforeMs)
    expect(snapshot.groups['video/gemini']?.limit).toBe(2)
    expect(snapshot.groups['tts/minimax']?.limit).toBe(1)

    await recordAdaptiveSuccess(['image/openai'], config)
    snapshot = await readAdaptiveConcurrencySnapshot(config)
    expect(snapshot.groups['image/openai']?.limit).toBe(1)

    await recordAdaptiveSuccess(['image/openai'], config)
    snapshot = await readAdaptiveConcurrencySnapshot(config)
    expect(snapshot.groups['image/openai']?.limit).toBe(2)
    expect(snapshot.groups['image/openai']?.failureStreak).toBe(0)
  })
})

describe('runCommand adaptive retry contracts', () => {
  test('forced adaptive mode retries synthetic rate-limit pressure and succeeds', async () => {
    const stateDir = await makeTempDir()
    const attempts: number[] = []
    const attemptRunner: RunCommandAttemptRunner = async ({ attempt }) => {
      attempts.push(attempt)
      if (attempt === 1) {
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'provider failed after 3/3 attempts: retryable status 429',
        }
      }
      return {
        exitCode: 0,
        stdout: 'ok\n',
        stderr: '',
      }
    }

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      'input/examples/tts/1-tts.md',
      '--provider',
      'minimax=speech-2.8-turbo'
    ], {
      env: {
        AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY: 'force',
      },
      adaptiveStateDir: stateDir,
      adaptiveConfig: {
        maxAttempts: 3,
        rateLimitCooldownMs: 1,
        acquirePollMs: 1,
      },
      attemptRunner,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('ok')
    expect(attempts).toEqual([1, 2])
  })

  test('persistent synthetic rate-limit failure includes adaptive diagnostics', async () => {
    const stateDir = await makeTempDir()
    const attempts: number[] = []
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      'input/examples/tts/1-tts.md',
      '--provider',
      'minimax=speech-2.8-turbo'
    ], {
      env: {
        AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY: 'force',
      },
      adaptiveStateDir: stateDir,
      adaptiveConfig: {
        maxAttempts: 2,
        rateLimitCooldownMs: 1,
        acquirePollMs: 1,
      },
      attemptRunner: async ({ attempt }) => {
        attempts.push(attempt)
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'retryable status 429',
        }
      },
    })

    expect(result.exitCode).toBe(1)
    expect(attempts).toEqual([1, 2])
    expect(result.stderr).toContain('Adaptive concurrency retry summary')
    expect(result.stderr).toContain('groups=tts/minimax')
  })

  test('runner e2e selection flag enables adaptive scheduling for helper callers', async () => {
    const stateDir = await makeTempDir()
    const attempts: number[] = []
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'extract',
      'https://ajc.pics/autoshow/examples/1-audio.mp3',
      '--provider',
      'deepinfra=openai/whisper-large-v3'
    ], {
      env: {
        AUTOSHOW_TEST_ADAPTIVE_CONCURRENCY: '1',
        AUTOSHOW_TEST_ADAPTIVE_E2E_SELECTION: '1',
      },
      adaptiveStateDir: stateDir,
      adaptiveConfig: {
        maxAttempts: 3,
        rateLimitCooldownMs: 1,
        acquirePollMs: 1,
      },
      attemptRunner: async ({ attempt }) => {
        attempts.push(attempt)
        if (attempt === 1) {
          return {
            exitCode: 1,
            stdout: '',
            stderr: 'deepinfra-stt-create failed after 2/2 attempts: retryable status 429',
          }
        }
        return {
          exitCode: 0,
          stdout: 'ok\n',
          stderr: '',
        }
      },
    })

    const config = resolveAdaptiveConcurrencyConfig(stateDir, {
      initialProviderLimit: 8,
      groupInitialLimits: { 'transcribe/deepinfra': 1 },
    })
    const snapshot = await readAdaptiveConcurrencySnapshot(config)

    expect(result.exitCode).toBe(0)
    expect(attempts).toEqual([1, 2])
    expect(snapshot.groups['transcribe/deepinfra']?.limit).toBe(1)
  })

  test('non-e2e callers are not scheduled by default', async () => {
    const stateDir = await makeTempDir()
    const attempts: number[] = []
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'tts',
      'input/examples/tts/1-tts.md',
      '--provider',
      'minimax=speech-2.8-turbo'
    ], {
      adaptiveStateDir: stateDir,
      adaptiveConfig: {
        maxAttempts: 3,
      },
      attemptRunner: async ({ attempt }) => {
        attempts.push(attempt)
        return {
          exitCode: 1,
          stdout: '',
          stderr: 'retryable status 429',
        }
      },
    })

    expect(result.exitCode).toBe(1)
    expect(attempts).toEqual([1])
    expect(result.stderr).not.toContain('Adaptive concurrency retry summary')
  })
})
