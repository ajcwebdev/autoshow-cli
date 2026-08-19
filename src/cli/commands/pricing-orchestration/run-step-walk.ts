import type {
  ClassifiedStep2,
  ExtractionMetadata,
  RunStepInput,
  RunStepVisitors,
  Step2Metadata
} from '~/types'
import { toArray } from '~/utils/text-utils'

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isTranscriptionMetadata = (value: unknown): value is Step2Metadata =>
  isRecord(value) && 'transcriptionService' in value

const isExtractionMetadata = (value: unknown): value is ExtractionMetadata =>
  isRecord(value) && 'extractionMethod' in value

const classifyStep2 = (value: unknown): ClassifiedStep2 | undefined => {
  const isTranscription = isTranscriptionMetadata(value)
  const isExtraction = isExtractionMetadata(value)
  if (isTranscription === isExtraction) {
    return undefined
  }
  if (isTranscriptionMetadata(value)) {
    return { kind: 'stt', metadata: value }
  }
  if (isExtractionMetadata(value)) {
    return { kind: 'extract', metadata: value }
  }
  return undefined
}

export const resolveTranscriptionModel = (metadata: Step2Metadata): string => {
  if (metadata.transcriptionService !== 'whisper') {
    return metadata.transcriptionModel
  }
  const match = metadata.transcriptionModel.match(WHISPER_MODEL_PATH_PATTERN)
  if (match && typeof match[1] === 'string' && match[1].length > 0) {
    return match[1]
  }
  return metadata.transcriptionModel
}

const visitStep2 = (
  entries: ClassifiedStep2[],
  visitors: RunStepVisitors
): void => {
  for (const entry of entries) {
    if (entry.kind === 'stt') {
      visitors.stt(entry.metadata, resolveTranscriptionModel(entry.metadata))
    } else {
      visitors.extract(entry.metadata)
    }
  }
}

export const walkRunSteps = (
  input: RunStepInput,
  options: {
    partialStep2Order: 'after-step2' | 'before-array-stt'
    visitors: RunStepVisitors
  }
): void => {
  const step2Entries = toArray(input.step2).flatMap((entry) => {
    const classified = classifyStep2(entry)
    return classified ? [classified] : []
  })
  const partialStep2Entries = toArray(input.partialStep2)
  const partialBeforeStep2 = options.partialStep2Order === 'before-array-stt'
    && Array.isArray(input.step2)
    && step2Entries.length > 0
    && step2Entries.every(entry => entry.kind === 'stt')

  if (partialBeforeStep2) {
    for (const entry of partialStep2Entries) options.visitors.partialExtract(entry)
  }
  visitStep2(step2Entries, options.visitors)
  if (!partialBeforeStep2) {
    for (const entry of partialStep2Entries) options.visitors.partialExtract(entry)
  }

  for (const entry of toArray(input.step3)) options.visitors.llm(entry)
  if (typeof input.ttsCharacterCount === 'number') {
    for (const entry of toArray(input.step4)) options.visitors.tts(entry, input.ttsCharacterCount)
  }
  for (const entry of toArray(input.step5)) options.visitors.image(entry)
  for (const entry of toArray(input.step6)) options.visitors.video(entry)
  for (const entry of toArray(input.step7)) options.visitors.music(entry)
}
