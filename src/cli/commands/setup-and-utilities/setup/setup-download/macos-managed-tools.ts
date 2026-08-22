import { cp, mkdir, rename, rm, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { runCapture, runInherit } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { pathExists } from '~/utils/filesystem'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { installDmgApp } from '~/cli/commands/setup-and-utilities/setup/setup-download/dmg'
import { recordSetupPerformancePhase } from '~/cli/commands/setup-and-utilities/setup/setup-performance'
import {
  assertPortableQpdfDynamicLibraryClosure,
  buildLibjpegTurboCmakeArguments,
  buildQpdfCmakeArguments,
  buildQpdfSourceEnvironment,
  QPDF_SOURCE_RECIPE_STAMP,
  resolveQpdfSourceBuildLayout
} from '~/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build'
import { buildMupdfMakeArguments } from '~/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build'
import {
  createManagedToolStagingDirectory,
  promoteManagedToolDirectory,
  resolveSourceDeploymentTarget,
  validateManagedSourceArtifact,
  writeManagedSourceArtifactManifest
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import type { DownloadFlowId } from '~/types'
import { InfraError } from '~/utils/error-handler'
import { logicalCpuCount } from '~/utils/logical-cpu-count'
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

const resolveSetupSourceBuildParallelJobs = (): number => Math.min(logicalCpuCount(), 8)
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
  const tempPath = `${linkPath}.tmp-${crypto.randomUUID()}`
  try {
    await symlink(target, tempPath)
    await rename(tempPath, linkPath)
  } finally {
    await rm(tempPath, { force: true })
  }
}

const writeExecutableScript = async (path: string, content: string): Promise<void> => {
  await ensureParentDir(path)
  const tempPath = `${path}.tmp-${crypto.randomUUID()}`
  try {
    await Bun.write(tempPath, content)
    await makeExecutable(tempPath)
    await rename(tempPath, path)
  } finally {
    await rm(tempPath, { force: true })
  }
}

export const buildManagedQpdfWrapperScript = (
  installedBinaryPath = qpdfInstalledBinaryPath
): string => `#!/bin/sh
exec "${installedBinaryPath}" "$@"
`

const assertManagedSourceInstallAt = async (
  tool: 'mupdf' | 'qpdf',
  toolDir: string
): Promise<string> => {
  const validation = await validateManagedSourceArtifact(tool, { toolDir })
  if (!validation.healthy) {
    throw InfraError(`Managed ${tool} provenance validation failed: ${validation.reason}`, {
      stage: `setup:${tool}`
    })
  }

  const binaryPath = join(toolDir, tool === 'mupdf' ? 'bin/mutool' : 'bin/qpdf')
  const args = tool === 'mupdf' ? ['-v'] : ['--version']
  const okExitCodes = tool === 'mupdf' ? [0, 1] : [0]
  const result = await runCapture(binaryPath, args, { allowFailure: true })
  const output = `${result.stdout}\n${result.stderr}`
  if (!okExitCodes.includes(result.exitCode) || !output.includes(validation.version)) {
    throw InfraError(
      `Managed ${tool} failed its ${args.join(' ')} version check for ${validation.version}`,
      { stage: `setup:${tool}` }
    )
  }
  return validation.version
}

export const hasHealthyManagedSourceInstall = async (tool: 'mupdf' | 'qpdf'): Promise<boolean> => {
  try {
    const version = await assertManagedSourceInstallAt(tool, tool === 'mupdf' ? mupdfToolDir : qpdfToolDir)
    const managedPath = tool === 'mupdf' ? mutoolManagedBinaryPath : qpdfManagedBinaryPath
    const args = tool === 'mupdf' ? ['-v'] : ['--version']
    const okExitCodes = tool === 'mupdf' ? [0, 1] : [0]
    const result = await runCapture(managedPath, args, { allowFailure: true })
    if (!okExitCodes.includes(result.exitCode) || !`${result.stdout}\n${result.stderr}`.includes(version)) return false
    return true
  } catch {
    return false
  }
}

const hasValidManagedSourcePayload = async (tool: 'mupdf' | 'qpdf'): Promise<boolean> => {
  try {
    await assertManagedSourceInstallAt(tool, tool === 'mupdf' ? mupdfToolDir : qpdfToolDir)
    return true
  } catch {
    return false
  }
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
  flowId: DownloadFlowId
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
      mode: 'tar-gz',
      stripComponents: 1
    })
    await Bun.write(sourceStampPath(buildDir), `${sha256}\n`)
  }, { sourceCached })
}

