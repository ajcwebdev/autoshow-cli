import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { hasRuntimeTool, resolveRuntimeToolInfo, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import { hasYtDlpBinary } from '~/cli/commands/process-steps/shared/shared-yt-dlp-binary'
import { readDependencyUrlAndSha256 } from '../../dependency-metadata'
import { hasManagedFfmpegBuild, installManagedFfmpegMacos, installManagedYtDlpMacos } from '../macos-managed-tools'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError } from '~/utils/error-handler'

const shouldPrintCompletion = (): boolean => !isCompactSetupMode()

const installFfmpeg = async (): Promise<void> => {
  const platform = detectPlatform()
  const hasBoth = hasRuntimeTool('ffmpeg') && hasRuntimeTool('ffprobe')

  if (platform === 'darwin') {
    if (hasBoth && resolveRuntimeToolInfo('ffmpeg')?.source === 'override') return
    if (await hasManagedFfmpegBuild()) return
    l.write('info', 'Installing FFmpeg', { category: 'command' })
    await installManagedFfmpegMacos()
    l.write('info', 'FFmpeg installed', { category: 'command' })
    return
  }

  if (hasBoth) {
    return
  }

  l.write('info', 'Installing FFmpeg', { category: 'command' })

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'ffmpeg'])
    l.write('info', 'FFmpeg installed', { category: 'command' })
    return
  }

  throw InfraError('Unsupported platform for FFmpeg setup', { stage: 'setup:download' })
}

const installYtDlp = async (): Promise<void> => {
  if (hasYtDlpBinary()) {
    return
  }

  l.write('info', 'Installing yt-dlp', { category: 'command' })
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedYtDlpMacos()
    l.write('info', 'yt-dlp installed', { category: 'command' })
    return
  }

  if (platform === 'linux') {
    const { url, sha256 } = await readDependencyUrlAndSha256('yt-dlp', 'linux')
    await mkdir(dirname(ytDlpManagedBinaryPath), { recursive: true })
    await withRetry(
      { retryClass: 'setup_download', operationName: 'yt-dlp-binary' },
      async () => {
        await downloadFile({
          url,
          sha256,
          destination: ytDlpManagedBinaryPath,
          flowId: 'yt-dlp-binary'
        })
      }
    )
    await makeExecutable(ytDlpManagedBinaryPath)
    l.write('info', 'yt-dlp installed', { category: 'command' })
    return
  }

  throw InfraError('Unsupported platform for yt-dlp setup', { stage: 'setup:download' })
}

export const setupYtDependencies = async (): Promise<void> => {
  await installFfmpeg()
  await installYtDlp()

  if (shouldPrintCompletion()) {
    l.write('info', 'yt-dlp and FFmpeg setup complete', { category: 'command' })
  }
}
