import { cp, mkdir, rm, symlink } from 'node:fs/promises'
import { cpus } from 'node:os'
import { dirname, join } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { pathExists, runCapture, runInherit } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { installDmgApp } from '~/cli/commands/setup-and-utilities/setup/setup-download/dmg'
import { recordSetupPerformancePhase } from '~/cli/commands/setup-and-utilities/setup/setup-performance'
import type { DownloadFlowId } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { makeExecutable } from '~/utils/filesystem'
import {
  ebookConvertInstalledBinaryPath,
  ebookConvertManagedBinaryPath,
  englishTrainedDataPath,
  ffmpegBuildDir,
  ffmpegInstalledBinaryPath,
  ffmpegManagedBinaryPath,
  ffmpegToolDir,
  ffprobeInstalledBinaryPath,
  ffprobeManagedBinaryPath,
  lameBuildDir,
  lameToolDir,
  leptonicaBuildDir,
  leptonicaToolDir,
  mupdfBuildDir,
  mupdfToolDir,
  mutoolInstalledBinaryPath,
  mutoolManagedBinaryPath,
  qpdfBuildDir,
  qpdfInstalledBinaryPath,
  qpdfManagedBinaryPath,
  qpdfToolDir,
  resolveTessdataPrefix,
  calibreAppPath,
  tessdataDir,
  tesseractBuildDir,
  tesseractInstalledBinaryPath,
  tesseractManagedBinaryPath,
  tesseractToolDir,
  tessdataBatchConfigPath,
  tessdataHocrConfigPath,
  ytDlpManagedBinaryPath
} from '~/utils/runtime-paths'

export const resolveSetupSourceBuildParallelJobs = (): number => Math.max(1, Math.min(cpus().length, 8))
const leptonicaCmakeConfigDir = join(leptonicaToolDir, 'lib/cmake/leptonica')
const leptonicaCmakeConfigPath = join(leptonicaCmakeConfigDir, 'LeptonicaConfig.cmake')
const leptonicaManagedBuildStampPath = join(leptonicaToolDir, '.autoshow-managed-build')
const tesseractInstalledTessdataDir = join(tesseractToolDir, 'share/tessdata')
const managedTessdataSupportDirs = ['configs', 'tessconfigs'] as const

const ensureParentDir = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
}

const recreateDir = async (path: string): Promise<void> => {
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
}

const createSymlinkShim = async (target: string, linkPath: string): Promise<void> => {
  await ensureParentDir(linkPath)
  await rm(linkPath, { recursive: true, force: true })
  await symlink(target, linkPath)
}

const writeExecutableScript = async (path: string, content: string): Promise<void> => {
  await ensureParentDir(path)
  await Bun.write(path, content)
  await makeExecutable(path)
}

export const buildManagedQpdfWrapperScript = (
  installedBinaryPath = qpdfInstalledBinaryPath,
  libraryDir = join(qpdfToolDir, 'lib')
): string => `#!/bin/sh
export DYLD_LIBRARY_PATH="${libraryDir}:\${DYLD_LIBRARY_PATH:-}"
exec "${installedBinaryPath}" "$@"
`

const cleanupFailedManagedQpdfInstall = async (): Promise<void> => {
  await rm(qpdfManagedBinaryPath, { recursive: true, force: true })
  await rm(qpdfToolDir, { recursive: true, force: true })
}

const hasManagedLeptonicaBuild = async (): Promise<boolean> =>
  await pathExists(leptonicaCmakeConfigPath) && await pathExists(leptonicaManagedBuildStampPath)

