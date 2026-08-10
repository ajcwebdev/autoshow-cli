import { join } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { baseMediaComparisonRow, writeMediaComparisonReports } from '../media-provider-comparison'
import { judgeVisionArtifact, qualityReportBase, rankVisionProviders, runVisionBenchmark, summarizeVisionEvaluations, writeVisionQualityJson, writeVisionQualityMarkdown } from '../vision-benchmark-engine'
import { VIDEO_FRAME_COUNT } from './video-benchmark-constants'
import { extractVideoFrames, requireVideoTools } from './video-benchmark-frames'
import { loadVideoBenchmarkManifest, resolveVideoProviders } from './video-benchmark-manifest'
import type { BenchmarkFlags, JsonObject, VideoBenchmarkManifestView, VideoBenchmarkProvider, VideoCriterionScores, VideoEvaluation, VideoFileReference, VideoFrame, VideoQualityProviderReport, VideoQualityReport } from '~/types'
import type { VisionCriterion } from '../vision-benchmark-engine'

const DEFAULT_VIDEO_JUDGE_MODEL = 'gpt-5.5'
const QUALITY_METRIC_NAME = 'video quality score'
type VideoCriterion = keyof VideoCriterionScores

const VIDEO_CRITERIA = [
  { key: 'promptAdherence', reportLabel: 'prompt adherence', markdownLabel: 'Prompt', promptLine: 'how completely the video follows the requested subject, actions, style, structure, and constraints.' },
  { key: 'visualQuality', reportLabel: 'visual quality', markdownLabel: 'Visual', promptLine: 'overall aesthetic quality, clarity, lighting/color, and generation fidelity across frames.' },
  { key: 'artifactControl', reportLabel: 'artifact control', markdownLabel: 'Artifacts', promptLine: 'absence of obvious distortions, malformed objects, noise, flicker, warping, or rendering errors.' },
  { key: 'temporalConsistency', reportLabel: 'temporal consistency', markdownLabel: 'Temporal', promptLine: 'consistency of subjects, identity, motion continuity, physics, and scene state across ordered frames.' },
  { key: 'compositionCamera', reportLabel: 'composition/camera', markdownLabel: 'Composition/Camera', promptLine: 'framing, camera movement/readability, layout, balance, and shot coherence.' }
] as const satisfies readonly VisionCriterion<VideoCriterion>[]

const frameDataUrl = async ({ path }: VideoFrame): Promise<string> => {
  const bytes = await Bun.file(path).arrayBuffer()
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
}

const buildVideoJudgePrompt = (
  prompt: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference,
  frames: readonly VideoFrame[]
): string => [
  'Evaluate this generated video for an AutoShow video benchmark using the ordered screenshots as the video evidence.',
  'Use the original generation prompt as the target. Score only visible video quality, prompt fit, and temporal coherence implied by the ordered frames; do not reward or penalize provider cost or speed.',
  'Score each criterion from 1 to 10, where 10 is excellent and 1 is unusable.', '',
  `Provider/model: ${provider.providerKey}`, `Video file: ${video.fileName}`,
  `Screenshots: ${frames.length} ordered frames sampled at midpoint intervals`, '',
  'Original generation prompt:', prompt, '', 'Ordered frame timestamps:',
  ...frames.map((frame) => `- frame-${String(frame.index).padStart(2, '0')}: ${frame.timestampSeconds}s`),
  '', 'Criteria:', ...VIDEO_CRITERIA.map(({ key, promptLine }) => `- ${key}: ${promptLine}`),
  '', 'Return only the requested JSON.'
].join('\n')

const judgeVideo = async (
  prompt: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference,
  model: string,
  durationSeconds: number,
  frames: VideoFrame[]
): Promise<VideoEvaluation> => {
  const result = await judgeVisionArtifact({
    domain: 'video', providerKey: provider.providerKey, fileName: video.fileName, model, criteria: VIDEO_CRITERIA,
    content: [
      { type: 'input_text', text: buildVideoJudgePrompt(prompt, provider, video, frames) },
      ...(await Promise.all(frames.map(async (frame) => ({ type: 'input_image', image_url: await frameDataUrl(frame), detail: 'auto' }))))
    ]
  })
  return {
    fileName: video.fileName,
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    frameCount: frames.length,
    frames,
    ...result
  }
}

