import { chmod, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { runCommand } from '../../../test-utils/test-helpers'
import { CALIBRE_REQUIRED_TOOLS } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { readDependencyMetadata } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import {
  ACSM_STANDALONE_IMPORT_MODULES,
  buildAcsmAuthorizeWrapperScript,
  buildAcsmDeviceFilePreflightCode,
  buildAcsmFulfillWrapperScript,
  buildAcsmPythonPath,
  buildAcsmStandaloneImportCheckCode,
  patchAcsmPluginPython3Compatibility,
  runAcsmDeviceFilePreflight,
  runAcsmStandaloneImportPreflight
} from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/acsm'
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
import { collectReclaimableWhisperCoremlArtifacts, downloadKittenTtsModel, runConcurrentSetupTasks, runInherit, shouldReportReclaimedBuildTrees } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { formatSetupElapsed, formatSetupHeartbeatLine } from '~/cli/commands/setup-and-utilities/setup/setup-heartbeat'
import { setCompactSetupMode } from '~/utils/setup-output-mode'
import { resolveRuntimeToolInfo, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import type { AutoshowConfig, DoctorCheck, DoctorProbes, RunResult } from '~/types'
import {
  REVERB_ASR_REQUIRED_FILES,
  REVERB_DIARIZATION_REQUIRED_FILES
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'

const okRun = (stdout = ''): RunResult => ({ stdout, stderr: '', exitCode: 0 })

const runLocalCommand = async (
  command: string,
  args: string[],
  env: Record<string, string | undefined> = {}
): Promise<RunResult> => {
  const proc = Bun.spawn([command, ...args], {
    env: { ...(process.env as Record<string, string | undefined>), ...env },
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(''),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(''),
    proc.exited
  ])
  return { stdout, stderr, exitCode }
}

const resolvePythonForImportTest = async (): Promise<string | undefined> => {
  for (const candidate of ['python3', 'python']) {
    try {
      const result = await runLocalCommand(candidate, ['-c', 'import sys; print(sys.executable)'])
      if (result.exitCode === 0) return result.stdout.trim() || candidate
    } catch {
      // Optional local preflight coverage can only run when Python is available.
    }
  }
  return undefined
}

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
  hasSetupManagedLlamaModel: async () => true,
  readLlamaSetupModelMetadata: async () => ({
    version: 1,
    models: {
      'ggml-org/gemma-3-270m-it-GGUF': {
        requestedModel: 'ggml-org/gemma-3-270m-it-GGUF',
        repo: 'ggml-org/gemma-3-270m-it-GGUF',
        downloadedAt: '2026-01-01T00:00:00.000Z'
      }
    }
  }),
  listLlamaCacheEntries: async () => ['/cache/llama.cpp/ggml-org_gemma-3-270m-it-GGUF_Q8_0.gguf'],
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
  test('setup usage contracts include the defuddle step', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--step', 'not-real'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('defuddle')
  })

  test('setup usage lists the whisperfile and llamafile steps as valid', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--step', 'not-real'], {
      env: { NO_COLOR: '1' }
    })

    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(2)
    expect(output).toContain('whisperfile')
    expect(output).toContain('llamafile')
  })

  test('setup usage lists ACSM setup and authorization as valid focused setup steps', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--step', 'not-real'], {
      env: { NO_COLOR: '1' }
    })

    const output = `${result.stdout}\n${result.stderr}`
    expect(result.exitCode).toBe(2)
    expect(output).toContain('acsm')
    expect(output).toContain('acsm-authorize')
  })

  test('setup --models rejects an unknown whisperfile model before downloading', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--models', 'whisperfile:bogus'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('Invalid model "bogus" for --provider/--stt whisperfile[=model]')
  })

  test('setup --models rejects an unknown llamafile bundle before downloading', async () => {
    const result = await runCommand(['src/cli/create-cli.ts', 'setup', '--models', 'llamafile:bogus'], {
      env: { NO_COLOR: '1' }
    })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('Unknown llamafile model')
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

  test('local runtime wrappers use the committed helper scripts directories', async () => {
    const checks = [
      {
        sourcePath: 'src/cli/commands/process-steps/step-4-tts/tts-local/kitten/run-kitten-tts.ts',
        expectedSource: 'kitten-scripts/run-kitten-tts.py',
        scriptPaths: [
          'src/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-scripts/run-kitten-tts.py'
        ]
      },
      {
        sourcePath: 'src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/run-reverb-diarization.ts',
        expectedSource: 'reverb-scripts',
        scriptPaths: [
          'src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-scripts/reverb-diarization.py',
          'src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-scripts/assign-words-to-speakers.py'
        ]
      }
    ]

    for (const check of checks) {
      const source = await Bun.file(check.sourcePath).text()
      expect(source).toContain(check.expectedSource)
      for (const scriptPath of check.scriptPaths) {
        expect(await Bun.file(scriptPath).exists()).toBe(true)
      }
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

  test('Calibre setup defers broad document completion until ACSM setup finishes', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre.ts').text()
    const setupSource = source.slice(source.indexOf('export const setupCalibreDocumentTools'))

    // Deliberately serial: splitting this chain moved the calibre DMG into the
    // opening burst and cost more than the overlap saved, so a reintroduced
    // concurrent group here is a regression, not an optimization.
    expect(setupSource).toContain('await setupDocumentTools({ printCompletion: false })')
    expect(setupSource).not.toContain('runSettledSetupTasks')
    expect(setupSource.indexOf('await setupDocumentTools(')).toBeLessThan(setupSource.indexOf('await setupCalibreTools()'))
    expect(setupSource.indexOf('await setupCalibreTools()')).toBeLessThan(setupSource.indexOf('await setupAcsmFulfillment('))
    expect(setupSource.indexOf('await setupAcsmFulfillment(')).toBeLessThan(setupSource.indexOf("l.write('success', 'Document foundation tools and ACSM fulfillment setup complete')"))
  })

  test('ACSM fulfill setup wrapper produces exactly one EPUB or PDF output without leaking subprocess logs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-acsm-wrapper-'))
    try {
      const pluginDir = join(root, 'plugin')
      const accountDir = join(root, 'account')
      const outputDir = join(root, 'out')
      const inputPath = join(root, 'book.acsm')
      const fakePython = join(root, 'python')
      const wrapperPath = join(root, 'calibre-acsm-fulfill')

      await mkdir(pluginDir, { recursive: true })
      await mkdir(accountDir, { recursive: true })
      await writeFile(join(pluginDir, 'fulfill.py'), '# placeholder\n')
      await writeFile(join(accountDir, 'activation.xml'), '<activation />')
      await writeFile(join(accountDir, 'device.xml'), '<device />')
      await writeFile(join(accountDir, 'devicesalt'), 'salt')
      await writeFile(inputPath, '<adept:fulfillmentToken />')
      await writeFile(fakePython, '#!/bin/sh\nif [ ! -f "$2" ]; then echo "missing input $2" >&2; exit 12; fi\necho "secret activation path /tmp/private/account" >&2\nprintf "epub" > fulfilled.epub\n')
      await chmod(fakePython, 0o755)
      await writeFile(wrapperPath, buildAcsmFulfillWrapperScript({
        pluginDir,
        accountDir,
        pythonPath: fakePython
      }))
      await chmod(wrapperPath, 0o755)

      const result = await runLocalCommand(wrapperPath, [relative(process.cwd(), inputPath), outputDir])

      expect(result.exitCode).toBe(0)
      expect(`${result.stdout}\n${result.stderr}`).not.toContain('/tmp/private/account')
      expect(await readdir(outputDir)).toEqual(['fulfilled.epub'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('ACSM fulfill setup wrapper reports missing input before setup or authorization checks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-acsm-wrapper-missing-input-'))
    try {
      const pluginDir = join(root, 'plugin')
      const accountDir = join(root, 'account')
      const outputDir = join(root, 'out')
      const fakePython = join(root, 'python')
      const wrapperPath = join(root, 'calibre-acsm-fulfill')

      await mkdir(pluginDir, { recursive: true })
      await mkdir(accountDir, { recursive: true })
      await writeFile(fakePython, '#!/bin/sh\nexit 99\n')
      await chmod(fakePython, 0o755)
      await writeFile(wrapperPath, buildAcsmFulfillWrapperScript({
        pluginDir,
        accountDir,
        pythonPath: fakePython
      }))
      await chmod(wrapperPath, 0o755)

      const result = await runLocalCommand(wrapperPath, [join(root, 'missing.acsm'), outputDir])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('ACSM input file was not found')
      expect(result.stderr).not.toContain('ACSM fulfillment is not authorized')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('ACSM fulfill setup wrapper fails clearly before fulfillment when authorization files are missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-acsm-wrapper-missing-auth-'))
    try {
      const pluginDir = join(root, 'plugin')
      const accountDir = join(root, 'account')
      const outputDir = join(root, 'out')
      const inputPath = join(root, 'book.acsm')
      const fakePython = join(root, 'python')
      const wrapperPath = join(root, 'calibre-acsm-fulfill')

      await mkdir(pluginDir, { recursive: true })
      await mkdir(accountDir, { recursive: true })
      await writeFile(join(pluginDir, 'fulfill.py'), '# placeholder\n')
      await writeFile(inputPath, '<adept:fulfillmentToken />')
      await writeFile(fakePython, '#!/bin/sh\nprintf "epub" > fulfilled.epub\n')
      await chmod(fakePython, 0o755)
      await writeFile(wrapperPath, buildAcsmFulfillWrapperScript({
        pluginDir,
        accountDir,
        pythonPath: fakePython
      }))
      await chmod(wrapperPath, 0o755)

      const result = await runLocalCommand(wrapperPath, [inputPath, outputDir])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('ACSM fulfillment is not authorized')
      expect(result.stderr).toContain('calibre-acsm-authorize')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('ACSM generated wrappers use nested plugin ZIP package paths', () => {
    const paths = {
      pluginDir: '/runtime/tools/acsm-calibre-plugin/plugin',
      accountDir: '/runtime/tools/acsm-calibre-plugin/account',
      pythonPath: '/runtime/tools/acsm-calibre-plugin/venv/bin/python'
    }
    const expectedPythonPath = 'export PYTHONPATH="$plugin_dir/asn1crypto.zip/asn1crypto:$plugin_dir/oscrypto.zip/oscrypto:$plugin_dir${PYTHONPATH:+:$PYTHONPATH}"'
    const fulfillScript = buildAcsmFulfillWrapperScript(paths)
    const authorizeScript = buildAcsmAuthorizeWrapperScript(paths)

    expect(fulfillScript).toContain(expectedPythonPath)
    expect(authorizeScript).toContain(expectedPythonPath)
    expect(fulfillScript).not.toContain('$plugin_dir/asn1crypto.zip:$plugin_dir/oscrypto.zip:$plugin_dir')
    expect(authorizeScript).not.toContain('$plugin_dir/asn1crypto.zip:$plugin_dir/oscrypto.zip:$plugin_dir')
  })

  test('ACSM standalone import preflight uses the generated nested Python path without network access', async () => {
    const pythonPath = await resolvePythonForImportTest()
    if (!pythonPath) return

    expect([...ACSM_STANDALONE_IMPORT_MODULES]).toEqual(['libadobe', 'libadobeAccount', 'libadobeFulfill', 'fulfill'])

    const root = await mkdtemp(join(tmpdir(), 'autoshow-acsm-import-preflight-'))
    try {
      const pluginDir = join(root, 'plugin')
      const asn1OuterDir = join(pluginDir, 'asn1crypto.zip', 'asn1crypto')
      const asn1PackageDir = join(asn1OuterDir, 'asn1crypto')
      const oscryptoOuterDir = join(pluginDir, 'oscrypto.zip', 'oscrypto')
      const oscryptoPackageDir = join(oscryptoOuterDir, 'oscrypto')

      await mkdir(asn1PackageDir, { recursive: true })
      await mkdir(oscryptoPackageDir, { recursive: true })
      await writeFile(join(asn1OuterDir, '__init__.py'), '# outer package marker\n')
      await writeFile(join(asn1PackageDir, '__init__.py'), '# nested asn1crypto package\n')
      await writeFile(join(oscryptoOuterDir, '__init__.py'), '# outer package marker\n')
      await writeFile(join(oscryptoPackageDir, '__init__.py'), '# nested oscrypto package\n')
      await writeFile(join(oscryptoPackageDir, 'keys.py'), 'VALUE = "keys"\n')
      await writeFile(join(pluginDir, 'libadobe.py'), 'import oscrypto.keys\n')
      await writeFile(join(pluginDir, 'libadobeAccount.py'), 'import libadobe\n')
      await writeFile(join(pluginDir, 'libadobeFulfill.py'), 'import libadobe\n')
      await writeFile(join(pluginDir, 'fulfill.py'), 'import libadobeAccount\nimport libadobeFulfill\n')

      const oldRootPythonPath = `${pluginDir}/asn1crypto.zip:${pluginDir}/oscrypto.zip:${pluginDir}`
      const oldResult = await runLocalCommand(pythonPath, ['-c', buildAcsmStandaloneImportCheckCode()], {
        PYTHONPATH: oldRootPythonPath
      })

      expect(oldResult.exitCode).not.toBe(0)
      expect(`${oldResult.stdout}\n${oldResult.stderr}`).toContain('oscrypto.keys')
      expect(buildAcsmPythonPath(pluginDir)).toBe(`${pluginDir}/asn1crypto.zip/asn1crypto:${pluginDir}/oscrypto.zip/oscrypto:${pluginDir}`)
      await expect(runAcsmStandaloneImportPreflight({ pluginDir, pythonPath })).resolves.toBeUndefined()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('ACSM setup patches Python 3 serial and fingerprint text before device-file preflight', async () => {
    const pythonPath = await resolvePythonForImportTest()
    if (!pythonPath) return

    const root = await mkdtemp(join(tmpdir(), 'autoshow-acsm-python3-patch-'))
    try {
      const pluginDir = join(root, 'plugin')
      await mkdir(pluginDir, { recursive: true })
      await writeFile(join(pluginDir, 'libadobe.py'), [
        'import base64, hashlib',
        'class Random:',
        '    @staticmethod',
        '    def get_random_bytes(size):',
        '        return b"\\x01" * size',
        'devkey_bytes = None',
        'FILE_DEVICEKEY = "devicesalt"',
        'def createDeviceKeyFile():',
        '    global devkey_bytes',
        '    devkey_bytes = Random.get_random_bytes(16)',
        '    with open(FILE_DEVICEKEY, "wb") as f:',
        '        f.write(devkey_bytes)',
        'def makeSerial(random):',
        '    sha_out = None',
        '    if not random:',
        '        sha_out = "fixed"',
        '    else:',
        '        import binascii',
        '        sha_out = binascii.hexlify(Random.get_random_bytes(20)).lower()',
        '    return sha_out',
        'def makeFingerprint(serial):',
        '    global devkey_bytes',
        '    if devkey_bytes is None:',
        '        f = open(FILE_DEVICEKEY, "rb")',
        '        devkey_bytes = f.read()',
        '        f.close()',
        "    str_to_hash = serial + devkey_bytes.decode('latin-1')",
        "    hashed_str = hashlib.sha1(str_to_hash.encode('latin-1')).digest()",
        '    b64str = base64.b64encode(hashed_str)',
        '',
        '    return b64str'
      ].join('\n'))
      await writeFile(join(pluginDir, 'libadobeAccount.py'), [
        'from libadobe import makeFingerprint, makeSerial',
        'def createDeviceFile(randomSerial, useVersionIndex = 0):',
        '    serial = makeSerial(randomSerial)',
        '    fingerprint = makeFingerprint(serial)',
        '    assert isinstance(serial, str), type(serial).__name__',
        '    assert isinstance(fingerprint, str), type(fingerprint).__name__',
        '    with open("device.xml", "w") as f:',
        '        f.write(serial + fingerprint)',
        '    return True'
      ].join('\n'))

      await patchAcsmPluginPython3Compatibility(pluginDir)
      await patchAcsmPluginPython3Compatibility(pluginDir)
      const patched = await Bun.file(join(pluginDir, 'libadobe.py')).text()

      expect(patched).toContain("decode('latin-1').lower()")
      expect(patched).toContain("return b64str.decode('latin-1')")
      expect(patched).not.toContain("decode('latin-1').decode('latin-1')")
      expect(patched.match(/if isinstance\(serial, bytes\)/g)?.length).toBe(1)
      expect(buildAcsmDeviceFilePreflightCode()).toContain('createDeviceFile(True, 1)')
      await expect(runAcsmDeviceFilePreflight({ pluginDir, pythonPath })).resolves.toBeUndefined()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('ACSM authorize wrapper points at the standalone registration script', () => {
    const script = buildAcsmAuthorizeWrapperScript({
      pluginDir: '/runtime/tools/acsm-calibre-plugin/plugin',
      accountDir: '/runtime/tools/acsm-calibre-plugin/account',
      pythonPath: '/runtime/tools/acsm-calibre-plugin/venv/bin/python'
    })

    expect(script).toContain('calibre-acsm-authorize AutoShow wrapper')
    expect(script).toContain('register_ADE_account.py')
    expect(script).toContain('AUTOSHOW_ACSM_ACCOUNT_DIR')
  })

  test('ACSM authorization is integrated as an explicit setup step', async () => {
    const [setupSource, runSource] = await Promise.all([
      Bun.file('src/cli/commands/setup-and-utilities/setup/define-setup-command.ts').text(),
      Bun.file('src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts').text()
    ])

    expect(setupSource).toContain("'acsm-authorize'")
    expect(setupSource).toContain('Authorize ACSM fulfillment interactively')
    expect(runSource).toContain("case 'acsm-authorize': await runAcsmAuthorization(); return")
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

  test('Kitten TTS model setup fails when the model load command fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-kitten-model-'))
    try {
      const fakePython = join(dir, 'python')
      await writeFile(fakePython, '#!/bin/sh\necho kitten-load-stdout\necho kitten-load-stderr >&2\nexit 9\n')
      await chmod(fakePython, 0o755)

      await expect(downloadKittenTtsModel('kitten-tts-test', { pythonPath: fakePython }))
        .rejects.toThrow(/Kitten TTS model download failed.*kitten-load-stderr/s)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('doctor reports missing managed runtimes and local model assets', async () => {
    const missingPathFragments = [
      '/runtime/bin/whisper-cli',
      '/runtime/bin/llama-server',
      'ggml-tiny.bin',
      'ggml-large-v3-turbo.bin',
      ...REVERB_ASR_REQUIRED_FILES,
      ...REVERB_DIARIZATION_REQUIRED_FILES,
      'kitten-tts/bin/python'
    ]
    const report = await collectDoctorReport(makeDoctorProbes({
      pathExists: async (path) => !missingPathFragments.some(fragment => path.includes(fragment)),
      hasSetupManagedLlamaModel: async () => false,
      readLlamaSetupModelMetadata: async () => ({ version: 1, models: {} }),
      listLlamaCacheEntries: async () => []
    }))

    expect(findDoctorCheck(report, 'runtime/bin/whisper-cli').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'runtime/bin/llama-server').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'default whisper model tiny').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'music whisper model large-v3-turbo').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'music whisper model large-v3-turbo').nextStep).toBe('bun autoshow setup')
    expect(findDoctorCheck(report, 'Reverb ASR files').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'Reverb ASR files').detail).toContain('en-cmvn.json')
    expect(findDoctorCheck(report, 'Reverb diarization cache').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'Kitten TTS Python env').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'llama model ggml-org/gemma-3-270m-it-GGUF').status).toBe('MISSING')
    expect(report.nextSteps).toContain('bun autoshow setup --step whisper-binary')
    expect(report.nextSteps).toContain('bun autoshow setup --step llama-binary')
  })

  test('doctor reports managed macOS media document and OCR tool readiness', async () => {
    const missingPathFragments = [
      'runtime/bin/yt-dlp',
      'runtime/bin/ffmpeg',
      'runtime/bin/ffprobe',
      'runtime/bin/mutool',
      'runtime/bin/ebook-convert',
      'runtime/bin/calibre-acsm-fulfill',
      'runtime/bin/tesseract',
      'runtime/tools/tessdata/eng.traineddata'
    ]
    const report = await collectDoctorReport(makeDoctorProbes({
      pathExists: async (path) => !missingPathFragments.some(fragment => path.includes(fragment)),
      which: (command) => command === 'calibre-acsm-fulfill' ? undefined : `/usr/bin/${command}`
    }))

    expect(findDoctorCheck(report, 'yt-dlp').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'ffmpeg').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'ffprobe').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'mutool').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'ebook-convert').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'calibre-acsm-fulfill').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'tesseract').status).toBe('MISSING')
    expect(findDoctorCheck(report, 'Tesseract eng data').status).toBe('MISSING')
    expect(report.nextSteps).toContain('bun autoshow setup --step yt-dlp')
    expect(report.nextSteps).toContain('bun autoshow setup --step calibre')
    expect(report.nextSteps).toContain('bun autoshow setup --step acsm')
    expect(report.nextSteps).toContain('bun autoshow setup')
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

  test('doctor Reverb next step is runnable when Hugging Face token is already set', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      env: { HUGGINGFACE_TOKEN: 'hf_test' },
      pathExists: async (path) =>
        !path.includes('/runtime/bin/reverb/')
        && !REVERB_ASR_REQUIRED_FILES.some(file => path.includes(file))
        && !REVERB_DIARIZATION_REQUIRED_FILES.some(file => path.includes(file))
    }))

    expect(findDoctorCheck(report, 'Reverb Python env').nextStep).toBe('bun autoshow setup --step reverb')
    expect(findDoctorCheck(report, 'Reverb ASR files').nextStep).toBe('bun autoshow setup --step reverb')
    expect(findDoctorCheck(report, 'Reverb diarization cache').nextStep).toBe('bun autoshow setup --step reverb')
    expect(report.nextSteps).toContain('bun autoshow setup --step reverb')
    expect(report.nextSteps.join('\n')).not.toContain('HUGGINGFACE_TOKEN=')
  })

  test('doctor Reverb next step asks for token before setup when token is absent', async () => {
    const report = await collectDoctorReport(makeDoctorProbes({
      env: {},
      pathExists: async (path) =>
        !path.includes('/runtime/bin/reverb/')
        && !REVERB_ASR_REQUIRED_FILES.some(file => path.includes(file))
        && !REVERB_DIARIZATION_REQUIRED_FILES.some(file => path.includes(file))
    }))

    expect(findDoctorCheck(report, 'Reverb ASR files').nextStep)
      .toBe('set HUGGINGFACE_TOKEN, then run bun autoshow setup --step reverb')
    expect(report.nextSteps).toContain('set HUGGINGFACE_TOKEN, then run bun autoshow setup --step reverb')
    expect(report.nextSteps.join('\n')).not.toContain('REDACTED')
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

  test('doctor warns when a configured local runtime is broken', async () => {
    const config: AutoshowConfig = {
      defaults: {
        post: {
          tts: {
            kittenTts: ['kitten-tts-mini']
          }
        }
      }
    }
    const report = await collectDoctorReport(makeDoctorProbes({
      loadConfig: async () => config,
      run: async (command, args) => {
        if (command.includes('kitten-tts/bin/python') && args.join(' ').includes('kittentts')) {
          return { stdout: '', stderr: 'No module named kittentts', exitCode: 1 }
        }
        if (command.includes('tesseract') && args.includes('--list-langs')) return okRun('eng\n')
        if (command.includes('ffmpeg') && args.includes('-filters')) return okRun(' ... ass\n')
        return okRun('ok')
      }
    }))
    const kitten = findDoctorCheck(report, 'Kitten TTS Python env')

    expect(kitten.status).toBe('WARN')
    expect(kitten.nextStep).toBe('bun autoshow setup --step tts')
    expect(report.hasWarnings).toBe(true)
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
  test.each([
    ['image', STANDALONE_IMAGE_PROVIDER_TARGETS, 'defaults.post.image.'],
    ['video', STANDALONE_VIDEO_PROVIDER_TARGETS, 'defaults.post.video.']
  ] as const)('%s setup env keys are derived from every registered provider', (_step, targets, prefix) => {
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

  test('transcription setup env keys cover registered engines with explicit local exceptions', () => {
    const prefix = 'defaults.extract.stt.'
    const configPathOverrides: Readonly<Record<string, string>> = {
      'reverb-stt': `${prefix}reverb`
    }
    const enginesWithoutHostedCredentials = new Set<string>([
      'whisper-stt',
      'whisperfile-stt'
    ])
    const expected = new Set<string>()
    const unmapped: string[] = []

    for (const target of Object.values(WRITE_STT_PROVIDER_TARGETS)) {
      if (enginesWithoutHostedCredentials.has(target)) continue
      const suffix = target.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
      const configPath = configPathOverrides[target] ?? `${prefix}${suffix}`
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

  test.each([
    ['write', WRITE_LLM_PROVIDER_TARGETS, 'defaults.llm.', new Set<string>(['llama', 'llamafile'])],
    ['tts', STANDALONE_TTS_PROVIDER_TARGETS, 'defaults.post.tts.', new Set<string>(['kitten-tts'])],
    ['music', STANDALONE_MUSIC_PROVIDER_TARGETS, 'defaults.post.music.', new Set<string>()]
  ] as const)('%s setup env keys cover registered providers with explicit local exclusions', (_step, targets, prefix, localTargets) => {
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
      'X_BEARER_TOKEN',
      'HUGGINGFACE_TOKEN'
    ]))
  })
})
