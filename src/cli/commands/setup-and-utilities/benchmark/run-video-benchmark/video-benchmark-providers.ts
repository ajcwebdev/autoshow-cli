import * as l from '~/utils/app-logger/app-logger'
import { average, round2, uniqueStrings } from '../benchmark-utils'
import { QUALITY_METRIC_NAME } from './video-benchmark-constants'
import { extractVideoFrames } from './video-benchmark-frames'
import { judgeVideo } from './video-benchmark-judge'
import type { VideoBenchmarkProvider, VideoCriterionScores, VideoEvaluation, VideoQualityProviderReport } from '~/types'

const averageCriterionScores = (evaluations: readonly VideoEvaluation[]): VideoCriterionScores => ({
  promptAdherence: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.promptAdherence))),
  visualQuality: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.visualQuality))),
  artifactControl: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.artifactControl))),
  temporalConsistency: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.temporalConsistency))),
  compositionCamera: round2(average(evaluations.map((evaluation) => evaluation.criterionScores.compositionCamera)))
})

const providerEvidence = (evaluations: readonly VideoEvaluation[]): VideoQualityProviderReport['evidence'] => ({
  summary: evaluations.map((evaluation) => `${evaluation.fileName}: ${evaluation.summary}`).join(' '),
  strengths: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.strengths)),
  issues: uniqueStrings(evaluations.flatMap((evaluation) => evaluation.issues)),
  frameCount: evaluations.reduce((sum, evaluation) => sum + evaluation.frameCount, 0),
  frames: evaluations.flatMap((evaluation) =>
    evaluation.frames.map((frame) => ({
      videoFileName: evaluation.fileName,
      index: frame.index,
      timestampSeconds: frame.timestampSeconds,
      fileName: frame.fileName
    }))
  )
})

export const evaluateProvider = async (
  runDir: string,
  prompt: string,
  provider: VideoBenchmarkProvider,
  judgeModel: string
): Promise<Omit<VideoQualityProviderReport, 'rank'>> => {
  const videos: VideoEvaluation[] = []
  for (const video of provider.videos) {
    l.write('info', `Extracting video quality frames: ${provider.providerKey} ${video.fileName}`)
    const { durationSeconds, frames } = await extractVideoFrames(runDir, provider, video)
    l.write('info', `Judging video: ${provider.providerKey} ${video.fileName}`)
    videos.push(await judgeVideo(prompt, provider, video, judgeModel, durationSeconds, frames))
  }

  const criterionScores = averageCriterionScores(videos)
  const averageScore10 = round2(average(videos.map((video) => video.averageScore10)))
  const qualityScore = round2(average(videos.map((video) => video.qualityScore)))

  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    videoFiles: provider.videos.map((video) => video.fileName),
    videoCount: provider.videos.length,
    ...(provider.processingTimeMs !== undefined ? { processingTimeMs: provider.processingTimeMs } : {}),
    ...(provider.costCents !== undefined ? { costCents: provider.costCents } : {}),
    criterionScores,
    averageScore10,
    qualityScore,
    qualityMetric: QUALITY_METRIC_NAME,
    evidence: providerEvidence(videos),
    videos
  }
}

export const rankProviders = (
  providers: readonly Omit<VideoQualityProviderReport, 'rank'>[]
): VideoQualityProviderReport[] =>
  providers
    .slice()
    .sort((left, right) => right.qualityScore - left.qualityScore || left.providerKey.localeCompare(right.providerKey))
    .map((provider, index) => ({ rank: index + 1, ...provider }))
