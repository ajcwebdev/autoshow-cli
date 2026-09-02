import type { AudioSegmentDescriptor } from '~/types'
import { exec, ensureDirectory } from '~/utils/cli-utils'
import { planNormalizedAudioArtifact, resolveSplitAudioPlan } from '~/cli/commands/process-steps/step-1-download/audio/audio-normalize'
import { logSttSplitSegments, logSttSplitSummary } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { getFfmpegBinary, getFfprobeBinary } from '~/utils/runtime-paths'
import { InfraError } from '~/utils/error-handler'

const MIN_MEANINGFUL_TAIL_SECONDS = 1

export const planAudioSplitSegments = (
  totalDurationSeconds: number,
  segmentDurationSeconds: number
): Array<Omit<AudioSegmentDescriptor, 'path'>> => {
  if (
    !Number.isFinite(totalDurationSeconds)
    || totalDurationSeconds <= 0
    || !Number.isFinite(segmentDurationSeconds)
    || segmentDurationSeconds <= 0
  ) {
    return []
  }

  const plannedSegments: Array<Pick<AudioSegmentDescriptor, 'startSeconds' | 'durationSeconds'>> = []
  let startSeconds = 0

  while (startSeconds < totalDurationSeconds) {
    const remainingSeconds = totalDurationSeconds - startSeconds
    if (remainingSeconds <= 0) {
      break
    }

    if (remainingSeconds <= segmentDurationSeconds) {
      plannedSegments.push({
        startSeconds,
        durationSeconds: remainingSeconds
      })
      break
    }

    const tailAfterSegmentSeconds = remainingSeconds - segmentDurationSeconds
    if (tailAfterSegmentSeconds > 0 && tailAfterSegmentSeconds < MIN_MEANINGFUL_TAIL_SECONDS) {
      plannedSegments.push({
        startSeconds,
        durationSeconds: remainingSeconds
      })
      break
    }

    plannedSegments.push({
      startSeconds,
      durationSeconds: segmentDurationSeconds
    })
    startSeconds += segmentDurationSeconds
  }

  const totalSegments = plannedSegments.length
  return plannedSegments.map((segment, index) => ({
    segmentNumber: index + 1,
    totalSegments,
    ...segment
  }))
}

export const splitAudioFile = async (audioPath: string, outputDir: string, segmentDurationMinutes: number = 10): Promise<AudioSegmentDescriptor[]> => {
  const segmentDurationSeconds = segmentDurationMinutes * 60
  const segmentsDir = `${outputDir}/segments`
  await ensureDirectory(segmentsDir)
  const { probe } = await planNormalizedAudioArtifact(audioPath)
  const splitPlan = resolveSplitAudioPlan(audioPath, probe)

  const durationResult = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ])

  const totalDuration = parseFloat(durationResult.stdout.trim())
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw InfraError(`Could not determine audio duration for splitting: ${audioPath}`, { stage: 'stt:audio-split' })
  }
  const plannedSegments = planAudioSplitSegments(totalDuration, segmentDurationSeconds)
  const totalSegments = plannedSegments.length
  if (totalSegments === 0) {
    throw InfraError(`Could not plan audio segments for splitting: ${audioPath}`, { stage: 'stt:audio-split' })
  }

  logSttSplitSummary( {
    input: audioPath,
    segmentDurationMinutes,
    totalDurationSeconds: totalDuration,
    totalSegments
  })

  const segmentDescriptors: AudioSegmentDescriptor[] = []

  for (let i = 0; i < plannedSegments.length; i++) {
    const segment = plannedSegments[i]!
    const segmentPath = `${segmentsDir}/segment_${String(i + 1).padStart(3, '0')}${splitPlan.outputExtension}`

    const ffmpegArgs = [
      '-i', audioPath,
      '-ss', String(segment.startSeconds),
      '-t', String(segment.durationSeconds),
      '-vn',
      '-map', '0:a:0'
    ]

    if (splitPlan.mode === 'copy-stream') {
      ffmpegArgs.push('-c:a', 'copy', '-f', splitPlan.outputFormat, '-y', segmentPath)
    } else {
      ffmpegArgs.push('-c:a', 'flac', '-compression_level', '12', '-y', segmentPath)
    }

    const result = await exec(getFfmpegBinary(), ffmpegArgs)

    if (result.exitCode !== 0) {
      throw InfraError(`Failed to create segment ${i + 1}`, {
        stage: 'stt:audio-split',
        metadata: { segmentNumber: i + 1, childExitCode: result.exitCode, stderr: result.stderr }
      })
    }

    segmentDescriptors.push({
      path: segmentPath,
      ...segment
    } satisfies AudioSegmentDescriptor)
  }

  logSttSplitSegments( segmentDescriptors)
  return segmentDescriptors
}

export const getAudioDuration = async (audioPath: string): Promise<number> => {
  const result = await exec(getFfprobeBinary(), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath
  ])

  return parseFloat(result.stdout.trim())
}
