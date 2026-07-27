import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getConfiguredBinDir, getYtDlpBinaryPath, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import type { ResolvedYtDlpBinary, ResolveYtDlpBinaryOptions } from '~/types'

export const resolveYtDlpBinaryInfo = (
  options: ResolveYtDlpBinaryOptions = {}
): ResolvedYtDlpBinary | undefined => {
  const managedPath = options.managedPath ?? ytDlpManagedBinaryPath
  const exists = options.exists ?? existsSync
  const overrideDir = (options.overrideBinDir ?? getConfiguredBinDir())?.trim()
  if (overrideDir) {
    const override = join(overrideDir, 'yt-dlp')
    if (exists(override)) return { path: override, source: 'override' }
  }
  if (exists(managedPath)) return { path: managedPath, source: 'managed' }
  if ((options.platform ?? process.platform) === 'darwin') return undefined
  const pathBinary = (options.which ?? ((command: string) => Bun.which(command)))('yt-dlp')
  return pathBinary ? { path: pathBinary, source: 'path' } : undefined
}

const resolveYtDlpBinary = (
  options: ResolveYtDlpBinaryOptions = {}
): string | undefined => resolveYtDlpBinaryInfo(options)?.path

export const hasYtDlpBinary = (
  options: ResolveYtDlpBinaryOptions = {}
): boolean => resolveYtDlpBinaryInfo(options) !== undefined

export const getYtDlpBinary = (): string => resolveYtDlpBinary() ?? getYtDlpBinaryPath()
