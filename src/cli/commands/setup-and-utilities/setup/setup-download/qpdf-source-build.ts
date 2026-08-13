import { join } from 'node:path'
import { runCapture } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import { InfraError } from '~/utils/error-handler'

export const QPDF_SOURCE_RECIPE_STAMP = 'qpdf-12.3.2-static-native-libjpeg-turbo-3.2.0-v1\n'

export const LIBJPEG_TURBO_SOURCE_BUILD_FLAGS = [
  '-DCMAKE_BUILD_TYPE=Release',
  '-DENABLE_SHARED=OFF',
  '-DENABLE_STATIC=ON',
  '-DWITH_TURBOJPEG=OFF',
  '-DWITH_TOOLS=OFF',
  '-DWITH_TESTS=OFF'
] as const

export const QPDF_SOURCE_BUILD_FLAGS = [
  '-DCMAKE_BUILD_TYPE=Release',
  '-DBUILD_SHARED_LIBS=OFF',
  '-DBUILD_STATIC_LIBS=ON',
  '-DUSE_IMPLICIT_CRYPTO=OFF',
  '-DREQUIRE_CRYPTO_NATIVE=ON',
  '-DDEFAULT_CRYPTO=native',
  '-DBUILD_DOC=OFF',
  '-DINSTALL_MANUAL=OFF',
  '-DINSTALL_EXAMPLES=OFF'
] as const

export type QpdfSourceBuildLayout = {
  qpdfSourceDir: string
  libjpegTurboSourceDir: string
  qpdfCmakeBuildDir: string
  libjpegTurboCmakeBuildDir: string
  libjpegTurboInstallDir: string
  builtQpdfPath: string
}

export const resolveQpdfSourceBuildLayout = (buildRoot: string): QpdfSourceBuildLayout => ({
  qpdfSourceDir: join(buildRoot, 'sources/qpdf'),
  libjpegTurboSourceDir: join(buildRoot, 'sources/libjpeg-turbo'),
  qpdfCmakeBuildDir: join(buildRoot, 'build/qpdf'),
  libjpegTurboCmakeBuildDir: join(buildRoot, 'build/libjpeg-turbo'),
  libjpegTurboInstallDir: join(buildRoot, 'install/libjpeg-turbo'),
  builtQpdfPath: join(buildRoot, 'build/qpdf/qpdf/qpdf')
})

const withDeploymentTarget = (args: string[], deploymentTarget?: string): string[] => deploymentTarget
  ? [...args, `-DCMAKE_OSX_DEPLOYMENT_TARGET=${deploymentTarget}`]
  : args

export const buildLibjpegTurboCmakeArguments = (
  layout: QpdfSourceBuildLayout,
  deploymentTarget?: string
): string[] => withDeploymentTarget([
  '-S', layout.libjpegTurboSourceDir,
  '-B', layout.libjpegTurboCmakeBuildDir,
  `-DCMAKE_INSTALL_PREFIX=${layout.libjpegTurboInstallDir}`,
  ...LIBJPEG_TURBO_SOURCE_BUILD_FLAGS
], deploymentTarget)

export const buildQpdfCmakeArguments = (
  layout: QpdfSourceBuildLayout,
  installDir: string,
  deploymentTarget?: string
): string[] => withDeploymentTarget([
  '-S', layout.qpdfSourceDir,
  '-B', layout.qpdfCmakeBuildDir,
  `-DCMAKE_INSTALL_PREFIX=${installDir}`,
  '-DCMAKE_BUILD_TYPE=Release',
  `-DCMAKE_PREFIX_PATH=${layout.libjpegTurboInstallDir}`,
  `-DCMAKE_LIBRARY_PATH=${join(layout.libjpegTurboInstallDir, 'lib')}`,
  `-DCMAKE_INCLUDE_PATH=${join(layout.libjpegTurboInstallDir, 'include')}`,
  ...QPDF_SOURCE_BUILD_FLAGS
], deploymentTarget)

export const buildQpdfSourceEnvironment = (
  layout: QpdfSourceBuildLayout
): Record<string, string | undefined> => {
  const pkgConfigDir = join(layout.libjpegTurboInstallDir, 'lib/pkgconfig')
  return {
    PKG_CONFIG_PATH: pkgConfigDir,
    PKG_CONFIG_LIBDIR: pkgConfigDir
  }
}

const allowedMacosDynamicLibraryReference = (path: string): boolean =>
  path.startsWith('/usr/lib/') ||
  path.startsWith('/System/Library/') ||
  path.startsWith('@loader_path/') ||
  path.startsWith('@rpath/')

export const findForbiddenMacosDynamicLibraryReferences = (otoolOutput: string): string[] =>
  otoolOutput
    .split('\n')
    .map(line => line.trim().match(/^(\S+)\s+\(compatibility version/)?.[1])
    .filter((path): path is string => path !== undefined && !allowedMacosDynamicLibraryReference(path))

export const assertPortableQpdfDynamicLibraryClosure = async (binaryPath: string): Promise<void> => {
  const result = await runCapture('otool', ['-L', binaryPath], { allowFailure: true })
  if (result.exitCode !== 0) {
    throw InfraError(
      result.stderr || result.stdout || `otool could not inspect managed qpdf (exit ${result.exitCode})`,
      { stage: 'setup:qpdf' }
    )
  }

  const forbidden = findForbiddenMacosDynamicLibraryReferences(result.stdout)
  if (forbidden.length > 0) {
    throw InfraError(
      `Managed qpdf has non-system dynamic-library references: ${forbidden.join(', ')}`,
      { stage: 'setup:qpdf' }
    )
  }
}
