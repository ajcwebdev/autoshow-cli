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

  test('setup --strict requires doctor mode before any setup work starts', async () => {
    const parsed = parseCommandInvocation(
      ['setup', '--strict'],
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

    expect(message).toContain('--strict requires --doctor')
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
      'src/cli/commands/text/ocr/ocr-local/tesseract-setup.ts'
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

  test('full setup installs only tiny and music setup selects small.en', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/run-complete-setup.ts').text()
    expect(source).toContain("const defaultMusicWhisperfileModel = 'small.en'")
    expect(source).toContain('await setupWhisperfile(DEFAULT_WHISPERFILE_MODEL)')
    expect(source).toContain('await setupWhisperfile(defaultMusicWhisperfileModel)')
    expect(source).toContain("{ label: 'OCR', run: setupTesseractOcr }")
    const all = await getForceRedownloadPaths('all')
    expect(all.filter(path => path.endsWith('.llamafile')).map(path => path.split('/').at(-1))).toEqual(['whisper-tiny.llamafile'])
    expect(await getForceRedownloadPaths('transcription')).toEqual(await getForceRedownloadPaths('whisperfile'))
    expect((await getForceRedownloadPaths('music')).map(path => path.split('/').at(-1))).toEqual(['whisper-small.en.llamafile'])
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

    expect(setupSource).toContain('await setupDocumentTools({ printCompletion: false })')
    expect(setupSource).not.toContain('runSettledSetupTasks')
    expect(setupSource.indexOf('await setupDocumentTools(')).toBeLessThan(setupSource.indexOf('await setupCalibreTools()'))
    expect(setupSource).not.toContain('setupAcsm')
    expect(setupSource).not.toContain('ACSM')
  })

  test('setup --show and setup --reset operate on config without installation', async () => {
    const showResult = await runCommand(['src/cli/create-cli.ts', 'setup', '--show'], {
      env: { NO_COLOR: '1' }
    })
    const showOutput = `${showResult.stdout}\n${showResult.stderr}`
    expect(showResult.exitCode).toBe(0)
    expect(showOutput).toContain('Config')
    expect(showOutput).not.toContain('Installing')
  })

  test('config alias routes to setup without error and bare config safe-exits', async () => {
    const bareConfigResult = await runCommand(['src/cli/create-cli.ts', 'config'], {
      env: { NO_COLOR: '1' }
    })
    const bareOutput = `${bareConfigResult.stdout}\n${bareConfigResult.stderr}`
    expect(bareConfigResult.exitCode).toBe(0)
    expect(bareOutput).toContain('No changes to write')
    expect(bareOutput).not.toContain('Installing')

    const configShowResult = await runCommand(['src/cli/create-cli.ts', 'config', '--show'], {
      env: { NO_COLOR: '1' }
    })
    const configShowOutput = `${configShowResult.stdout}\n${configShowResult.stderr}`
    expect(configShowResult.exitCode).toBe(0)
    expect(configShowOutput).toContain('Config')
  })
})
