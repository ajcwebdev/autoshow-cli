import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { runCommand } from '../../../test-utils/test-helpers'
import { rejectionMessage } from '../../../test-utils/cli-assertions'
import { requireDefined } from '../../../test-utils/value-assertions'
import { CALIBRE_REQUIRED_TOOLS } from '~/cli/commands/setup-and-utilities/setup/setup-download/dl-document/calibre'
import { readDependencyMetadata } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import {
  collectReclaimableWhisperCoremlArtifacts,
  getForceRedownloadPaths
} from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import {
  qpdfBuildDir,
  qpdfManagedBinaryPath,
  qpdfToolDir,
  resolveRuntimeToolInfo,
  ytDlpManagedBinaryPath
} from '~/utils/runtime-paths'

describe('setup command contracts', () => {
  test('setup rejects the retired ACSM step and omits retired steps from valid values', async () => {
    const parsed = parseCommandInvocation(
      ['setup', '--step', 'acsm'],
      setupCommand,
      GLOBAL_FLAG_DEFINITIONS
    )
    const command = requireDefined(parsed.command, 'parsed setup command')
    const message = await rejectionMessage(() => setupCommand.handler({
      argv: parsed.argv,
      command,
      flags: parsed.flags,
      parameters: parsed.parameters,
      rawParsed: parsed.rawParsed,
      store: {}
    }))
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
})