const managedPathEnv = (extra: string[] = []): Record<string, string | undefined> => ({
  PATH: [...extra, process.env['PATH'] ?? ''].filter(Boolean).join(':'),
  PKG_CONFIG_PATH: [
    join(leptonicaToolDir, 'lib/pkgconfig'),
    join(qpdfToolDir, 'lib/pkgconfig')
  ].filter(Boolean).join(':'),
  LDFLAGS: [
    `-L${join(leptonicaToolDir, 'lib')}`,
    `-L${join(qpdfToolDir, 'lib')}`
  ].filter(Boolean).join(' '),
  CPPFLAGS: [
    `-I${join(leptonicaToolDir, 'include')}`,
    `-I${join(qpdfToolDir, 'include')}`
  ].filter(Boolean).join(' '),
  DYLD_LIBRARY_PATH: [
    join(leptonicaToolDir, 'lib'),
    join(tesseractToolDir, 'lib'),
    join(qpdfToolDir, 'lib')
  ].filter(Boolean).join(':')
})

const sourceStampPath = (buildDir: string): string => join(buildDir, '.autoshow-source-sha256')

const hasExtractedSource = async (buildDir: string, sha256: string): Promise<boolean> => {
  const stamp = sourceStampPath(buildDir)
  if (!await pathExists(stamp)) return false
  return (await Bun.file(stamp).text()).trim() === sha256
}

const downloadSource = async (
  name: string,
  buildDir: string,
  flowId: DownloadFlowId,
  mode: 'tar-gz' | 'tar-xz'
): Promise<void> => {
  const { url, sha256 } = await readDependencyUrlAndSha256(name)
  // A build that fails after extraction used to re-download the tarball on every
  // retry, because recreateDir wiped the already-verified source tree first.
  const sourceCached = await hasExtractedSource(buildDir, sha256)
  await recordSetupPerformancePhase(name, 'archive-preparation', async () => {
    if (sourceCached) return

    await recreateDir(buildDir)
    await downloadFile({
      url,
      sha256,
      destination: buildDir,
      flowId,
      mode,
      stripComponents: 1
    })
    await Bun.write(sourceStampPath(buildDir), `${sha256}\n`)
  }, { sourceCached })
}

// Source and object trees are inputs to the installed artifacts under
// runtime/tools; once an install validates, keeping them only costs disk.
export const discardBuildTree = async (buildDir: string): Promise<void> => {
  await rm(buildDir, { recursive: true, force: true })
}

export const installManagedYtDlpMacos = async (): Promise<void> => {
  if (await pathExists(ytDlpManagedBinaryPath)) return
  const { url, sha256 } = await readDependencyUrlAndSha256('yt-dlp')
  await ensureParentDir(ytDlpManagedBinaryPath)
  await downloadFile({
    url,
    sha256,
    destination: ytDlpManagedBinaryPath,
    flowId: 'yt-dlp-binary'
  })
  await makeExecutable(ytDlpManagedBinaryPath)
}

const lameStaticLibPath = join(lameToolDir, 'lib/libmp3lame.a')

export const installManagedLameMacos = async (): Promise<void> => {
  if (await pathExists(lameStaticLibPath)) return
  await downloadSource('lame', lameBuildDir, 'lame-source', 'tar-gz')
  await recreateDir(lameToolDir)
  await recordSetupPerformancePhase('lame', 'configure-generate', async () => {
    await runInherit('./configure', [
      `--prefix=${lameToolDir}`,
      '--disable-shared',
      '--enable-static',
      '--disable-frontend',
      '--disable-gtktest',
      '--disable-debug'
    ], { cwd: lameBuildDir })
  })
  const jobs = resolveSetupSourceBuildParallelJobs()
  await recordSetupPerformancePhase('lame', 'compile-link', async () => {
    await runInherit('make', ['-j', String(jobs)], { cwd: lameBuildDir })
  }, { parallelJobs: jobs })
  await recordSetupPerformancePhase('lame', 'install-promote', async () => {
    await runInherit('make', ['install'], { cwd: lameBuildDir })
  })
  await recordSetupPerformancePhase('lame', 'cleanup', async () => {
    await discardBuildTree(lameBuildDir)
  })
}

const ffmpegManagedBuildStampPath = join(ffmpegToolDir, '.autoshow-managed-build')
const ffmpegManagedBuildStamp = 'ffmpeg-libmp3lame-v1\n'

