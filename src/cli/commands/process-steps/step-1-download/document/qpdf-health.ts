import type { QpdfHealthFailureKind, QpdfHealthResult, ResolvedRuntimeTool } from '~/types'
import { installManagedQpdfMacos } from '~/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools'
import { exec } from '~/utils/cli-utils'
import { resolveRuntimeToolInfo } from '~/utils/runtime-paths'

const QPDF_LAUNCH_FAILURE_PATTERN = /(?:dyld|@rpath|library not loaded|image not found|mach-o|bad cpu|exec format|permission denied|not executable|no such file|enoent)/i

let qpdfHealthCache:
  | {
      key: string
      result: QpdfHealthResult
    }
  | undefined

const boundedFirstLine = (value: string): string => {
  const firstLine = value
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line.length > 0)
  if (!firstLine) {
    return ''
  }
  return firstLine.length > 180 ? `${firstLine.slice(0, 177)}...` : firstLine
}

const formatProbeFailure = (
  exitCode: number,
  stderr: string,
  stdout: string
): { failureKind: QpdfHealthFailureKind, message: string } => {
  const message = boundedFirstLine(stderr || stdout) || `qpdf --version exited ${exitCode}`
  return {
    failureKind: QPDF_LAUNCH_FAILURE_PATTERN.test(message) ? 'qpdf_launch_failure' : 'split_failed',
    message
  }
}

const probeQpdf = async (info: ResolvedRuntimeTool): Promise<QpdfHealthResult> => {
  try {
    const result = await exec(info.path, ['--version'])
    if (result.exitCode === 0) {
      return { healthy: true, info }
    }

    const failure = formatProbeFailure(result.exitCode, result.stderr, result.stdout)
    return {
      healthy: false,
      info,
      exitCode: result.exitCode,
      failureKind: failure.failureKind,
      message: failure.message
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      healthy: false,
      info,
      exitCode: -1,
      failureKind: QPDF_LAUNCH_FAILURE_PATTERN.test(message) ? 'qpdf_launch_failure' : 'split_failed',
      message: boundedFirstLine(message) || 'qpdf --version could not be launched'
    }
  }
}

const cacheKey = (info: ResolvedRuntimeTool): string => `${info.source}:${info.path}`

const resetQpdfHealthCache = (): void => {
  qpdfHealthCache = undefined
}

export const resolveHealthyQpdfToolInfo = async (
  options: {
    repairManaged?: boolean | undefined
  } = {}
): Promise<QpdfHealthResult> => {
  const info = resolveRuntimeToolInfo('qpdf')
  if (!info) {
    return {
      healthy: false,
      exitCode: -1,
      failureKind: 'qpdf_unavailable',
      message: 'qpdf was not found'
    }
  }

  const key = cacheKey(info)
  if (qpdfHealthCache?.key === key) {
    return qpdfHealthCache.result
  }

  let result = await probeQpdf(info)
  if (
    !result.healthy
    && options.repairManaged !== false
    && info.source === 'managed'
    && process.platform === 'darwin'
  ) {
    try {
      await installManagedQpdfMacos()
      const repairedInfo = resolveRuntimeToolInfo('qpdf')
      if (repairedInfo) {
        const repairedResult = await probeQpdf(repairedInfo)
        result = repairedResult.healthy
          ? { ...repairedResult, repaired: true }
          : repairedResult
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result = {
        healthy: false,
        info,
        exitCode: -1,
        failureKind: QPDF_LAUNCH_FAILURE_PATTERN.test(message) ? 'qpdf_launch_failure' : 'split_failed',
        message: boundedFirstLine(message) || 'managed qpdf repair failed'
      }
    }
  }

  qpdfHealthCache = { key, result }
  return result
}

export const refreshQpdfHealthCache = async (
  options: {
    repairManaged?: boolean | undefined
  } = {}
): Promise<QpdfHealthResult> => {
  resetQpdfHealthCache()
  return await resolveHealthyQpdfToolInfo(options)
}
