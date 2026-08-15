import { basename } from 'node:path'
import { formatCost, formatDuration, formatEstimatedCost, formatEstimatedCostWithExactCents } from '~/utils/app-logger/formatters'
import { createDetailTable, createHumanTable, createLocationsTable, toHumanTableCell } from '~/utils/app-logger/human-table/human-table'
import { emitResult } from '~/utils/app-logger/result-emitter'
import { stepEstimateToReport } from '~/utils/pricing/step-estimate-fields'
import type { AggregatedPriceEstimate, CompleteOptions, HumanCompletionTables, HumanLogTableRow, Logger, Reporter, ReporterMetricValue, StepEstimate, StepSummaryEntry, StepTimingCost, TimingStepEntry } from '~/types'

const formatSttProvider = (provider: string): string => {
  return provider === 'whisper' ? 'whisper.cpp' : provider
}

const formatEstimateIdentity = (estimate: StepEstimate): Pick<StepEstimate, 'provider' | 'model'> => ({
  provider: estimate.step === 'stt' ? formatSttProvider(estimate.provider) : estimate.provider,
  model: estimate.model
})

const mapTimingEstimate = (timing: TimingStepEntry): Record<string, string | number> => ({
  step: timing.step,
  provider: timing.provider,
  model: timing.model,
  ...(typeof timing.inputMetric === 'string' && typeof timing.inputValue === 'number'
    ? { input: `${timing.inputValue} ${timing.inputMetric}` }
    : {}),
  estimatedTime: formatDuration(timing.processingTimeMs)
})

const formatStepSummary = (steps: StepTimingCost[], totalTimeMs: number, totalCost: number) => {
  const entries: StepSummaryEntry[] = steps.map(step => ({
    step: step.label,
    ...(step.providerModel ? { providerModel: step.providerModel } : {}),
    time: formatDuration(step.processingTime),
    cost: formatCost(step.cost)
  }))
  return {
    steps: entries,
    total: {
      step: 'Total',
      providerModel: '',
      time: formatDuration(totalTimeMs),
      cost: formatCost(totalCost)
    } satisfies StepSummaryEntry
  }
}

const buildHumanArtifactRows = (
  files: Record<string, string>
): HumanLogTableRow[] =>
  Object.entries(files)
    .filter(([, file]) => !file.startsWith('providers/'))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([artifact, file]) => ({
      artifact,
      path: basename(file)
    }))

const buildHumanProviderRows = (
  outputDir: string,
  files: Record<string, string>
): HumanLogTableRow[] => {
  const providerFiles = Object.entries(files).filter(([, file]) => file.startsWith('providers/'))
  if (providerFiles.length === 0) {
    return []
  }

  return [{
    dir: `${outputDir}/providers`,
    transcripts: providerFiles.filter(([key]) => key.startsWith('transcript-')).length,
    results: providerFiles.filter(([key]) => key.startsWith('result-')).length
  }]
}

const buildMetricRows = (
  metrics: Record<string, ReporterMetricValue>
): HumanLogTableRow[] =>
  Object.entries(metrics).map(([metric, value]) => ({
    metric,
    value: toHumanTableCell(value)
  }))

const buildTimingRows = (
  steps: StepTimingCost[],
  totalTimeMs: number,
  totalCost: number
): HumanLogTableRow[] => {
  const { steps: summarySteps, total } = formatStepSummary(steps, totalTimeMs, totalCost)
  return [...summarySteps, total].map((entry) => ({
    step: entry.step,
    providerModel: entry.providerModel ?? '',
    time: entry.time,
    cost: entry.cost
  }))
}

const buildHumanCompletionTables = (
  outputDir: string,
  files: Record<string, string>,
  options?: CompleteOptions
): HumanCompletionTables => {
  const artifactRows = buildHumanArtifactRows(files)
  const providerRows = buildHumanProviderRows(outputDir, files)
  const metricRows = options?.metrics ? buildMetricRows(options.metrics) : []
  const timingRows = options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined
    ? buildTimingRows(options.steps, options.totalTimeMs, options.totalCost)
    : []

  return {
    ...(artifactRows.length > 0 ? { artifacts: createHumanTable(artifactRows, ['artifact', 'path']) } : {}),
    ...(providerRows.length > 0 ? { providers: createHumanTable(providerRows, ['dir', 'transcripts', 'results']) } : {}),
    ...(metricRows.length > 0 ? { metrics: createHumanTable(metricRows, ['metric', 'value']) } : {}),
    ...(timingRows.length > 0 ? { timing: createHumanTable(timingRows, ['step', 'providerModel', 'time', 'cost']) } : {})
  }
}

