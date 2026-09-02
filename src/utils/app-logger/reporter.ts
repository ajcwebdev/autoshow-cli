import { formatCost, formatDuration, formatEstimatedCostWithExactCents } from '~/utils/app-logger/formatters'
import { stageResult } from '~/utils/app-logger/result-emitter'
import { stepEstimateToReport } from '~/utils/pricing/step-estimate-fields'
import type { AggregatedPriceEstimate, CompleteOptions, Logger, Reporter, StepEstimate } from '~/types'

const formatSttProvider = (provider: string): string => provider === 'whisper' ? 'whisper.cpp' : provider

const formatEstimateIdentity = (estimate: StepEstimate): Pick<StepEstimate, 'provider' | 'model'> => ({
  provider: estimate.step === 'stt' ? formatSttProvider(estimate.provider) : estimate.provider,
  model: estimate.model
})

const buildEstimateData = (estimate: AggregatedPriceEstimate): Record<string, unknown> => ({
  dryRun: true,
  estimate: {
    steps: estimate.steps.map(step => stepEstimateToReport(step, formatEstimateIdentity(step))),
    totalEstimatedCostCents: estimate.totalEstimatedCost,
    ...(estimate.timing ? { timing: estimate.timing } : {})
  }
})

const estimateMessage = (estimate: AggregatedPriceEstimate): string => {
  const values = [`${estimate.steps.length} step${estimate.steps.length === 1 ? '' : 's'}`, formatEstimatedCostWithExactCents(estimate.totalEstimatedCost)]
  if (estimate.timing && estimate.timing.steps.length > 0) values.push(formatDuration(estimate.timing.totalProcessingTimeMs))
  return `Estimate: ${values.join(', ')}`
}

const buildCompleteResultData = (
  outputDir: string,
  files: Record<string, string>,
  options?: CompleteOptions
): Record<string, unknown> => {
  const resultData: Record<string, unknown> = {
    dryRun: false,
    outputDir,
    files: Object.fromEntries(Object.entries(files).map(([key, name]) => [key, `${outputDir}/${name}`]))
  }
  if (options?.steps !== undefined && options.totalTimeMs !== undefined && options.totalCost !== undefined) {
    resultData['timing'] = {
      totalMs: options.totalTimeMs,
      steps: options.steps.map(step => ({
        label: step.label,
        ...(step.providerModel ? { providerModel: step.providerModel } : {}),
        processingTimeMs: step.processingTime,
        costCents: step.cost
      })),
      totalCostCents: options.totalCost
    }
  }
  if (options?.metrics !== undefined) resultData['metrics'] = options.metrics
  return resultData
}

export const createReporter = (logger: Logger): Reporter => ({
  expectedOutput: (outputDir, files) => {
    logger.write('info', `Expected ${files.length} file${files.length === 1 ? '' : 's'} in ${outputDir}`, {
      category: 'artifact',
      metadata: { outputDir, files }
    })
  },
  estimate: (estimate) => {
    logger.write('info', estimateMessage(estimate), { category: 'pricing', metadata: buildEstimateData(estimate) })
  },
  price: (estimate) => {
    const data = buildEstimateData(estimate)
    const message = estimateMessage(estimate)
    logger.write('success', message, { category: 'pricing', metadata: data })
    stageResult(data, message)
  },
  complete: (outputDir, files, options) => {
    const artifactCount = Object.keys(files).length
    const values = [`${artifactCount} artifact${artifactCount === 1 ? '' : 's'}`, outputDir]
    if (options?.totalTimeMs !== undefined) values.push(formatDuration(options.totalTimeMs))
    const message = `Complete: ${values.join(', ')}`
    const data = buildCompleteResultData(outputDir, files, options)
    logger.write('success', message, {
      category: 'artifact',
      metadata: {
        ...data,
        ...(options?.totalCost !== undefined ? { totalCost: formatCost(options.totalCost) } : {})
      }
    })
    stageResult(data, message)
  },
  result: (data, message = 'Complete') => {
    logger.write('success', message, { category: 'command', metadata: data })
    stageResult(data, message)
  }
})
