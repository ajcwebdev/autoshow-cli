import { describe, expect, test } from 'bun:test'
import {
  collectDoctorNextSteps,
  collectDoctorReport,
  runDoctor
} from '~/cli/commands/setup-and-utilities/setup/run-doctor'
import {
  findHostedProviderEnvKeyForConfigPath,
  getHostedProviderEnvKeysForConfigPrefix,
  HOSTED_PROVIDER_ENV_CHECKS
} from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_STT_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import type { DoctorCheck, DoctorProbes, RunResult } from '~/types'
import { AppUsageError } from '~/utils/error-handler'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'
import { requireDefined } from '../../../test-utils/value-assertions'

const okRun = (stdout = ''): RunResult => ({ stdout, stderr: '', exitCode: 0 })

const makeDoctorProbes = (overrides: Partial<DoctorProbes> = {}): Partial<DoctorProbes> => ({
  bunVersion: SUPPORTED_BUN_VERSION,
  platform: 'darwin',
  env: {},
  which: (command: string) => `/usr/bin/${command}`,
  pathExists: async () => true,
  listDirectory: async () => ['ggml-tiny.bin', 'ggml-large-v3-turbo.bin'],
  directoryHasFiles: async () => true,
  run: async (command: string, args: string[]) => {
    if (command.includes('tesseract') && args.includes('--list-langs')) {
      return okRun('List of available languages in "/tmp":\neng\n')
    }
    if (command.includes('ffmpeg') && args.includes('-filters')) {
      return okRun(' ... ass              V->V       Render ASS subtitles\n')
    }
    if (command.includes('mutool')) return okRun('mutool version 1.27.2\n')
    if (command.includes('qpdf')) return okRun('qpdf version 12.3.2\n')
    return okRun('ok')
  },
  resolveYtDlpBinaryInfo: () => ({ path: '/runtime/bin/yt-dlp', source: 'managed' }),
  readDefuddleCliReadiness: async () => ({ label: 'defuddle', status: 'OK', detail: 'defuddle 0.17.0', severity: 'info' }),
  resolveConfigPath: async () => '/tmp/autoshow.json',
  loadConfig: async () => ({}),
  inspectYtDlpAuthState: async () => ({
    configuredMode: 'none',
    usableMode: 'none',
    cookieArgs: []
  }),
  validateManagedArtifact: async (tool) => ({
    healthy: true,
    distribution: 'source',
    version: tool === 'mupdf' ? '1.27.2' : '12.3.2',
    platform: 'darwin',
    architecture: 'arm64'
  }),
  ...overrides
})

const flattenDoctorChecks = (report: Awaited<ReturnType<typeof collectDoctorReport>>): DoctorCheck[] =>
  report.sections.flatMap(section => section.checks)

const findDoctorCheck = (
  report: Awaited<ReturnType<typeof collectDoctorReport>>,
  label: string
): DoctorCheck => {
  return requireDefined(
    flattenDoctorChecks(report).find(check => check.label === label),
    `doctor check: ${label}`
  )
}