export const hasManagedFfmpegBuild = async (): Promise<boolean> => {
  if (!await pathExists(ffmpegManagedBinaryPath) || !await pathExists(ffprobeManagedBinaryPath)) return false
  if (!await pathExists(ffmpegManagedBuildStampPath)) return false
  return (await Bun.file(ffmpegManagedBuildStampPath).text()) === ffmpegManagedBuildStamp
}

export const installManagedFfmpegMacos = async (): Promise<void> => {
  if (await hasManagedFfmpegBuild()) return
  await installManagedLameMacos()
  await downloadSource('ffmpeg', ffmpegBuildDir, 'ffmpeg-source', 'tar-xz')
  await recreateDir(ffmpegToolDir)
  await recordSetupPerformancePhase('ffmpeg', 'configure-generate', async () => {
    await runInherit('./configure', [
      `--prefix=${ffmpegToolDir}`,
      '--disable-doc',
      '--disable-debug',
      '--enable-libmp3lame',
      `--extra-cflags=-I${join(lameToolDir, 'include')}`,
      `--extra-ldflags=-L${join(lameToolDir, 'lib')}`
    ], { cwd: ffmpegBuildDir })
  })
  const jobs = resolveSetupSourceBuildParallelJobs()
  await recordSetupPerformancePhase('ffmpeg', 'compile-link', async () => {
    await runInherit('make', ['-j', String(jobs)], { cwd: ffmpegBuildDir })
  }, { parallelJobs: jobs })
  await recordSetupPerformancePhase('ffmpeg', 'install-promote', async () => {
    await runInherit('make', ['install'], { cwd: ffmpegBuildDir })
    await createSymlinkShim(ffmpegInstalledBinaryPath, ffmpegManagedBinaryPath)
    await createSymlinkShim(ffprobeInstalledBinaryPath, ffprobeManagedBinaryPath)
  })
  await recordSetupPerformancePhase('ffmpeg', 'health-check', async () => {
    const encoders = await runCapture(ffmpegInstalledBinaryPath, ['-hide_banner', '-encoders'], { allowFailure: true })
    if (encoders.exitCode !== 0 || !encoders.stdout.includes('libmp3lame')) {
      throw InfraError('Managed ffmpeg build is missing the libmp3lame encoder', { stage: 'setup:macos-tools' })
    }
    await Bun.write(ffmpegManagedBuildStampPath, ffmpegManagedBuildStamp)
  })
  await recordSetupPerformancePhase('ffmpeg', 'cleanup', async () => {
    await discardBuildTree(ffmpegBuildDir)
  })
}

export const installManagedMupdfMacos = async (): Promise<void> => {
  if (await pathExists(mutoolManagedBinaryPath)) return
  await downloadSource('mupdf', mupdfBuildDir, 'mupdf-source', 'tar-gz')
  await recordSetupPerformancePhase('mupdf', 'configure-generate', async () => {
    await recreateDir(join(mupdfToolDir, 'bin'))
  })
  const jobs = resolveSetupSourceBuildParallelJobs()
  await recordSetupPerformancePhase('mupdf', 'compile-link', async () => {
    await runInherit('make', [
      '-j', String(jobs),
      'build=release',
      'HAVE_X11=no',
      'HAVE_GLUT=no',
      'HAVE_OBJCOPY=no'
    ], { cwd: mupdfBuildDir })
  }, { parallelJobs: jobs })
  await recordSetupPerformancePhase('mupdf', 'install-promote', async () => {
    const builtMutool = join(mupdfBuildDir, 'build/release/mutool')
    await cp(builtMutool, mutoolInstalledBinaryPath)
    await makeExecutable(mutoolInstalledBinaryPath)
    await createSymlinkShim(mutoolInstalledBinaryPath, mutoolManagedBinaryPath)
  })
  await recordSetupPerformancePhase('mupdf', 'health-check', async () => {
    const version = await runCapture(mutoolManagedBinaryPath, ['-v'], { allowFailure: true })
    if (version.exitCode !== 0 && version.exitCode !== 1) {
      throw InfraError(`Managed mutool failed with exit ${version.exitCode}`, { stage: 'setup:macos-tools' })
    }
  })
  await recordSetupPerformancePhase('mupdf', 'cleanup', async () => {
    await discardBuildTree(mupdfBuildDir)
  })
}