const buildHumanEstimateRows = (
  estimate: AggregatedPriceEstimate
): HumanLogTableRow[] => {
  const timingRows = estimate.timing?.steps.map(mapTimingEstimate) ?? []

  return estimate.steps.map((step, index) => {
    const timing = timingRows[index]
    const identity = formatEstimateIdentity(step)
    return {
      step: step.step,
      ...identity,
      ...(typeof timing?.['input'] === 'string' ? { input: timing['input'] } : {}),
      ...(step.step === 'tts' && typeof step.setupCostCents === 'number'
        ? { setup: formatEstimatedCost(step.setupCostCents) }
        : {}),
      cost: formatEstimatedCost(step.totalCost),
      ...(typeof timing?.['estimatedTime'] === 'string' ? { estimatedTime: timing['estimatedTime'] } : {})
    }
  })
}

const buildHumanEstimateTable = (
  rows: readonly HumanLogTableRow[]
) => {
  const hasSetup = rows.some((row) => 'setup' in row)
  const hasInput = rows.some((row) => 'input' in row)
  const hasEstimated = rows.some((row) => 'estimatedTime' in row)
  const columns = [
    'step',
    'provider',
    'model',
    ...(hasInput ? ['input'] : []),
    ...(hasSetup ? ['setup'] : []),
    'cost',
    ...(hasEstimated ? ['estimatedTime'] : [])
  ]
  return createHumanTable(rows, columns, {
    align: {
      cost: 'right',
      ...(hasSetup ? { setup: 'right' } : {}),
      ...(hasEstimated ? { estimatedTime: 'right' } : {})
    }
  })
}

const buildCompleteResultData = (
  outputDir: string,
  files: Record<string, string>,
  options?: CompleteOptions
): Record<string, unknown> => {
  const resultData: Record<string, unknown> = {
    dryRun: false,
    outputDir,
    files: Object.fromEntries(
      Object.entries(files).map(([key, name]) => [key, `${outputDir}/${name}`])
    )
  }
  if (options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined) {
    resultData['timing'] = {
      totalMs: options.totalTimeMs,
      steps: options.steps.map(s => ({
        label: s.label,
        ...(s.providerModel ? { providerModel: s.providerModel } : {}),
        processingTimeMs: s.processingTime,
        costCents: s.cost
      })),
      totalCostCents: options.totalCost
    }
  }
  if (options?.metrics !== undefined) {
    resultData['metrics'] = options.metrics
  }
  return resultData
}

export const createReporter = (logger: Logger): Reporter => {
  return {
    expectedOutput: (outputDir, files) => {
      const prefix = outputDir.endsWith('/') ? outputDir : `${outputDir}/`
      logger.write('info', 'Expected files', {
        category: 'command',
        humanTable: createHumanTable(files.map(file => ({ file: `${prefix}${file}` })), ['file'])
      })
    },
    estimate: (estimate) => {
      const estimateRows = buildHumanEstimateRows(estimate)
      const estimateSummary: Array<readonly [string, unknown]> = [
        ['Total estimated cost', formatEstimatedCostWithExactCents(estimate.totalEstimatedCost)]
      ]
      if (estimate.timing && estimate.timing.steps.length > 0) {
        estimateSummary.push(['Total estimated processing time', formatDuration(estimate.timing.totalProcessingTimeMs)])
      }

      logger.write('info', 'Estimate', {
        category: 'pricing',
        humanTable: createDetailTable(estimateSummary),
        humanSections: [{
          title: 'Cost Estimate',
          table: buildHumanEstimateTable(estimateRows)
        }]
      })

      emitResult({
        dryRun: true,
        estimate: {
          steps: estimate.steps.map(step => stepEstimateToReport(step, formatEstimateIdentity(step))),
          totalEstimatedCostCents: estimate.totalEstimatedCost,
          ...(estimate.timing ? { timing: estimate.timing } : {})
        }
      })
    },
    complete: (outputDir, files, options) => {
      const tables = buildHumanCompletionTables(outputDir, files, options)
      const includeOutputDir = options?.includeOutputDir ?? true
      const humanSections = [
        ...(includeOutputDir
          ? [{
              title: 'Locations',
              table: createLocationsTable([{ artifact: 'outputDir', path: outputDir }])
            }]
          : []),
        ...(tables.artifacts ? [{ title: 'Artifacts', table: tables.artifacts }] : []),
        ...(tables.metrics ? [{ title: 'Metrics', table: tables.metrics }] : []),
        ...(tables.providers ? [{ title: 'Providers', table: tables.providers }] : []),
        ...(tables.timing ? [{ title: 'Timing', table: tables.timing }] : [])
      ]

      logger.write('success', options?.summaryMessage ?? 'Complete', {
        category: 'artifact',
        ...(humanSections.length > 0 ? { humanSections } : {})
      })

      emitResult(buildCompleteResultData(outputDir, files, options))
    }
  }
}