// Source and object trees are inputs to the installed artifacts under
// runtime/tools; once an install validates, keeping them only costs disk.
const discardBuildTree = async (buildDir: string): Promise<void> => {
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

const installManagedLameMacos = async (): Promise<void> => {
  if (await pathExists(lameStaticLibPath)) return
  await downloadSource('lame', lameBuildDir, 'lame-source')
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
  await downloadSource('ffmpeg', ffmpegBuildDir, 'ffmpeg-source')
  await recreateDir(ffmpegToolDir)
  await recordSetupPerformancePhase('ffmpeg', 'configure-generate', async () => {
    await runInherit('./configure', [
      `--prefix=${ffmpegToolDir}`,
      '--disable-doc',
      '--disable-debug',
      '--disable-ffplay',
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
  if (await hasValidManagedSourcePayload('mupdf')) {
    await createSymlinkShim(mutoolInstalledBinaryPath, mutoolManagedBinaryPath)
    return
  }
  await downloadSource('mupdf', mupdfBuildDir, 'mupdf-source')
  const deploymentTarget = await resolveSourceDeploymentTarget()
  const jobs = resolveSetupSourceBuildParallelJobs()
  await recordSetupPerformancePhase('mupdf', 'compile-link', async () => {
    await runInherit('make', buildMupdfMakeArguments(jobs), {
      cwd: mupdfBuildDir,
      env: { MACOSX_DEPLOYMENT_TARGET: deploymentTarget }
    })
  }, { parallelJobs: jobs })
  await recordSetupPerformancePhase('mupdf', 'install-promote', async () => {
    const stagingDir = await createManagedToolStagingDirectory(mupdfToolDir)
    try {
      const stagedMutool = join(stagingDir, 'bin/mutool')
      await mkdir(dirname(stagedMutool), { recursive: true })
      await cp(join(mupdfBuildDir, 'build/release/mutool'), stagedMutool)
      await makeExecutable(stagedMutool)
      await writeManagedSourceArtifactManifest({ tool: 'mupdf', toolDir: stagingDir, deploymentTarget })
      await promoteManagedToolDirectory({
        stagingDir,
        destinationDir: mupdfToolDir,
        validateStaging: async (toolDir) => { await assertManagedSourceInstallAt('mupdf', toolDir) },
        activate: async () => { await createSymlinkShim(mutoolInstalledBinaryPath, mutoolManagedBinaryPath) },
        rollbackActivation: async (hadPreviousInstall) => {
          if (!hadPreviousInstall) await rm(mutoolManagedBinaryPath, { force: true })
        }
      })
    } catch (error) {
      await rm(stagingDir, { recursive: true, force: true })
      throw error
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

const installManagedTessdataEng = async (): Promise<void> => {
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
    await downloadSource('leptonica', leptonicaBuildDir, 'leptonica-source')
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
    await downloadSource('tesseract', tesseractBuildDir, 'tesseract-source')
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
  const existingSourceInstallHealthy = await hasValidManagedSourcePayload('qpdf')
  if (!existingSourceInstallHealthy) {
    const layout = resolveQpdfSourceBuildLayout(qpdfBuildDir)
    await downloadSource('libjpeg-turbo', layout.libjpegTurboSourceDir, 'libjpeg-turbo-source')
    await downloadSource('qpdf', layout.qpdfSourceDir, 'qpdf-source')
    await recreateDir(layout.libjpegTurboCmakeBuildDir)
    await recreateDir(layout.libjpegTurboInstallDir)
    const deploymentTarget = await resolveSourceDeploymentTarget()
    await recordSetupPerformancePhase('libjpeg-turbo', 'configure-generate', async () => {
      await runInherit('cmake', buildLibjpegTurboCmakeArguments(layout, deploymentTarget))
    })
    const jobs = resolveSetupSourceBuildParallelJobs()
    await recordSetupPerformancePhase('libjpeg-turbo', 'compile-link', async () => {
      await runInherit('cmake', [
        '--build', layout.libjpegTurboCmakeBuildDir,
        '--target', 'jpeg-static',
        '--parallel', String(jobs)
      ])
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('libjpeg-turbo', 'install-promote', async () => {
      await runInherit('cmake', ['--install', layout.libjpegTurboCmakeBuildDir])
    })
    await recreateDir(layout.qpdfCmakeBuildDir)
    const qpdfBuildEnv = buildQpdfSourceEnvironment(layout)
    await recordSetupPerformancePhase('qpdf', 'configure-generate', async () => {
      await runInherit('cmake', buildQpdfCmakeArguments(layout, join(qpdfBuildDir, 'install/qpdf'), deploymentTarget), {
        env: qpdfBuildEnv
      })
    })
    await recordSetupPerformancePhase('qpdf', 'compile-link', async () => {
      await runInherit('cmake', [
        '--build', layout.qpdfCmakeBuildDir,
        '--target', 'qpdf',
        '--parallel', String(jobs)
      ], { env: qpdfBuildEnv })
    }, { parallelJobs: jobs })
    await recordSetupPerformancePhase('qpdf', 'install-promote', async () => {
      const stagingDir = await createManagedToolStagingDirectory(qpdfToolDir)
      try {
        const stagedQpdf = join(stagingDir, 'bin/qpdf')
        await mkdir(dirname(stagedQpdf), { recursive: true })
        await cp(layout.builtQpdfPath, stagedQpdf)
        await makeExecutable(stagedQpdf)
        await assertPortableQpdfDynamicLibraryClosure(stagedQpdf)
        await Bun.write(join(stagingDir, '.autoshow-managed-build'), QPDF_SOURCE_RECIPE_STAMP)
        await writeManagedSourceArtifactManifest({ tool: 'qpdf', toolDir: stagingDir, deploymentTarget })
        await promoteManagedToolDirectory({
          stagingDir,
          destinationDir: qpdfToolDir,
          validateStaging: async (toolDir) => {
            await assertPortableQpdfDynamicLibraryClosure(join(toolDir, 'bin/qpdf'))
            await assertManagedSourceInstallAt('qpdf', toolDir)
          },
          activate: async () => {
            await writeExecutableScript(qpdfManagedBinaryPath, buildManagedQpdfWrapperScript())
            const version = await runCapture(qpdfManagedBinaryPath, ['--version'], { allowFailure: true })
            if (version.exitCode !== 0) {
              throw InfraError('Managed qpdf wrapper failed its version check', { stage: 'setup:qpdf' })
            }
          },
          rollbackActivation: async (hadPreviousInstall) => {
            if (!hadPreviousInstall) await rm(qpdfManagedBinaryPath, { force: true })
          }
        })
      } catch (error) {
        await rm(stagingDir, { recursive: true, force: true })
        throw error
      }
    })
  } else {
    await writeExecutableScript(qpdfManagedBinaryPath, buildManagedQpdfWrapperScript())
  }
  await recordSetupPerformancePhase('qpdf', 'cleanup', async () => {
    await discardBuildTree(qpdfBuildDir)
  })
}
