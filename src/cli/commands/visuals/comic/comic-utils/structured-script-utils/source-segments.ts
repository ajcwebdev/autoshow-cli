import type { StructuredScriptBeat, StructuredScriptSourceSegment } from '~/types'

const SOURCE_SEGMENT_TEXT_TARGET_LENGTH = 320

const formatSourceSegmentId = (
  beatIndex: number,
  partIndex: number,
  partCount: number
): string => {
  const beatLabel = String(beatIndex).padStart(4, '0')
  if (partCount === 1) {
    return `beat-${beatLabel}`
  }

  return `beat-${beatLabel}-${String(partIndex).padStart(2, '0')}`
}

const splitSentenceUnits = (text: string): string[] => {
  const matches = Array.from(text.matchAll(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g))
    .map(match => match[0].trim())
    .filter(match => match.length > 0)

  if (matches.length <= 1) {
    return [text]
  }

  const reconstructed = matches.join(' ').replace(/\s+/g, ' ').trim()
  return reconstructed === text ? matches : [text]
}

const splitSourceSegmentText = (
  beat: StructuredScriptBeat
): string[] => {
  if (beat.type === 'dialogue' || beat.text.length <= SOURCE_SEGMENT_TEXT_TARGET_LENGTH) {
    return [beat.text]
  }

  const sentenceUnits = splitSentenceUnits(beat.text)
  if (sentenceUnits.length <= 1) {
    return [beat.text]
  }

  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentenceUnits) {
    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence
    if (candidate.length <= SOURCE_SEGMENT_TEXT_TARGET_LENGTH || !currentChunk) {
      currentChunk = candidate
      continue
    }

    chunks.push(currentChunk)
    currentChunk = sentence
  }

  if (currentChunk) {
    chunks.push(currentChunk)
  }

  const reconstructed = chunks.join(' ').replace(/\s+/g, ' ').trim()
  return reconstructed === beat.text ? chunks : [beat.text]
}

const buildSourceSegmentRawMarkdown = (
  beat: StructuredScriptBeat,
  text: string
): string => {
  if (beat.type === 'dialogue') {
    return [
      ...(beat.speakerLabel ? [`**${beat.speakerLabel}**`] : []),
      ...(beat.delivery ? [`(${beat.delivery})`] : []),
      text,
    ].join('\n')
  }

  if (beat.type === 'panel-note') {
    return `[${text}]`
  }

  return text
}

export const buildSourceSegmentsFromBeats = (
  beats: StructuredScriptBeat[]
): StructuredScriptSourceSegment[] => {
  return beats.flatMap(beat => {
    const parts = splitSourceSegmentText(beat)

    return parts.map((text, index) => ({
      id: formatSourceSegmentId(beat.index, index + 1, parts.length),
      type: beat.type,
      text,
      rawMarkdown: buildSourceSegmentRawMarkdown(beat, text),
      beatIndex: beat.index,
      ...(beat.speakerKey ? { speakerKey: beat.speakerKey } : {}),
      ...(beat.speakerLabel ? { speakerLabel: beat.speakerLabel } : {}),
      ...(beat.delivery ? { delivery: beat.delivery } : {}),
      ...(beat.speakerKeys ? { speakerKeys: beat.speakerKeys } : {}),
      sourceSpans: beat.sourceSpans,
      location: beat.location,
    }))
  })
}
