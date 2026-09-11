import { appendFile, copyFile, mkdir } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import type {
  AdaptiveConcurrencyConfig,
  CallerLocation,
  RunCommandArtifacts
} from '~/types'
import { l } from '~/utils/app-logger/app-logger'
import { pathExists } from '~/utils/filesystem'
import { extractAdaptiveProviderGroups } from '../test-runner/adaptive-provider-groups'
import { parseCommandOutputText } from '../test-runner/utils'
import { readOutputMetadataSummary } from './output-metadata-summary'
import { sanitizeOutputRootSegment } from './test-output-directories'

const copyManifestToArtifacts = async (outputDir: string | null, outputRoot: string): Promise<void> => {
  const artifactsDir = process.env['AUTOSHOW_TEST_ARTIFACTS_DIR']
  if (!artifactsDir || !outputDir) {
    return
  }

  const absoluteOutputDir = isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir)
  const absoluteOutputRoot = isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot)
  const srcPath = `${absoluteOutputDir}/manifest.json`

  try {
    const exists = await pathExists(srcPath)
    if (!exists) {
      return
    }

    const destDir = `${artifactsDir}/run`
    const destName = [
      sanitizeOutputRootSegment(basename(absoluteOutputRoot)),
      sanitizeOutputRootSegment(basename(absoluteOutputDir)),
    ].join('-')
    await mkdir(destDir, { recursive: true })
    await copyFile(srcPath, `${destDir}/${destName}.json`)
  } catch {
  }
}

let commandMetricsWriteWarned = false

export const collectRunArtifacts = async (
  stdout: string,
  stderr: string,
  outputRoot: string
): Promise<RunCommandArtifacts> => {
  const { outputDir, estimatedCostCents: parsedEstimatedCostCents } = parseCommandOutputText(`${stdout}\n${stderr}`)
  await copyManifestToArtifacts(outputDir, outputRoot)
  const absoluteOutputDir = outputDir
    ? (isAbsolute(outputDir) ? outputDir : resolve(process.cwd(), outputDir))
    : null
  const metadataSummary = absoluteOutputDir
    ? await readOutputMetadataSummary(`${absoluteOutputDir}/manifest.json`)
    : null

  return { outputDir, absoluteOutputDir, metadataSummary, parsedEstimatedCostCents }
}

export const appendCommandMetricsRecord = async (
  metricsLogPath: string,
  parts: {
    commandText: string
    args: string[]
    exitCode: number
    durationMs: number
    outputRoot: string
    caller: CallerLocation
    testName: string | null
    runArtifacts: RunCommandArtifacts
    adaptiveConfig: AdaptiveConcurrencyConfig | null
    adaptivePressureSignals: number
  }
): Promise<void> => {
  const { runArtifacts, caller } = parts
  const record = {
    kind: 'command_metric',
    at: new Date().toISOString(),
    source: 'runCommand',
    command: parts.commandText,
    args: parts.args,
    exitCode: parts.exitCode,
    durationMs: parts.durationMs,
    outputDir: runArtifacts.outputDir,
    outputRoot: parts.outputRoot,
    callerFile: caller.file,
    callerLine: caller.line,
    callerColumn: caller.column,
    testName: parts.testName,
    estimatedCostCents: runArtifacts.metadataSummary?.estimatedCostCents ?? runArtifacts.parsedEstimatedCostCents,
    actualCostCents: runArtifacts.metadataSummary?.actualCostCents ?? null,
    estimatedProcessingTimeMs: runArtifacts.metadataSummary?.estimatedProcessingTimeMs ?? null,
    actualProcessingTimeMs: runArtifacts.metadataSummary?.actualProcessingTimeMs ?? null,
    adaptiveConcurrencyGroups: parts.adaptiveConfig ? extractAdaptiveProviderGroups(parts.args) : [],
    adaptivePressureSignals: parts.adaptivePressureSignals,
  }

  try {
    await appendFile(metricsLogPath, `${JSON.stringify(record)}\n`)
  } catch (error) {
    if (commandMetricsWriteWarned) return
    commandMetricsWriteWarned = true
    l.warn(`Could not append to the command metrics log at ${metricsLogPath}; pricing reports will be incomplete`, {
      category: 'pricing',
      metadata: { metricsLogPath }, error: error
    })
  }
}