describe('setup doctor contracts', () => {
  test('doctor reports whether the running Bun version matches the repository pin', async () => {
    const supported = await collectDoctorReport(makeDoctorProbes())
    expect(findDoctorCheck(supported, 'Bun runtime')).toMatchObject({
      status: 'OK',
      detail: `${SUPPORTED_BUN_VERSION} (supported)`
    })

    const drifted = await collectDoctorReport(makeDoctorProbes({ bunVersion: '1.3.14' }))
    expect(findDoctorCheck(drifted, 'Bun runtime')).toMatchObject({
      status: 'WARN',
      nextStep: `install Bun ${SUPPORTED_BUN_VERSION}`
    })
    expect(drifted.hasWarnings).toBe(true)
  })

  test('doctor reports missing managed runtimes and local model assets', async () => {
    const missingPathFragments = [
      '/runtime/bin/whisper-cli',
      'ggml-tiny.bin',
      'ggml-large-v3-turbo.bin'
    ]
    const report = await collectDoctorReport(makeDoctorProbes({
      pathExists: async (path) => !missingPathFragments.some(fragment => path.includes(fragment))
    }))

    expect(findDoctorCheck(report, 'runtime/bin/whisper-cli').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'default whisper model tiny').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'music whisper model large-v3-turbo').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'music whisper model large-v3-turbo').nextStep).toBe('bun autoshow setup')
    expect(report.nextSteps).toContain('bun autoshow setup --step whisper-binary')
  })

  test('doctor reports managed macOS media document and OCR tool readiness', async () => {
    const missingPathFragments = [
      'runtime/bin/yt-dlp',
      'runtime/bin/ffmpeg',
      'runtime/bin/ffprobe',
      'runtime/bin/mutool',
      'runtime/bin/ebook-convert',
      'runtime/bin/tesseract',
      'runtime/tools/tessdata/eng.traineddata'
    ]
    const report = await collectDoctorReport(makeDoctorProbes({
      pathExists: async (path) => !missingPathFragments.some(fragment => path.includes(fragment))
    }))

    expect(findDoctorCheck(report, 'yt-dlp').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'ffmpeg').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'ffprobe').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'mutool').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'ebook-convert').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'tesseract').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'Tesseract eng data').status).toBe('MISSING')
    expect(flattenDoctorChecks(report).map(check => check.label).join('\n').toLowerCase()).not.toContain('acsm')
    expect(report.nextSteps).toContain('bun autoshow setup --step yt-dlp')
    expect(report.nextSteps).toContain('bun autoshow setup --step calibre')
    expect(report.nextSteps.join('\n').toLowerCase()).not.toContain('acsm')
    expect(report.nextSteps).toContain('bun autoshow setup')
  })

  test('doctor truthfully labels healthy managed MuPDF and qpdf source installs', async () => {
    const report = await collectDoctorReport(makeDoctorProbes())

    expect(findDoctorCheck(report, 'mutool').detail).toContain('managed source 1.27.2 darwin/arm64')
    expect(findDoctorCheck(report, 'qpdf').detail).toContain('managed source 12.3.2 darwin/arm64')
  })

  test('doctor truthfully labels verified managed prebuilts without network access', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      validateManagedArtifact: async tool => ({
        healthy: true,
        distribution: 'prebuilt',
        version: tool === 'mupdf' ? '1.27.2' : '12.3.2',
        revision: 'r1',
        platform: 'darwin',
        architecture: 'arm64'
      })
    }))

    expect(findDoctorCheck(report, 'mutool').detail).toContain('managed prebuilt 1.27.2-r1 darwin/arm64')
    expect(findDoctorCheck(report, 'qpdf').detail).toContain('managed prebuilt 12.3.2-r1 darwin/arm64')
  })

  test('doctor reports corrupt managed provenance as unhealthy before launch', async () => {
    let qpdfLaunches = 0
    const report = await collectDoctorReport(makeDoctorProbes({
      validateManagedArtifact: async (tool) => tool === 'qpdf'
        ? { healthy: false, reason: 'payload hash mismatch for bin/qpdf' }
        : {
            healthy: true,
            distribution: 'source',
            version: '1.27.2',
            platform: 'darwin',
            architecture: 'arm64'
          },
      run: async (command, args) => {
        if (command.includes('qpdf')) qpdfLaunches += 1
        if (command.includes('tesseract') && args.includes('--list-langs')) return okRun('eng\n')
        if (command.includes('ffmpeg') && args.includes('-filters')) return okRun(' ... ass\n')
        if (command.includes('mutool')) return okRun('mutool version 1.27.2\n')
        return okRun('ok')
      }
    }))

    expect(findDoctorCheck(report, 'qpdf')).toMatchObject({
      status: 'WARN',
      nextStep: 'bun autoshow setup --step calibre'
    })
    expect(findDoctorCheck(report, 'qpdf').detail).toContain('payload hash mismatch')
    expect(qpdfLaunches).toBe(0)
  })

  test('doctor rejects a managed shim that launches the wrong version', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      run: async (command, args) => {
        if (command.includes('tesseract') && args.includes('--list-langs')) return okRun('eng\n')
        if (command.includes('ffmpeg') && args.includes('-filters')) return okRun(' ... ass\n')
        if (command.includes('mutool')) return okRun('mutool version 1.27.2\n')
        if (command.includes('qpdf')) return okRun('qpdf version 11.0.0\n')
        return okRun('ok')
      }
    }))

    expect(findDoctorCheck(report, 'qpdf')).toMatchObject({
      status: 'WARN',
      nextStep: 'bun autoshow setup --step calibre'
    })
    expect(findDoctorCheck(report, 'qpdf').detail).toContain('did not report expected version 12.3.2')
  })

  test('doctor keeps --bin-dir precedence without claiming managed provenance', async () => {
    const previousBinDir = getConfiguredBinDir()
    configureBinDir('/tmp/autoshow-doctor-override')
    let provenanceChecks = 0
    try {
      const report = await collectDoctorReport(makeDoctorProbes({
        validateManagedArtifact: async () => {
          provenanceChecks += 1
          return { healthy: false, reason: 'must not inspect a bypassed managed tree' }
        }
      }))

      expect(findDoctorCheck(report, 'mutool').detail).toContain('/tmp/autoshow-doctor-override/mutool (override)')
      expect(findDoctorCheck(report, 'qpdf').detail).toContain('/tmp/autoshow-doctor-override/qpdf (override)')
      expect(provenanceChecks).toBe(0)
    } finally {
      configureBinDir(previousBinDir ?? '')
    }
  })

  test('doctor reports missing managed Tesseract config files', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      pathExists: async (path) => !path.includes('runtime/tools/tessdata/configs/hocr')
    }))

    const check = findDoctorCheck(report, 'Tesseract eng data')
    expect(check.status).toBe('MISSING')
    expect(check.detail).toContain('configs/hocr')
    expect(check.nextStep).toBe('bun autoshow setup')
  })

  test('doctor next steps preserve discovery order while deduplicating', () => {
    const steps = collectDoctorNextSteps([
      {
        title: 'first',
        checks: [
          { status: 'MISSING', label: 'c', detail: 'c', severity: 'warn', nextStep: 'step c' },
          { status: 'MISSING', label: 'a', detail: 'a', severity: 'warn', nextStep: 'step a' }
        ]
      },
      {
        title: 'second',
        checks: [
          { status: 'MISSING', label: 'duplicate c', detail: 'c', severity: 'warn', nextStep: 'step c' },
          { status: 'INFO', label: 'info', detail: 'i', severity: 'info', nextStep: 'info step' },
          { status: 'MISSING', label: 'b', detail: 'b', severity: 'warn', nextStep: 'step b' }
        ]
      }
    ])

    expect(steps).toEqual(['step c', 'step a', 'step b'])
  })

  test('doctor treats absent optional hosted provider keys as non-warning when unconfigured', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({ env: {} }))

    expect(findDoctorCheck(report, 'TOGETHER_API_KEY (Together write/STT)').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'TOGETHER_API_KEY (Together write/STT)').severity).toBe('info')
    expect(findDoctorCheck(report, 'HAPPYSCRIBE_API_KEY (Happy Scribe STT)').severity).toBe('info')
    expect(findDoctorCheck(report, 'SUPADATA_API_KEY (Supadata STT/URL)').severity).toBe('info')
    expect(report.hasWarnings).toBe(false)
  })

  test('doctor identifies only credentials required by configured defaults', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      env: { OPENAI_API_KEY: 'configured' },
      loadConfig: async () => ({
        defaults: {
          llm: {
            openai: ['gpt-5'],
            together: ['moonshotai/Kimi-K2-Instruct']
          }
        }
      })
    }))

    expect(report.missingConfiguredCredentialEnvVars).toEqual(['TOGETHER_API_KEY'])
  })

  test('strict doctor exits 2 for missing configured credentials while default doctor remains advisory', async () => {
    const probes = makeDoctorProbes({
      env: {},
      loadConfig: async () => ({ defaults: { llm: { together: ['moonshotai/Kimi-K2-Instruct'] } } })
    })

    const advisory = await runDoctor({ probeOverrides: probes })
    expect(advisory.missingConfiguredCredentialEnvVars).toEqual(['TOGETHER_API_KEY'])

    try {
      await runDoctor({ strict: true, probeOverrides: probes })
      throw new Error('strict doctor unexpectedly succeeded')
    } catch (error) {
      expect(error).toBeInstanceOf(AppUsageError)
      expect((error as AppUsageError).exitCode).toBe(2)
      expect((error as AppUsageError).metadata['missingCredentialEnvVars']).toEqual(['TOGETHER_API_KEY'])
    }
  })

  test('doctor accepts either ffmpeg ass support or fallback lyric-video renderer tools', async () => {
    const withAss = await collectDoctorReport(makeDoctorProbes({
      which: (command) => command === 'pango-view' || command === 'convert' ? undefined : `/usr/bin/${command}`,
      run: async (command, args) => {
        if (command.includes('tesseract') && args.includes('--list-langs')) return okRun('eng\n')
        if (command.includes('ffmpeg') && args.includes('-filters')) return okRun(' ... ass\n')
        return okRun('ok')
      }
    }))
    expect(findDoctorCheck(withAss, 'music lyric-video renderer').status).toBe('OK')
    expect(findDoctorCheck(withAss, 'music lyric-video renderer').detail).toContain('ass filter')

    const withFallback = await collectDoctorReport(makeDoctorProbes({
      run: async (command, args) => {
        if (command.includes('tesseract') && args.includes('--list-langs')) return okRun('eng\n')
        if (command.includes('ffmpeg') && args.includes('-filters')) return okRun('filters without subtitle renderer\n')
        return okRun('ok')
      }
    }))
    expect(findDoctorCheck(withFallback, 'music lyric-video renderer').status).toBe('OK')
    expect(findDoctorCheck(withFallback, 'music lyric-video renderer').detail).toContain('fallback renderer')
  })

  for (const [step, targets, prefix] of [
    ['image', STANDALONE_IMAGE_PROVIDER_TARGETS, 'defaults.image.'],
    ['video', STANDALONE_VIDEO_PROVIDER_TARGETS, 'defaults.video.']
  ] as const) {
    test(`${step} setup env keys are derived from every registered provider`, () => {
      const configPathFor = (flagName: string): string =>
        `${prefix}${flagName.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())}`

      const expected = new Set<string>()
      const unmapped: string[] = []
      for (const flagName of Object.values(targets)) {
        const envVar = findHostedProviderEnvKeyForConfigPath(configPathFor(flagName))
        if (envVar === undefined) unmapped.push(flagName)
        else expected.add(envVar)
      }

      expect(unmapped).toEqual([])
      expect([...getHostedProviderEnvKeysForConfigPrefix(prefix)].sort()).toEqual([...expected].sort())
    })
  }

  test('transcription setup env keys cover registered engines with explicit local exceptions', () => {
    const prefix = 'defaults.extract.stt.'
    const enginesWithoutHostedCredentials = new Set<string>([
      'whisper-stt',
      'whisperfile-stt'
    ])
    const expected = new Set<string>()
    const unmapped: string[] = []

    for (const target of Object.values(WRITE_STT_PROVIDER_TARGETS)) {
      if (enginesWithoutHostedCredentials.has(target)) continue
      const suffix = target.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
      const configPath = `${prefix}${suffix}`
      const envVar = findHostedProviderEnvKeyForConfigPath(configPath)
      if (envVar === undefined) unmapped.push(target)
      else expected.add(envVar)
    }

    expect(unmapped).toEqual([])
    expect([...getHostedProviderEnvKeysForConfigPrefix(prefix)].sort()).toEqual([...expected].sort())
    expect(expected).not.toContain('OPENAI_API_KEY')
    expect(expected).not.toContain('GLM_API_KEY')
    expect(expected).not.toContain('ELEVENLABS_API_KEY')
  })

  for (const [step, targets, prefix, localTargets] of [
    ['write', WRITE_LLM_PROVIDER_TARGETS, 'defaults.llm.', new Set<string>()],
    ['tts', STANDALONE_TTS_PROVIDER_TARGETS, 'defaults.tts.', new Set<string>()],
    ['music', STANDALONE_MUSIC_PROVIDER_TARGETS, 'defaults.music.', new Set<string>()]
  ] as const) {
    test(`${step} setup env keys cover registered providers with explicit local exclusions`, () => {
      const expected = new Set<string>()
      const unmapped: string[] = []

      for (const target of Object.values(targets)) {
        if (localTargets.has(target)) continue
        const suffix = target.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
        const envVar = findHostedProviderEnvKeyForConfigPath(`${prefix}${suffix}`)
        if (envVar === undefined) unmapped.push(target)
        else expected.add(envVar)
      }

      expect(unmapped).toEqual([])
      expect([...getHostedProviderEnvKeysForConfigPrefix(prefix)].sort()).toEqual([...expected].sort())
    })
  }

  test('doctor hosted provider map covers supported env vars', () => {
    const envVars = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar)
    expect(envVars).toEqual(expect.arrayContaining([
      'FAL_API_KEY',
      'TOGETHER_API_KEY',
      'HAPPYSCRIBE_API_KEY',
      'SUPADATA_API_KEY',
      'SCRAPECREATORS_API_KEY',
      'FIRECRAWL_API_KEY',
      'SPIDER_API_KEY',
      'ZYTE_API_KEY',
      'LTXV_API_KEY',
      'X_BEARER_TOKEN'
    ]))
  })
})
