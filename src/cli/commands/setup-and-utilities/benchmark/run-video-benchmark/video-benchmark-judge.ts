import { ValidationError } from '~/utils/error-handler'
import { average, getNumber, getString, parseJsonObjectFromText, round2, runOpenAIJudge, stringArray } from '../benchmark-utils'
import { VIDEO_JUDGE_SCHEMA } from './video-benchmark-constants'
import type { JsonObject, VideoBenchmarkProvider, VideoCriterionScores, VideoEvaluation, VideoFileReference, VideoFrame } from '~/types'

const requireScore = (object: JsonObject, key: keyof VideoCriterionScores): number => {
  const value = getNumber(object, key)
  if (value === undefined || value < 1 || value > 10) {
    throw ValidationError(`OpenAI video judge response field ${key} must be a number from 1 through 10.`, { stage: 'benchmark:video-judge' })
  }
  return value
}

const parseVideoJudgeResponse = (
  rawText: string,
  video: VideoFileReference,
  durationSeconds: number,
  frames: VideoFrame[]
): VideoEvaluation => {
  const parsed = parseJsonObjectFromText(rawText, 'OpenAI video judge response was not a JSON object.')
  const criterionScores: VideoCriterionScores = {
    promptAdherence: requireScore(parsed, 'promptAdherence'),
    visualQuality: requireScore(parsed, 'visualQuality'),
    artifactControl: requireScore(parsed, 'artifactControl'),
    temporalConsistency: requireScore(parsed, 'temporalConsistency'),
    compositionCamera: requireScore(parsed, 'compositionCamera')
  }
  const averageScore10 = round2(average(Object.values(criterionScores)))
  const summary = getString(parsed, 'summary')
  if (!summary) {
    throw ValidationError('OpenAI video judge response field summary must be a non-empty string.', { stage: 'benchmark:video-judge' })
  }

  return {
    fileName: video.fileName,
    durationSeconds: round2(durationSeconds),
    frameCount: frames.length,
    frames,
    criterionScores,
    averageScore10,
    qualityScore: round2(averageScore10 * 10),
    summary,
    strengths: stringArray(parsed, 'strengths'),
    issues: stringArray(parsed, 'issues')
  }
}

const frameDataUrl = async (frame: VideoFrame): Promise<string> => {
  const bytes = await Bun.file(frame.path).arrayBuffer()
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
  'Score each criterion from 1 to 10, where 10 is excellent and 1 is unusable.',
  '',
  `Provider/model: ${provider.providerKey}`,
  `Video file: ${video.fileName}`,
  `Screenshots: ${frames.length} ordered frames sampled at midpoint intervals`,
  '',
  'Original generation prompt:',
  prompt,
  '',
  'Ordered frame timestamps:',
  ...frames.map((frame) => `- frame-${String(frame.index).padStart(2, '0')}: ${frame.timestampSeconds}s`),
  '',
  'Criteria:',
  '- promptAdherence: how completely the video follows the requested subject, actions, style, structure, and constraints.',
  '- visualQuality: overall aesthetic quality, clarity, lighting/color, and generation fidelity across frames.',
  '- artifactControl: absence of obvious distortions, malformed objects, noise, flicker, warping, or rendering errors.',
  '- temporalConsistency: consistency of subjects, identity, motion continuity, physics, and scene state across ordered frames.',
  '- compositionCamera: framing, camera movement/readability, layout, balance, and shot coherence.',
  '',
  'Return only the requested JSON.'
].join('\n')

export const judgeVideo = async (
  prompt: string,
  provider: VideoBenchmarkProvider,
  video: VideoFileReference,
  model: string,
  durationSeconds: number,
  frames: VideoFrame[]
): Promise<VideoEvaluation> => {
  const { rawText, usage } = await runOpenAIJudge(
    model,
    [
      {
        type: 'input_text',
        text: buildVideoJudgePrompt(prompt, provider, video, frames)
      },
      ...(await Promise.all(frames.map(async (frame) => ({
        type: 'input_image',
        image_url: await frameDataUrl(frame),
        detail: 'auto'
      }))))
    ],
    'video_quality_evaluation',
    VIDEO_JUDGE_SCHEMA,
    `OpenAI video judge returned no text for ${provider.providerKey} ${video.fileName}.`,
    'benchmark:video-judge'
  )

  const evaluation = parseVideoJudgeResponse(rawText, video, durationSeconds, frames)
  return {
    ...evaluation,
    ...(usage ? { usage } : {})
  }
}
