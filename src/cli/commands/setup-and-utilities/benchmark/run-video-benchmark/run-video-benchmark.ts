import { resolve } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable, createKeyValueTable } from '~/utils/app-logger/human-table/human-table'
import { CLIUsageError } from '~/utils/error-handler'
import { formatScore } from '../benchmark-utils'
import { DEFAULT_VIDEO_JUDGE_MODEL, VIDEO_FRAME_COUNT } from './video-benchmark-constants'
import { requireVideoTools } from './video-benchmark-frames'
import { writeProviderComparisonReports, writeVideoQualityReports } from './video-benchmark-reporting'
import { loadVideoRunJson, resolveVideoProviders } from './video-benchmark-run-json'
import type { BenchmarkFlags } from '~/types'

export const runVideoBenchmark = async (
  input: string | undefined,
  flags: BenchmarkFlags
): Promise<void> => {
  if (!input) {
    throw CLIUsageError('Video run directory is required. Usage: bun autoshow benchmark <video-run-dir> --video')
  }

  const runDir = resolve(input)
  const runJson = await loadVideoRunJson(runDir)
  const providers = await resolveVideoProviders(runDir, runJson)
  requireVideoTools()

  const judgeModel = flags['video-judge-model'] ?? DEFAULT_VIDEO_JUDGE_MODEL

  l.write('info', 'Video Benchmark Input', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['runDir', runDir],
      ['providers', providers.length],
      ['videos', providers.reduce((sum, provider) => sum + provider.videos.length, 0)],
      ['framesPerVideo', VIDEO_FRAME_COUNT],
      ['judgeModel', judgeModel]
    ]),
    metadata: {
      runDir,
      providerCount: providers.length,
      videoCount: providers.reduce((sum, provider) => sum + provider.videos.length, 0),
      framesPerVideo: VIDEO_FRAME_COUNT,
      judgeModel
    }
  })

  const { report, jsonOut, markdownOut } = await writeVideoQualityReports(runDir, runJson, providers, judgeModel)
  const comparison = await writeProviderComparisonReports(runDir, report)

  l.write('info', 'Video Benchmark Report', {
    category: 'artifact',
    humanTable: createKeyValueTable([
      ['qualityJson', jsonOut],
      ['qualityMarkdown', markdownOut],
      ['comparisonJson', comparison.jsonOut],
      ['comparisonMarkdown', comparison.markdownOut]
    ]),
    metadata: {
      jsonOut,
      markdownOut,
      comparisonJsonOut: comparison.jsonOut,
      comparisonMarkdownOut: comparison.markdownOut
    }
  })

  l.write('info', 'Video Quality Rankings', {
    category: 'pipeline',
    humanTable: createHumanTable(
      report.providers.slice(0, 10).map((provider) => ({
        rank: provider.rank,
        providerModel: provider.providerKey,
        qualityScore: formatScore(provider.qualityScore)
      })),
      ['rank', 'providerModel', 'qualityScore']
    ),
    metadata: {
      rankings: report.providers.slice(0, 10).map((provider) => ({
        rank: provider.rank,
        providerKey: provider.providerKey,
        qualityScore: provider.qualityScore
      }))
    }
  })
}
