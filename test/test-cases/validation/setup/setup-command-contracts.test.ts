import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { runCommand } from '../../../test-utils/test-helpers'
import { CALIBRE_REQUIRED_TOOLS } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { readDependencyMetadata } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import {
  collectDoctorNextSteps,
  collectDoctorReport
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
import { collectReclaimableWhisperCoremlArtifacts, getForceRedownloadPaths, runConcurrentSetupTasks, runInherit, shouldReportReclaimedBuildTrees } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { formatSetupElapsed, formatSetupHeartbeatLine } from '~/cli/commands/setup-and-utilities/setup/setup-heartbeat'
import { setCompactSetupMode } from '~/utils/setup-output-mode'
import { configureBinDir, getConfiguredBinDir, qpdfBuildDir, qpdfManagedBinaryPath, qpdfToolDir, resolveRuntimeToolInfo, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import type { DoctorCheck, DoctorProbes, RunResult } from '~/types'

const okRun = (stdout = ''): RunResult => ({ stdout, stderr: '', exitCode: 0 })

const waitForTurn = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

const makeDoctorProbes = (overrides: Partial<DoctorProbes> = {}): Partial<DoctorProbes> => ({
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
  resolveUvCommand: async () => '/usr/bin/uv',
  readDefuddleCliReadiness: async () => ({ label: 'defuddle', ok: true, detail: 'defuddle 0.17.0' }),
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
  const item = flattenDoctorChecks(report).find(check => check.label === label)
  if (!item) throw new Error(`Missing doctor check: ${label}`)
  return item
}

describe('setup command contracts', () => {
  test('setup rejects the retired ACSM step and omits retired steps from valid values', async () => {
    const parsed = parseCommandInvocation(
      ['setup', '--step', 'acsm'],
      setupCommand,
      GLOBAL_FLAG_DEFINITIONS
    )
    if (!parsed.command) throw new Error('parsed setup command is missing')
    let message = ''
    try {
      await setupCommand.handler({
        argv: parsed.argv,
        command: parsed.command,
        flags: parsed.flags,
        parameters: parsed.parameters,
        rawParsed: parsed.rawParsed,
        store: {}
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('Invalid --step value: acsm')
    expect(message).toContain('defuddle')
    expect(message).toContain('whisperfile')
    expect(message.slice(message.indexOf('Valid values:'))).not.toContain('acsm')
    expect(message).not.toContain('llamafile')
  })

  test('setup --models rejects an unknown whisperfile model before downloading', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--models', 'whisperfile:bogus'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid model "bogus" for --provider/--stt whisperfile[=model]')
  })

  test('Linux yt-dlp setup writes the managed runtime binary without sudo chmod or mv', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts').text()

    expect(source).toContain('ytDlpManagedBinaryPath')
    expect(source).toContain('makeExecutable(ytDlpManagedBinaryPath)')
    expect(source).not.toContain("runInherit('sudo', ['mv'")
    expect(source).not.toContain("runInherit('sudo', ['chmod'")
  })

  test('source setup no longer invokes Homebrew', async () => {
    const sourceFiles = [
      'src/cli/commands/setup-and-utilities/setup/setup-download/dl-audio/audio.ts',
      'src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document.ts',
      'src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre.ts',
      'src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/tesseract-setup.ts'
    ]
    const source = (await Promise.all(sourceFiles.map(async (path) => await Bun.file(path).text()))).join('\n')

    expect(source).not.toContain("runInherit('brew'")
    expect(source).not.toContain('brew install')
    expect(source).toContain('installManagedFfmpegMacos')
    expect(source).toContain('installManagedYtDlpMacos')
    expect(source).toContain('installManagedMupdfMacos')
    expect(source).toContain('installManagedCalibreMacos')
    expect(source).toContain('installManagedTesseractMacos')
    expect(source).toContain('installManagedQpdfMacos')
  })

  test('cold all and calibre resets explicitly clear every managed qpdf artifact', async () => {
    const expected = [qpdfManagedBinaryPath, qpdfBuildDir, qpdfToolDir]
    const [allPaths, calibrePaths] = await Promise.all([
      getForceRedownloadPaths('all'),
      getForceRedownloadPaths('calibre')
    ])

    for (const path of expected) {
      expect(allPaths).toContain(path)
      expect(calibrePaths).toContain(path)
    }
  })

  test('pins the static qpdf libjpeg-turbo source dependency', async () => {
    const metadata = await readDependencyMetadata()

    expect(metadata['libjpeg-turbo']).toEqual({
      version: '3.2.0',
      url: 'https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/3.2.0/libjpeg-turbo-3.2.0.tar.gz',
      sha256: '6f30092cef9fb839779646608f4ee14ae3cbac989c47fa05e841b0841f09878e'
    })
  })

  test('full setup covers doctor-managed local OCR runtimes and Whisper models without CoreML conversion', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts').text()

    expect(source).toContain("export const defaultMusicWhisperModel = 'large-v3-turbo'")
    expect(source).toContain('await downloadWhisperModel(defaultWhisperModel)')
    expect(source).toContain('await downloadWhisperModel(defaultMusicWhisperModel)')
    expect(source).not.toContain('convertWhisperModelToCoreml')
    expect(source).not.toContain('fetchWhisperModel')
    expect(source).toContain("{ label: 'OCR', run: setupTesseractOcr }")
    expect(source).toContain("['tesseract', hasRuntimeTool('tesseract')]")
    expect(source).toContain('[`whisper ${defaultMusicWhisperModel}`, await pathExists(`${whisperModelsDir}/ggml-${defaultMusicWhisperModel}.bin`)]')
  })

  test('macOS owned tool resolution prefers overrides then managed runtime without PATH fallback', () => {
    const pathBinary = '/opt/homebrew/bin/yt-dlp'
    const managed = resolveRuntimeToolInfo('yt-dlp', {
      platform: 'darwin',
      exists: (path) => path === ytDlpManagedBinaryPath,
      which: () => pathBinary
    })
    expect(managed).toEqual({ id: 'yt-dlp', path: ytDlpManagedBinaryPath, source: 'managed' })

    const override = resolveRuntimeToolInfo('ffmpeg', {
      platform: 'darwin',
      overrideBinDir: '/custom/bin',
      exists: (path) => path === '/custom/bin/ffmpeg',
      which: () => '/opt/homebrew/bin/ffmpeg'
    })
    expect(override).toEqual({ id: 'ffmpeg', path: '/custom/bin/ffmpeg', source: 'override' })

    const absent = resolveRuntimeToolInfo('yt-dlp', {
      platform: 'darwin',
      exists: () => false,
      which: () => pathBinary
    })
    expect(absent).toBeUndefined()
  })

  test('command existence checks use Bun APIs instead of shell test', async () => {
    const setupSource = await Bun.file('src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts').text()
    const utilSource = await Bun.file('src/utils/cli-utils.ts').text()
    const combinedSource = `${setupSource}\n${utilSource}`

    expect(combinedSource).toContain('Bun.which(command)')
    expect(combinedSource).not.toContain('test -x')
  })

  test('retired Whisper CoreML artifacts are reclaimable but no longer provisioned or recorded at runtime', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-retired-coreml-'))
    try {
      const coremlEnvDir = join(root, 'bin', 'whisper-coreml-env')
      const modelsDir = join(root, 'models')
      const compiledEncoder = join(modelsDir, 'ggml-tiny-encoder.mlmodelc')
      const packagedEncoder = join(modelsDir, 'ggml-base-encoder.mlpackage')
      await mkdir(coremlEnvDir, { recursive: true })
      await mkdir(compiledEncoder, { recursive: true })
      await mkdir(packagedEncoder, { recursive: true })
      await mkdir(join(modelsDir, 'not-an-encoder'), { recursive: true })
      await writeFile(join(coremlEnvDir, 'python'), 'legacy env')
      await writeFile(join(compiledEncoder, 'model.mil'), 'legacy compiled encoder')
      await writeFile(join(packagedEncoder, 'Manifest.json'), '{}')

      const artifacts = await collectReclaimableWhisperCoremlArtifacts({ coremlEnvDir, modelsDir })
      expect(artifacts.map(({ path }) => path)).toEqual([
        coremlEnvDir,
        packagedEncoder,
        compiledEncoder
      ])
      expect(artifacts.every(({ bytes }) => bytes > 0)).toBe(true)

      const whisperSource = await Bun.file('src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper.ts').text()
      const runtimeSource = await Bun.file('src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/run-whisper.ts').text()
      expect(whisperSource.toLowerCase()).not.toContain('coreml')
      expect(runtimeSource.toLowerCase()).not.toContain('coreml')
      expect(await Bun.file('src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper-scripts/convert-whisper-to-coreml.py').exists()).toBe(false)
      expect(await Bun.file('src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/whisper/whisper-scripts/validate-coreml.py').exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('Calibre setup only requires ebook-convert for ebook normalization', () => {
    const tools = [...CALIBRE_REQUIRED_TOOLS]
    expect(tools).toEqual(['ebook-convert'])
    expect(tools).not.toContain('calibre-debug')
    expect(tools).not.toContain('ebook-meta')
  })

  test('default Calibre metadata uses the official pinned download', async () => {
    const metadata = await readDependencyMetadata()

    expect(metadata['calibre']).toEqual({
      version: '9.9.0',
      url: 'https://download.calibre-ebook.com/9.9.0/calibre-9.9.0.dmg',
      sha256: '66cddba176f7a3d6f2932fe2e710f54898f01dff1d7532957124ce5c2fc22b36'
    })
  })

  test('Calibre setup remains serial and omits retired ACSM setup', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre.ts').text()
    const setupSource = source.slice(source.indexOf('export const setupCalibreDocumentTools'))

    // Deliberately serial: splitting this chain moved the calibre DMG into the
    // opening burst and cost more than the overlap saved, so a reintroduced
    // concurrent group here is a regression, not an optimization.
    expect(setupSource).toContain('await setupDocumentTools({ printCompletion: false })')
    expect(setupSource).not.toContain('runSettledSetupTasks')
    expect(setupSource.indexOf('await setupDocumentTools(')).toBeLessThan(setupSource.indexOf('await setupCalibreTools()'))
    expect(setupSource).not.toContain('setupAcsm')
    expect(setupSource).not.toContain('ACSM')
  })

  test('compact setup subprocess failures include a bounded output tail', async () => {
    setCompactSetupMode(true)
    try {
      try {
        await runInherit('bun', [
          '-e',
          'for (let i = 0; i < 80; i++) console.log(`stdout-line-${i}`); console.error("stderr-tail-line"); process.exit(7)'
        ])
        throw new Error('expected compact subprocess failure')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        expect(message).toContain('exit code 7')
        expect(message).toContain('stderr-tail-line')
        expect(message).toContain('stdout-line-79')
        expect(message).not.toContain('stdout-line-0')
      }
    } finally {
      setCompactSetupMode(false)
    }
  })

  test('concurrent setup tasks start independent tasks before the slowest task finishes', async () => {
    const events: string[] = []
    let releaseSlow!: () => void
    const slowTask = new Promise<void>((resolve) => { releaseSlow = resolve })

    const pending = runConcurrentSetupTasks([
      {
        label: 'slow',
        run: async () => {
          events.push('slow:start')
          await slowTask
          events.push('slow:done')
        }
      },
      {
        label: 'fast',
        run: async () => {
          events.push('fast:start')
        }
      }
    ])

    expect(events).toEqual(['slow:start', 'fast:start'])
    releaseSlow()
    await pending
    expect(events).toEqual(['slow:start', 'fast:start', 'slow:done'])
  })

  test('concurrent setup tasks wait for all tasks even when one fails', async () => {
    const events: string[] = []
    let releaseSlow!: () => void
    const slowTask = new Promise<void>((resolve) => { releaseSlow = resolve })
    const pending = runConcurrentSetupTasks([
      {
        label: 'failing',
        run: async () => {
          events.push('failing:start')
          throw new Error('boom')
        }
      },
      {
        label: 'slow',
        run: async () => {
          events.push('slow:start')
          await slowTask
          events.push('slow:done')
        }
      }
    ])
    let rejected = false
    void pending.catch(() => { rejected = true })

    await waitForTurn()
    expect(rejected).toBe(false)

    releaseSlow()
    await expect(pending).rejects.toThrow('Setup tasks failed')
    expect(events).toEqual(['failing:start', 'slow:start', 'slow:done'])
  })

  test('concurrent setup task failures include task labels', async () => {
    let message = ''
    try {
      await runConcurrentSetupTasks([
        {
          label: 'media tools',
          run: async () => { throw new Error('media failed') }
        },
        {
          label: 'OCR',
          run: async () => { throw new Error('ocr failed') }
        }
      ])
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toContain('media tools: media failed')
    expect(message).toContain('OCR: ocr failed')
  })

  test('the setup heartbeat reports every quiet task on one line', () => {
    const now = 600_000
    const line = formatSetupHeartbeatLine([
      { label: 'media tools', startedAtMs: now - 250_000, lastActivityAtMs: now - 250_000 },
      { label: 'OCR', startedAtMs: now - 90_000, lastActivityAtMs: now - 90_000 }
    ], now, 30_000)

    expect(line).toBe('Still running: media tools 4m 10s · OCR 1m 30s')
  })

  test('the setup heartbeat stays silent when every task logged recently', () => {
    const now = 600_000
    const line = formatSetupHeartbeatLine([
      { label: 'llama', startedAtMs: now - 250_000, lastActivityAtMs: now - 5_000 },
      { label: 'Whisper', startedAtMs: now - 120_000, lastActivityAtMs: now - 1_000 }
    ], now, 30_000)

    expect(line).toBeUndefined()
  })

  test('the setup heartbeat omits only the task that logged recently', () => {
    const now = 600_000
    const line = formatSetupHeartbeatLine([
      { label: 'llama', startedAtMs: now - 250_000, lastActivityAtMs: now - 2_000 },
      { label: 'media tools', startedAtMs: now - 250_000, lastActivityAtMs: now - 250_000 }
    ], now, 30_000)

    expect(line).toBe('Still running: media tools 4m 10s')
  })

  test('setup elapsed times switch to minutes instead of reporting 240.0s', () => {
    expect(formatSetupElapsed(900)).toBe('900ms')
    expect(formatSetupElapsed(45_600)).toBe('45.6s')
    expect(formatSetupElapsed(250_000)).toBe('4m 10s')
  })

  test('an empty build tree is not reported as reclaimed disk', () => {
    // `du -sk` charges an empty APFS directory 8 KiB for its own inode.
    expect(shouldReportReclaimedBuildTrees(8192)).toBe(false)
    expect(shouldReportReclaimedBuildTrees(64 * 1024 * 1024)).toBe(true)
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

  // `setup --step image` / `--step video` report credentials for a derived env-key
  // set. These pin the derivation to the provider registries, so a provider added
  // to `provider-targets.ts` cannot silently go unreported the way fal.ai did.
  for (const [step, targets, prefix] of [
    ['image', STANDALONE_IMAGE_PROVIDER_TARGETS, 'defaults.post.image.'],
    ['video', STANDALONE_VIDEO_PROVIDER_TARGETS, 'defaults.post.video.']
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
    ['tts', STANDALONE_TTS_PROVIDER_TARGETS, 'defaults.post.tts.', new Set<string>()],
    ['music', STANDALONE_MUSIC_PROVIDER_TARGETS, 'defaults.post.music.', new Set<string>()]
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