export const installManagedCalibreMacos = async (): Promise<void> => {
  if (await pathExists(ebookConvertManagedBinaryPath)) return
  const { url, sha256 } = await readDependencyUrlAndSha256('calibre')
  await installDmgApp({
    url,
    sha256,
    appName: 'calibre.app',
    destinationAppPath: calibreAppPath
  })
  await writeExecutableScript(ebookConvertManagedBinaryPath, `#!/bin/sh
exec "${ebookConvertInstalledBinaryPath}" "$@"
`)
}

export const installManagedTessdataEng = async (): Promise<void> => {
  if (!await pathExists(englishTrainedDataPath)) {
    const { url, sha256 } = await readDependencyUrlAndSha256('tessdataEng')
    await mkdir(tessdataDir, { recursive: true })
    await downloadFile({
      url,
      sha256,
      destination: englishTrainedDataPath,
      flowId: 'tessdata',
      expectedMinBytes: 1_000_000
    })
  }

  await ensureManagedTessdataSupportFiles()
}

export const ensureManagedTessdataSupportFiles = async (): Promise<void> => {
  if (
    await pathExists(tessdataHocrConfigPath) &&
    await pathExists(tessdataBatchConfigPath)
  ) {
    return
  }

  await mkdir(tessdataDir, { recursive: true })
  for (const dirName of managedTessdataSupportDirs) {
    const sourceDir = join(tesseractInstalledTessdataDir, dirName)
    if (!await pathExists(sourceDir)) {
      continue
    }

    await cp(sourceDir, join(tessdataDir, dirName), {
      recursive: true,
      force: true
    })
  }
}