const evaluateVideoProvider = async (
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
  const summary = summarizeVisionEvaluations(VIDEO_CRITERIA, videos)
  const frameEvidence = videos.flatMap((video) => video.frames.map((frame) => ({
    videoFileName: video.fileName,
    index: frame.index,
    timestampSeconds: frame.timestampSeconds,
    fileName: frame.fileName
  })))
  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    videoFiles: provider.videos.map(({ fileName }) => fileName),
    videoCount: provider.videos.length,
    ...(provider.processingTimeMs !== undefined ? { processingTimeMs: provider.processingTimeMs } : {}),
    ...(provider.costCents !== undefined ? { costCents: provider.costCents } : {}),
    criterionScores: summary.criterionScores,
    averageScore10: summary.averageScore10,
    qualityScore: summary.qualityScore,
    qualityMetric: QUALITY_METRIC_NAME,
    evidence: { ...summary.evidence, frameCount: frameEvidence.length, frames: frameEvidence },
    videos
  }
}

const providerComparisonRows = (report: VideoQualityReport): JsonObject[] => report.providers
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
      frameTimestamps: provider.evidence.frames.map(({ timestampSeconds }) => timestampSeconds),
      frameFiles: provider.evidence.frames.map(({ fileName }) => fileName),
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

const writeVideoQualityReports = async (
  runDir: string,
  manifestView: VideoBenchmarkManifestView,
  providers: readonly VideoBenchmarkProvider[],
  judgeModel: string
): Promise<{ report: VideoQualityReport, jsonOut: string, markdownOut: string }> => {
  const evaluated = [] as Array<Omit<VideoQualityProviderReport, 'rank'>>
  for (const provider of providers) evaluated.push(await evaluateVideoProvider(runDir, manifestView.input, provider, judgeModel))
  const ranked: VideoQualityProviderReport[] = rankVisionProviders(evaluated)
  const report: VideoQualityReport = {
    ...qualityReportBase('video-quality-report', runDir, new Date().toISOString(), judgeModel, manifestView.input, {
      scale: '1-10',
      qualityScore: 'average criterion score x 10',
      frameSampling: '10 midpoint-interval screenshots per video',
      criteria: VIDEO_CRITERIA.map(({ reportLabel }) => reportLabel)
    }),
    providerCount: ranked.length,
    videoCount: ranked.reduce((sum, provider) => sum + provider.videoCount, 0),
    frameCount: ranked.reduce((sum, provider) => sum + provider.evidence.frameCount, 0),
    providers: ranked
  }
  const jsonOut = await writeVisionQualityJson(runDir, 'video', report)
  const markdownOut = join(runDir, 'video-quality-report.md')
  await writeVisionQualityMarkdown(markdownOut, report, {
    title: 'Video', artifactLabel: 'Videos', artifactCount: report.videoCount,
    extraSummaryMetrics: [{ label: 'Frames scored', value: report.frameCount }], criteria: VIDEO_CRITERIA,
    rubricCriteria: 'Prompt adherence, visual quality, artifact control, temporal consistency, and composition/camera',
    extraRubricLines: [
      '- Each video is judged from exactly 10 midpoint-interval screenshots in one vision request.',
      '- The score excludes cost, generation speed, file size, provider latency, and audio.'
    ]
  })
  return { report, jsonOut, markdownOut }
}

export const runVideoBenchmark = async (input: string | undefined, flags: BenchmarkFlags): Promise<void> => {
  await runVisionBenchmark(input, flags, {
    label: 'Video', usage: 'bun autoshow benchmark <video-run-dir> --video', artifactLabel: 'videos', artifactCountKey: 'videoCount',
    defaultJudgeModel: DEFAULT_VIDEO_JUDGE_MODEL,
    judgeModel: (options) => options['video-judge-model'],
    load: async (runDir) => {
      const manifestView = await loadVideoBenchmarkManifest(runDir)
      return { manifestView, providers: await resolveVideoProviders(runDir, manifestView) }
    },
    artifactCount: ({ videos }) => videos.length,
    prepare: requireVideoTools,
    framesPerArtifact: VIDEO_FRAME_COUNT,
    writeQualityReports: writeVideoQualityReports,
    writeComparisonReports: async (runDir, report) => await writeMediaComparisonReports(runDir, {
      category: 'video', categoryLabel: 'Video', proxyNoun: 'duration', report, rows: providerComparisonRows(report),
      summaryMetrics: [{ label: 'Videos scored', value: report.videoCount }, { label: 'Frames scored', value: report.frameCount }]
    })
  })
}
