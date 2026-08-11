import { describe, expect, test } from 'bun:test'
import {
  classifySttSplitLimitError,
  extractSttSplitDurationCapSecondsFromError,
  resolveAdaptiveSplitSegmentDurationMinutes,
  resolveSttSplitPolicy,
  resolveTranscriptionSplitDecision
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/orchestrator'
import { planAudioSplitSegments } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/audio-splitter'
import { resolveSplitSegmentOutputDir } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/run-stt/split-execution'
import type { SplitPolicyTarget } from '~/types'

const GROQ = {
  service: 'groq',
  model: 'whisper-large-v3-turbo'
} satisfies SplitPolicyTarget

const GLADIA = {
  service: 'gladia',
  model: 'solaria-1'
} satisfies SplitPolicyTarget

const expectValidSegmentPlan = (segments: ReturnType<typeof planAudioSplitSegments>): void => {
  for (const [index, segment] of segments.entries()) {
    expect(segment.durationSeconds).toBeGreaterThan(0)
    expect(segment.segmentNumber).toBe(index + 1)
    expect(segment.totalSegments).toBe(segments.length)

    if (index > 0) {
      expect(segment.startSeconds).toBeGreaterThan(segments[index - 1]!.startSeconds)
    }
  }
}

describe('STT split resilience contracts', () => {
  test('split segments isolate provider work directories by segment identity', () => {
    expect(resolveSplitSegmentOutputDir('/tmp/pass_001', 1)).toBe('/tmp/pass_001/segment-runs/segment_001')
    expect(resolveSplitSegmentOutputDir('/tmp/pass_001', 12)).toBe('/tmp/pass_001/segment-runs/segment_012')
  })

  test('audio split planning does not create a tail segment on exact duration boundaries', () => {
    const segments = planAudioSplitSegments(9000, 1800)

    expectValidSegmentPlan(segments)
    expect(segments).toHaveLength(5)
    expect(segments.map((segment) => segment.startSeconds)).toEqual([0, 1800, 3600, 5400, 7200])
    expect(segments.map((segment) => segment.durationSeconds)).toEqual([1800, 1800, 1800, 1800, 1800])
    expect(segments.map((segment) => segment.totalSegments)).toEqual([5, 5, 5, 5, 5])
  })

  test('audio split planning folds sub-second metadata residue into the previous segment', () => {
    const segments = planAudioSplitSegments(9000.04, 1800)
    const lastSegment = segments[segments.length - 1]!

    expectValidSegmentPlan(segments)
    expect(segments).toHaveLength(5)
    expect(segments.map((segment) => segment.startSeconds)).toEqual([0, 1800, 3600, 5400, 7200])
    expect(Math.abs(lastSegment.durationSeconds - 1800.04)).toBeLessThan(1e-9)
    expect(segments.some((segment) => segment.durationSeconds < 1)).toBe(false)
  })

  test('audio split planning preserves meaningful positive tail segments', () => {
    const segments = planAudioSplitSegments(9002, 1800)
    const lastSegment = segments[segments.length - 1]!

    expectValidSegmentPlan(segments)
    expect(segments).toHaveLength(6)
    expect(lastSegment.startSeconds).toBe(9000)
    expect(lastSegment.durationSeconds).toBe(2)
    expect(lastSegment.totalSegments).toBe(6)
  })

  test('byte-cap and hard duration-cap policies split for capacity-limited providers', () => {
    expect(resolveSttSplitPolicy(GROQ).requestBudgetSeconds).toBeUndefined()

    const byteDecision = resolveTranscriptionSplitDecision(GROQ, {
      audioFileSizeBytes: 100 * 1024 * 1024,
      audioDurationSeconds: 1800,
      splitRequested: false
    })
    expect(byteDecision.shouldSplit).toBe(true)
    expect(byteDecision.reasons.map((reason) => reason.kind)).toEqual(['attachment_cap'])
    expect(byteDecision.segmentDurationMinutes).toBeLessThan(30)

    const durationDecision = resolveTranscriptionSplitDecision(GLADIA, {
      audioFileSizeBytes: 10 * 1024 * 1024,
      audioDurationSeconds: 9000,
      splitRequested: false
    })
    expect(durationDecision.shouldSplit).toBe(true)
    expect(durationDecision.reasons.map((reason) => reason.kind)).toEqual(['duration_cap'])
  })

  test('payload-too-large errors are retryable with smaller split segments', () => {
    const error = new Error('AssemblyAI transcription failed (413): {"error":"file too large"}')
    const target = {
      service: 'assemblyai',
      model: 'universal-3-5-pro'
    } satisfies SplitPolicyTarget

    expect(classifySttSplitLimitError(target, error)).toEqual({ reason: 'attachment_cap' })
    expect(resolveAdaptiveSplitSegmentDurationMinutes(10, error)).toBe(5)
  })

  test('duration-limit errors expose the parsed cap for adaptive retries', () => {
    const error = new Error('transcription failed (400): audio duration 1500.0 seconds is longer than 1400 seconds which is the maximum for this model')

    expect(extractSttSplitDurationCapSecondsFromError(error)).toBe(1400)
    expect(classifySttSplitLimitError(GLADIA, error)).toEqual({
      reason: 'duration_cap',
      durationCapSeconds: 1400
    })
    expect(resolveAdaptiveSplitSegmentDurationMinutes(30, error)).toBe(23.317)
  })

  test('auth, quota, and non-limit 400 errors are not split retries', () => {
    const nonLimitErrors = [
      new Error('transcription failed (401): Incorrect API key provided.'),
      new Error('transcription failed (429): You exceeded your current quota, please check your plan and billing details.'),
      new Error('transcription failed (400): {"error":{"message":"Unsupported response_format","type":"invalid_request_error","param":"response_format"}}')
    ]

    for (const error of nonLimitErrors) {
      expect(classifySttSplitLimitError(GLADIA, error)).toBeUndefined()
    }
  })
})
