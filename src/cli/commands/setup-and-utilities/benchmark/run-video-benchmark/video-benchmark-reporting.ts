import { basename, join } from 'node:path'
import { escapeCell, formatScore } from '../benchmark-utils'
import { baseMediaComparisonRow, writeMediaComparisonReports } from '../media-provider-comparison'
import { VIDEO_QUALITY_CRITERIA } from './video-benchmark-constants'
import { evaluateProvider, rankProviders } from './video-benchmark-providers'
import type { JsonObject, VideoBenchmarkProvider, VideoQualityProviderReport, VideoQualityReport, VideoRunJson } from '~/types'

const writeVideoQualityMarkdown = async (path: string, report: VideoQualityReport): Promise<void> => {
  const lines = [
    '# Video Quality Report',
    '',
    '## Summary',
    '',
    `- Run directory: \`${report.runDir}\``,
    `- Judge model: \`${report.judge.model}\``,
    `- Providers: ${report.providerCount}`,
    `- Videos scored: ${report.videoCount}`,
    `- Frames scored: ${report.frameCount}`,
    '',
    '## Ranking',
    '',
    '| Rank | Provider | Quality / 100 | Average / 10 | Prompt | Visual | Artifacts | Temporal | Composition/Camera | Evidence |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |'
  ]

  for (const provider of report.providers) {
    lines.push(`| ${provider.rank} | \`${escapeCell(provider.providerKey)}\` | ${formatScore(provider.qualityScore)} | ${formatScore(provider.averageScore10)} | ${formatScore(provider.criterionScores.promptAdherence)} | ${formatScore(provider.criterionScores.visualQuality)} | ${formatScore(provider.criterionScores.artifactControl)} | ${formatScore(provider.criterionScores.temporalConsistency)} | ${formatScore(provider.criterionScores.compositionCamera)} | ${escapeCell(provider.evidence.summary)} |`)
  }

  lines.push(
    '',
    '## Rubric',
    '',
    '- Prompt adherence, visual quality, artifact control, temporal consistency, and composition/camera are scored from 1 to 10.',
    '- `qualityScore` is the average 1-10 score multiplied by 10 for 0-100 ranking compatibility.',
    '- Each video is judged from exactly 10 midpoint-interval screenshots in one vision request.',
    '- The score excludes cost, generation speed, file size, provider latency, and audio.'
  )

  await Bun.write(path, `${lines.join('\n')}\n`)
}

const providerComparisonRows = (report: VideoQualityReport): JsonObject[] =>
  report.providers
    .slice()
    .sort((left, right) => left.providerKey.localeCompare(right.providerKey))
    .map((provider) => ({
      ...baseMediaComparisonRow(provider),
      videoQuality: {
        judgeModel: report.judge.model,
        qualityScore: provider.qualityScore,
        averageScore10: provider.averageScore10,
        criterionScores: provider.criterionScores,
        videoCount: provider.videoCount,
        videoFiles: provider.videoFiles,
        frameCount: provider.evidence.frameCount,
        frameTimestamps: provider.evidence.frames.map((frame) => frame.timestampSeconds),
        frameFiles: provider.evidence.frames.map((frame) => frame.fileName),
        evidence: {
          judgeModel: report.judge.model,
          frameCount: provider.evidence.frameCount,
          frames: provider.evidence.frames,
          criterionScores: provider.criterionScores,
          summary: provider.evidence.summary,
          strengths: provider.evidence.strengths,
          issues: provider.evidence.issues
        }
      }
    }))

export const writeProviderComparisonReports = async (
  runDir: string,
  report: VideoQualityReport
): Promise<{ jsonOut: string, markdownOut: string }> =>
  await writeMediaComparisonReports(runDir, {
    category: 'video',
    categoryLabel: 'Video',
    proxyNoun: 'duration',
    report,
    rows: providerComparisonRows(report),
    summaryMetrics: [
      { label: 'Videos scored', value: report.videoCount },
      { label: 'Frames scored', value: report.frameCount }
    ]
  })

export const writeVideoQualityReports = async (
  runDir: string,
  runJson: VideoRunJson,
  providers: readonly VideoBenchmarkProvider[],
  judgeModel: string
): Promise<{ report: VideoQualityReport, jsonOut: string, markdownOut: string }> => {
  const generatedAt = new Date().toISOString()
  const evaluatedProviders: Array<Omit<VideoQualityProviderReport, 'rank'>> = []

  for (const provider of providers) {
    evaluatedProviders.push(await evaluateProvider(runDir, runJson.metadata.input, provider, judgeModel))
  }

  const rankedProviders = rankProviders(evaluatedProviders)
  const report: VideoQualityReport = {
    schemaVersion: 1,
    kind: 'video-quality-report',
    runDir,
    runName: basename(runDir),
    generatedAt,
    judge: {
      provider: 'openai',
      model: judgeModel,
      endpoint: 'responses'
    },
    prompt: runJson.metadata.input,
    rubric: {
      scale: '1-10',
      qualityScore: 'average criterion score x 10',
      frameSampling: '10 midpoint-interval screenshots per video',
      criteria: [...VIDEO_QUALITY_CRITERIA]
    },
    providerCount: rankedProviders.length,
    videoCount: rankedProviders.reduce((sum, provider) => sum + provider.videoCount, 0),
    frameCount: rankedProviders.reduce((sum, provider) => sum + provider.evidence.frameCount, 0),
    providers: rankedProviders
  }

  const jsonOut = join(runDir, 'video-quality-report.json')
  const markdownOut = join(runDir, 'video-quality-report.md')
  await Bun.write(jsonOut, `${JSON.stringify(report, null, 2)}\n`)
  await writeVideoQualityMarkdown(markdownOut, report)

  return { report, jsonOut, markdownOut }
}
