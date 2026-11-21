import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assertRuntimeContainedPath, getConfiguredBinDir, getYtDlpBinaryPath, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import type { ResolvedYtDlpBinary, ResolveYtDlpBinaryOptions } from '~/types'

export const resolveYtDlpBinaryInfo = (
  options: ResolveYtDlpBinaryOptions = {}
): ResolvedYtDlpBinary | undefined => {
  const managedPath = options.managedPath ?? ytDlpManagedBinaryPath
  const exists = options.exists ?? existsSync
  const overrideDir = (options.overrideBinDir ?? getConfiguredBinDir())?.trim()
  if (overrideDir) {
    const override = join(assertRuntimeContainedPath(overrideDir, options.realpath), 'yt-dlp')
    if (exists(override)) return { path: assertRuntimeContainedPath(override, options.realpath), source: 'override' }
  }
  if (exists(managedPath)) return { path: assertRuntimeContainedPath(managedPath, options.realpath), source: 'managed' }
  return undefined
}

const resolveYtDlpBinary = (
  options: ResolveYtDlpBinaryOptions = {}
): string | undefined => resolveYtDlpBinaryInfo(options)?.path

export const hasYtDlpBinary = (
  options: ResolveYtDlpBinaryOptions = {}
): boolean => resolveYtDlpBinaryInfo(options) !== undefined

export const getYtDlpBinary = (): string => resolveYtDlpBinary() ?? getYtDlpBinaryPath()
