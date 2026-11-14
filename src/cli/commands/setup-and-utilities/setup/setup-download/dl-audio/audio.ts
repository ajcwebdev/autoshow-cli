import { dirname } from 'node:path'
import { detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import { withRetry } from '~/utils/retries'
import { makeExecutable } from '~/utils/filesystem'
import { hasRuntimeTool, resolveRuntimeToolInfo, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import { readDependencyUrlAndSha256 } from '../../dependency-metadata'
import { installManagedFfmpegMacos, installManagedYtDlpMacos } from '../macos-managed-tools'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError } from '~/utils/error-handler'
import { ensureManagedLinuxTool } from '../managed-linux-tools'
import { ensureRuntimeDirectory } from '~/utils/runtime-state'
import { assertManagedRuntimePath } from '~/utils/runtime-containment'

const shouldPrintCompletion = (): boolean => !isCompactSetupMode()

const installFfmpeg = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  const platform = detectPlatform()
  const hasBoth = hasRuntimeTool('ffmpeg') && hasRuntimeTool('ffprobe')

  if (platform === 'darwin') {
    if (hasBoth && resolveRuntimeToolInfo('ffmpeg')?.source === 'override') return
    l.write('info', 'Installing FFmpeg', { category: 'command' })
    await installManagedFfmpegMacos(options)
    l.write('info', 'FFmpeg installed', { category: 'command' })
    return
  }

  if (hasBoth && !options.forceRedownload && resolveRuntimeToolInfo('ffmpeg')?.source === 'override') {
    return
  }

  l.write('info', 'Installing FFmpeg', { category: 'command' })

  if (platform === 'linux') {
    await ensureManagedLinuxTool('ffmpeg', options)
    l.write('info', 'FFmpeg installed', { category: 'command' })
    return
  }

  throw InfraError('Unsupported platform for FFmpeg setup', { stage: 'setup:download' })
}

const installYtDlp = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedYtDlpMacos(options)
    l.write('info', 'yt-dlp installed', { category: 'command' })
    return
  }

  if (platform === 'linux') {
    await ensureManagedLinuxTool('python3', options)
    assertManagedRuntimePath(ytDlpManagedBinaryPath)
    const { url, sha256 } = await readDependencyUrlAndSha256('yt-dlp', 'linux')
    if (!options.forceRedownload && await Bun.file(ytDlpManagedBinaryPath).exists()) {
      const hash = new Bun.CryptoHasher('sha256')
      for await (const chunk of Bun.file(ytDlpManagedBinaryPath).stream()) hash.update(chunk)
      if (hash.digest('hex') === sha256) return
    }
    l.write('info', 'Installing yt-dlp', { category: 'command' })
    await ensureRuntimeDirectory(dirname(ytDlpManagedBinaryPath))
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
    await makeExecutable(assertManagedRuntimePath(ytDlpManagedBinaryPath))
    l.write('info', 'yt-dlp installed', { category: 'command' })
    return
  }

  throw InfraError('Unsupported platform for yt-dlp setup', { stage: 'setup:download' })
}

export const setupYtDependencies = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  await installFfmpeg(options)
  await installYtDlp(options)

  if (shouldPrintCompletion()) {
    l.write('info', 'yt-dlp and FFmpeg setup complete', { category: 'command' })
  }
}
