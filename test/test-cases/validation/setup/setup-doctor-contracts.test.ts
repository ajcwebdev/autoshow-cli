import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  collectDoctorNextSteps,
  collectDoctorReport,
  runDoctor
} from '~/cli/commands/setup-and-utilities/setup/run-doctor'
import {
  findHostedProviderEnvKeysForConfigPath,
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
import { configureBinDir, getConfiguredBinDir, RUNTIME_DIR } from '~/utils/runtime-paths'
import type { DoctorCheck, DoctorProbes, RunResult } from '~/types'
import { AppUsageError } from '~/utils/error-handler'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'
import { requireDefined } from '../../../test-utils/value-assertions'
import { createDoctorToolProvenance } from '~/cli/commands/setup-and-utilities/setup/doctor-tool-provenance'
import { ensureProjectRuntimeDependencies, snapshotProjectDependencyGraph } from '~/tools/project-runtime-dependencies'

const okRun = (stdout = ''): RunResult => ({ stdout, stderr: '', exitCode: 0 })

const makeDoctorProbes = (overrides: Partial<DoctorProbes> = {}): Partial<DoctorProbes> => ({
  bunVersion: SUPPORTED_BUN_VERSION,
  platform: 'darwin',
  env: {},
  which: (command: string) => `/usr/bin/${command}`,
  pathExists: async () => true,
  listDirectory: async () => ['whisper-tiny.llamafile', 'whisper-small.en.llamafile'],
  directoryHasFiles: async () => true,
  executeReadOnlyTools: true,
  validateRuntimeTool: async () => ({ healthy: true, detail: 'synthetic managed receipt and complete payload verified' }),
  validateRenderingConfiguration: async () => ({ healthy: true, detail: 'synthetic managed font/configuration receipt verified' }),
  validateWhisperfile: async () => ({ healthy: true, detail: 'synthetic pinned Whisperfile artifact verified' }),
  validateTesseractData: async () => ({ healthy: true, detail: 'synthetic trusted English data checksum verified' }),
  validateAlignmentRuntime: async () => ({ healthy: true, detail: 'synthetic frozen alignment graph verified' }),
  validateProjectDependencies: async () => ({ healthy: true, detail: 'synthetic source dependency alias and graph verified' }),
  resolveTessdataPrefix: () => '/fixture/tessdata',
  run: async (command: string, args: string[]) => {
    if (command.includes('tesseract') && args.includes('--list-langs')) {
      return okRun('List of available languages in "/tmp":\neng\n')
    }
    if (command.includes('ffmpeg') && args.includes('-filters')) {
      return okRun(' ... ass              V->V       Render ASS subtitles\n')
    }
    if ((command.endsWith('/magick') || command.endsWith('/convert')) && args.includes('format')) return okRun('     TIFF* TIFF      rw+ Tagged Image File Format\n')
    if (command.endsWith('/fc-match')) return okRun('DejaVu Sans')
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
  test('doctor defers the self-extracting macOS downloader probe after verifying its pinned identity and rejects invalid identity before launch', async () => {
    let downloaderLaunches = 0
    const base = makeDoctorProbes()
    const run = requireDefined(base.run, 'synthetic doctor runner')
    const probes = makeDoctorProbes({ run: async (command, args) => {
      if (command.endsWith('/yt-dlp')) downloaderLaunches += 1
      return await run(command, args)
    } })
    const healthy = findDoctorCheck(await collectDoctorReport(probes), 'yt-dlp')
    expect(healthy.status).toBe('OK')
    expect(healthy.detail).toContain('synthetic managed receipt and complete payload verified')
    expect(healthy.detail).toContain('executable probe deferred to mutating setup')
    expect(downloaderLaunches).toBe(0)
    const validate = requireDefined(probes.validateRuntimeTool, 'synthetic provenance validator')
    const corrupt = findDoctorCheck(await collectDoctorReport({ ...probes, validateRuntimeTool: async (tool, path) =>
      tool === 'yt-dlp' ? { healthy: false, reason: 'Pinned downloader executable SHA256 does not match its managed identity.' } : await validate(tool, path)
    }), 'yt-dlp')
    expect(corrupt.status).toBe('WARN')
    expect(corrupt.detail).toContain('SHA256 does not match')
    expect(downloaderLaunches).toBe(0)
  })

  test('doctor accepts the current ImageMagick TIFF format row without a redundant coder column', async () => {
    const probes = makeDoctorProbes()
    const run = requireDefined(probes.run, 'synthetic doctor runner')
    const report = await collectDoctorReport({ ...probes, run: async (command, args) =>
      command.endsWith('/magick') && args.includes('format') ? okRun(' TIFF* rw+ Tagged Image File Format\n') : await run(command, args)
    })
    expect(findDoctorCheck(report, 'ImageMagick sheets and TIFF').status).toBe('OK')
  })

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
      'whisper-tiny.llamafile',
      'whisper-small.en.llamafile'
    ]
    const report = await collectDoctorReport(makeDoctorProbes({
      pathExists: async (path) => !missingPathFragments.some(fragment => path.includes(fragment))
    }))

    expect(findDoctorCheck(report, 'whisperfile tiny').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'default whisperfile model tiny').status).toBe('MISSING')
    expect(report.nextSteps).toContain('bun autoshow setup --step whisperfile')
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
    expect(report.nextSteps).toContain('bun autoshow setup --step ocr')
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
    const overrideDir = `${RUNTIME_DIR}/doctor-test-overrides`
    configureBinDir(overrideDir)
    let provenanceChecks = 0
    try {
      const report = await collectDoctorReport(makeDoctorProbes({
        validateManagedArtifact: async () => {
          provenanceChecks += 1
          return { healthy: false, reason: 'must not inspect a bypassed managed tree' }
        }
      }))

      expect(findDoctorCheck(report, 'mutool').detail).toContain(`${overrideDir}/mutool (override)`)
      expect(findDoctorCheck(report, 'qpdf').detail).toContain(`${overrideDir}/qpdf (override)`)
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
    expect(check.nextStep).toBe('bun autoshow setup --step ocr')
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

    expect(findDoctorCheck(report, 'TOGETHER_API_KEY (Together STT)').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'TOGETHER_API_KEY (Together STT)').severity).toBe('info')
    expect(report.hasWarnings).toBe(false)
  })

  test('doctor identifies only credentials required by configured defaults', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      env: { OPENAI_API_KEY: 'configured' },
      loadConfig: async () => ({
        defaults: {
          llm: {
            openai: ['gpt-6-luna'],
            anthropic: ['claude-sonnet-5-5']
          }
        }
      })
    }))

    expect(report.missingConfiguredCredentialEnvVars).toEqual(['ANTHROPIC_API_KEY'])
  })

  test('strict doctor exits 2 for missing configured credentials while default doctor remains advisory', async () => {
    const probes = makeDoctorProbes({
      env: {},
      loadConfig: async () => ({ defaults: { llm: { anthropic: ['claude-sonnet-5-5'] } } })
    })

    const advisory = await runDoctor({ probeOverrides: probes })
    expect(advisory.missingConfiguredCredentialEnvVars).toEqual(['ANTHROPIC_API_KEY'])

    try {
      await runDoctor({ strict: true, probeOverrides: probes })
      throw new Error('strict doctor unexpectedly succeeded')
    } catch (error) {
      expect(error).toBeInstanceOf(AppUsageError)
      expect((error as AppUsageError).exitCode).toBe(2)
      expect((error as AppUsageError).metadata['missingCredentialEnvVars']).toEqual(['ANTHROPIC_API_KEY'])
    }
  })

  test('doctor accepts either ffmpeg ass support or fallback lyric-video renderer tools', async () => {
    const withAss = await collectDoctorReport(makeDoctorProbes({
      pathExists: async path => !path.endsWith('/pango-view') && !path.endsWith('/convert'),
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

  test('doctor ignores external rendering tools when managed executables are missing on every platform', async () => {
    for (const platform of ['darwin', 'linux'] as const) {
      const report = await collectDoctorReport(makeDoctorProbes({
        platform,
        pathExists: async path => !['ffmpeg', 'magick', 'convert', 'pango-view', 'fc-match'].some(tool => path.endsWith(`/${tool}`)),
        which: command => `/external/tools/${command}`
      }))
      expect(findDoctorCheck(report, 'music lyric-video renderer')).toMatchObject({ status: 'MISSING', nextStep: 'bun autoshow setup --step rendering' })
      expect(findDoctorCheck(report, 'ImageMagick sheets and TIFF').status).toBe('MISSING')
      expect(findDoctorCheck(report, 'Managed rendering fonts').status).toBe('MISSING')
    }
  })

  test('doctor rejects unusable managed image codecs and fonts before claiming readiness', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      run: async (command, args) => {
        if (command.endsWith('/magick') && args.includes('format')) return okRun('PNG PNG rw+ Portable Network Graphics')
        if (command.endsWith('/fc-match')) return okRun('Some unrelated font')
        return okRun('ok')
      }
    }))
    expect(findDoctorCheck(report, 'ImageMagick sheets and TIFF')).toMatchObject({ status: 'WARN', nextStep: 'bun autoshow setup --step rendering' })
    expect(findDoctorCheck(report, 'Managed rendering fonts')).toMatchObject({ status: 'WARN', nextStep: 'bun autoshow setup --step rendering' })
  })

  test('doctor rejects invalid receipts for every managed tool family before executable dispatch', async () => {
    const invalid = new Set(['cmake', 'bun', 'deno', 'ffmpeg', 'ffprobe', 'tesseract', 'ebook-convert', 'magick', 'convert', 'fc-match'])
    const calls: string[] = []
    const report = await collectDoctorReport(makeDoctorProbes({
      validateRuntimeTool: async tool => invalid.has(tool)
        ? { healthy: false, reason: `missing or corrupt ${tool} receipt` }
        : { healthy: true, detail: 'synthetic verified receipt' },
      run: async command => { calls.push(command); return okRun(command.includes('qpdf') ? 'qpdf version 12.3.2' : 'mutool version 1.27.2') }
    }))
    for (const label of ['Managed CMake', 'Managed Bun worker', 'Downloader JavaScript runtime', 'ffmpeg', 'ffprobe', 'tesseract', 'Tesseract eng data', 'ebook-convert', 'ImageMagick sheets and TIFF', 'Managed rendering fonts', 'music lyric-video renderer']) {
      expect(findDoctorCheck(report, label).status).toBe('WARN')
      expect(findDoctorCheck(report, label).detail).toContain('receipt')
    }
    expect(calls.some(command => [...invalid].some(tool => command.endsWith(`/${tool}`)))).toBe(false)
    expect(calls.some(command => command === 'sh' || command.includes('whisper-'))).toBe(false)
  })

  test('doctor does not run font matching to populate an absent cache or launch Whisperfile help', async () => {
    const calls: string[] = []
    const report = await collectDoctorReport(makeDoctorProbes({
      directoryHasFiles: async () => false,
      run: async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`)
        if (command.includes('tesseract') && args.includes('--list-langs')) return okRun('eng\n')
        if (command.includes('ffmpeg') && args.includes('-filters')) return okRun(' ... ass\n')
        if (command.includes('mutool')) return okRun('mutool version 1.27.2')
        if (command.includes('qpdf')) return okRun('qpdf version 12.3.2')
        if (command.endsWith('/magick')) return okRun(' TIFF* TIFF rw+ Tagged Image File Format')
        return okRun('ok')
      }
    }))
    expect(findDoctorCheck(report, 'Managed rendering fonts')).toMatchObject({ status: 'WARN', nextStep: 'bun autoshow setup --step rendering' })
    expect(findDoctorCheck(report, 'Managed rendering fonts').detail).toContain('cache is absent')
    expect(findDoctorCheck(report, 'whisperfile tiny').status).toBe('OK')
    expect(calls.some(command => command.includes('fc-match') || command.includes('whisper-'))).toBe(false)
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
        const envVars = findHostedProviderEnvKeysForConfigPath(configPathFor(flagName))
        if (envVars.length === 0) unmapped.push(flagName)
        for (const envVar of envVars) expected.add(envVar)
      }

      expect(unmapped).toEqual([])
      expect([...getHostedProviderEnvKeysForConfigPrefix(prefix)].sort()).toEqual([...expected].sort())
    })
  }

  test('transcription setup env keys cover registered engines with explicit local exceptions', () => {
    const prefix = 'defaults.extract.stt.'
    const enginesWithoutHostedCredentials = new Set<string>([
      'whisperfile-stt'
    ])
    const expected = new Set<string>()
    const unmapped: string[] = []

    for (const target of Object.values(WRITE_STT_PROVIDER_TARGETS)) {
      if (enginesWithoutHostedCredentials.has(target)) continue
      const suffix = target.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
      const configPath = `${prefix}${suffix}`
      const envVars = findHostedProviderEnvKeysForConfigPath(configPath)
      if (envVars.length === 0) unmapped.push(target)
      for (const envVar of envVars) expected.add(envVar)
    }

    expect(unmapped).toEqual([])
    expect([...getHostedProviderEnvKeysForConfigPrefix(prefix)].sort()).toEqual([...expected].sort())
    expect(expected).toContain('OPENAI_API_KEY')
    expect(expected).toContain('CLOUDFLARE_API_TOKEN')
    expect(expected).toContain('CLOUDFLARE_ACCOUNT_ID')
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
        const envVars = findHostedProviderEnvKeysForConfigPath(`${prefix}${suffix}`)
        if (envVars.length === 0) unmapped.push(target)
        for (const envVar of envVars) expected.add(envVar)
      }

      expect(unmapped).toEqual([])
      expect([...getHostedProviderEnvKeysForConfigPrefix(prefix)].sort()).toEqual([...expected].sort())
    })
  }

  test('doctor hosted provider map covers supported env vars', () => {
    const envVars = HOSTED_PROVIDER_ENV_CHECKS.map(check => check.envVar)
    expect(envVars).toEqual(expect.arrayContaining([
      'TOGETHER_API_KEY',
      'SCRAPECREATORS_API_KEY',
      'SPIDER_API_KEY',
      'ZYTE_API_KEY',
      'X_BEARER_TOKEN'
    ]))
    expect(envVars).not.toContain('FAL_API_KEY')
  })
})

for (const failure of ['changed-payload', 'missing-alias', 'missing-receipt', 'migration.json', 'installation.json'] as const) {
  test(`doctor diagnoses source project dependency ${failure} without changing or repairing its graph`, async () => {
    const sourceRoot = await mkdtemp(join(tmpdir(), 'autoshow-doctor-project-'))
    const dependencyRoot = join(sourceRoot, 'runtime/tools/project-dependencies')
    try {
      await writeFile(join(sourceRoot, 'package.json'), JSON.stringify({ name: 'fixture', dependencies: { sample: '1.2.3' } }))
      await writeFile(join(sourceRoot, 'bun.lock'), '{ "fixture": "frozen" }\n')
      await writeFile(join(sourceRoot, 'bunfig.toml'), '[install.cache]\ndir="runtime/cache/bun"\n')
      await mkdir(join(sourceRoot, 'node_modules/sample'), { recursive: true })
      await writeFile(join(sourceRoot, 'node_modules/sample/package.json'), JSON.stringify({ name: 'sample', version: '1.2.3' }))
      await writeFile(join(sourceRoot, 'node_modules/sample/resource'), 'original dependency payload\n', { mode: 0o640 })
      await ensureProjectRuntimeDependencies({ projectRoot: sourceRoot })
      const probes = () => makeDoctorProbes({ validateProjectDependencies: createDoctorToolProvenance({ sourceRoot }).validateProjectDependencies })
      const healthy = await runDoctor({ strict: true, probeOverrides: probes() })
      expect(findDoctorCheck(healthy, 'Source project dependencies').status).toBe('OK')
      if (failure === 'changed-payload') await writeFile(join(dependencyRoot, 'node_modules/sample/resource'), 'corrupt dependency payload\n')
      else if (failure === 'missing-alias') await unlink(join(sourceRoot, 'node_modules'))
      else if (failure === 'missing-receipt') await unlink(join(dependencyRoot, 'project-dependencies.json'))
      else await writeFile(join(dependencyRoot, failure), '{"interrupted":"preserve"}\n', { mode: 0o600 })
      const before = await snapshotProjectDependencyGraph(sourceRoot)
      const report = await collectDoctorReport(probes())
      const check = findDoctorCheck(report, 'Source project dependencies')
      expect(check.status).toBe('WARN')
      expect(check.detail).toMatch(/receipt|alias|unfinished dependency migration|unfinished frozen installation/)
      await expect(runDoctor({ strict: true, probeOverrides: probes() })).rejects.toMatchObject({ exitCode: 2 })
      expect(await snapshotProjectDependencyGraph(sourceRoot)).toEqual(before)
    } finally { await rm(sourceRoot, { recursive: true, force: true }) }
  })
}


test('strict doctor rejects invalid configuration, unreadable cookies and missing tools; advisory remains usable', async () => {
  const failures: Partial<DoctorProbes>[] = [
    { loadConfig: async () => { throw new Error('invalid config fixture') } },
    { inspectYtDlpAuthState: async () => ({ configuredMode: 'cookies-file', usableMode: 'none', cookiesReadable: false, cookiesPath: '/fixture/unreadable', cookieArgs: [] }) },
    { pathExists: async () => false, which: () => undefined }
  ]
  for (const failure of failures) {
    const probeOverrides = makeDoctorProbes(failure)
    expect((await runDoctor({ probeOverrides })).hasWarnings).toBe(true)
    await expect(runDoctor({ strict: true, probeOverrides })).rejects.toThrow(AppUsageError)
  }
  expect((await runDoctor({ strict: true, probeOverrides: makeDoctorProbes() })).hasWarnings).toBe(false)
})