export const installManagedTesseractMacos = async (): Promise<void> => {
  if (!await hasManagedLeptonicaBuild()) {
    await downloadSource('leptonica', leptonicaBuildDir, 'leptonica-source', 'tar-gz')
    await recreateDir(leptonicaToolDir)
    const leptonicaCmakeBuildDir = join(leptonicaBuildDir, 'build')
    await recordSetupPerformancePhase('leptonica', 'configure-generate', async () => {
      await runInherit('cmake', [
        '-S', leptonicaBuildDir,
        '-B', leptonicaCmakeBuildDir,
        `-DCMAKE_INSTALL_PREFIX=${leptonicaToolDir}`,
        '-DENABLE_WEBP=OFF',
        '-DENABLE_OPENJPEG=OFF',
        '-DBUILD_PROG=OFF',
        '-DSW_BUILD=OFF'
      ], { env: managedPathEnv() })
    })
    const jobs = resolveSetupSourceBuildParallelJobs()
    await recordSetupPerformancePhase('leptonica', 'compile-link', async () => {
      await runInherit('cmake', ['--build', leptonicaCmakeBuildDir, '--parallel', String(jobs)], { env: managedPathEnv() })
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('leptonica', 'install-promote', async () => {
      await runInherit('cmake', ['--install', leptonicaCmakeBuildDir], { env: managedPathEnv() })
      await Bun.write(leptonicaManagedBuildStampPath, 'leptonica-cmake-v1\n')
    })
    await recordSetupPerformancePhase('leptonica', 'cleanup', async () => {
      await discardBuildTree(leptonicaBuildDir)
    })
  }

  if (!await pathExists(tesseractInstalledBinaryPath)) {
    await downloadSource('tesseract', tesseractBuildDir, 'tesseract-source', 'tar-gz')
    await recreateDir(tesseractToolDir)
    const tesseractCmakeBuildDir = join(tesseractBuildDir, 'build')
    await recordSetupPerformancePhase('tesseract', 'configure-generate', async () => {
      await runInherit('cmake', [
        '-S', tesseractBuildDir,
        '-B', tesseractCmakeBuildDir,
        `-DCMAKE_INSTALL_PREFIX=${tesseractToolDir}`,
        `-DLeptonica_DIR=${leptonicaCmakeConfigDir}`,
        '-DBUILD_TESTS=OFF',
        '-DBUILD_TRAINING_TOOLS=OFF',
        '-DOPENMP_BUILD=OFF',
        '-DGRAPHICS_DISABLED=ON'
      ], { env: managedPathEnv([join(leptonicaToolDir, 'bin')]) })
    })
    const jobs = resolveSetupSourceBuildParallelJobs()
    await recordSetupPerformancePhase('tesseract', 'compile-link', async () => {
      await runInherit('cmake', ['--build', tesseractCmakeBuildDir, '--parallel', String(jobs)], {
        env: managedPathEnv([join(leptonicaToolDir, 'bin')])
      })
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('tesseract', 'install-promote', async () => {
      await runInherit('cmake', ['--install', tesseractCmakeBuildDir], {
        env: managedPathEnv([join(leptonicaToolDir, 'bin')])
      })
    })
    await recordSetupPerformancePhase('tesseract', 'cleanup', async () => {
      await discardBuildTree(tesseractBuildDir)
    })
  }

  await installManagedTessdataEng()
  await writeExecutableScript(tesseractManagedBinaryPath, `#!/bin/sh
export TESSDATA_PREFIX="${resolveTessdataPrefix()}"
export DYLD_LIBRARY_PATH="${join(leptonicaToolDir, 'lib')}:${join(tesseractToolDir, 'lib')}:\${DYLD_LIBRARY_PATH:-}"
exec "${tesseractInstalledBinaryPath}" "$@"
`)
}

export const installManagedQpdfMacos = async (): Promise<void> => {
  if (!await pathExists(qpdfInstalledBinaryPath)) {
    await downloadSource('qpdf', qpdfBuildDir, 'qpdf-source', 'tar-gz')
    await recreateDir(qpdfToolDir)
    const cmakeBuildDir = join(qpdfBuildDir, 'build')
    await recordSetupPerformancePhase('qpdf', 'configure-generate', async () => {
      await runInherit('cmake', [
        '-S', qpdfBuildDir,
        '-B', cmakeBuildDir,
        `-DCMAKE_INSTALL_PREFIX=${qpdfToolDir}`,
        '-DBUILD_TESTING=OFF'
      ], { env: managedPathEnv() })
    })
    const jobs = resolveSetupSourceBuildParallelJobs()
    await recordSetupPerformancePhase('qpdf', 'compile-link', async () => {
      await runInherit('cmake', ['--build', cmakeBuildDir, '--parallel', String(jobs)], { env: managedPathEnv() })
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('qpdf', 'install-promote', async () => {
      await runInherit('cmake', ['--install', cmakeBuildDir], { env: managedPathEnv() })
    })
  }

  await recordSetupPerformancePhase('qpdf', 'install-promote', async () => {
    await rm(qpdfManagedBinaryPath, { recursive: true, force: true })
    await writeExecutableScript(qpdfManagedBinaryPath, buildManagedQpdfWrapperScript())
  }, { wrapper: true })
  await recordSetupPerformancePhase('qpdf', 'health-check', async () => {
    const version = await runCapture(qpdfManagedBinaryPath, ['--version'], { allowFailure: true })
    if (version.exitCode !== 0) {
      const failure = version.stderr || version.stdout || `Managed qpdf wrapper failed with exit ${version.exitCode}`
      await cleanupFailedManagedQpdfInstall()
      throw InfraError(failure, { stage: 'setup:macos-tools' })
    }
  })
  await recordSetupPerformancePhase('qpdf', 'cleanup', async () => {
    await discardBuildTree(qpdfBuildDir)
  })
}
