import type { CharacterKey, StructuredScriptBeat, StructuredScriptData, StructuredScriptSourceSegment } from '~/types'
import { isParentheticalBlock, trimParenthetical } from './markdown-blocks'
import { uniqueCharacters } from './character-detection'
import { buildSourceSegmentsFromBeats } from './source-segments'

const inferStandaloneDirectionSpeakerContext = (
  beats: StructuredScriptBeat[],
  index: number
): { speakerKey?: CharacterKey; speakerLabel?: string } => {
  const previousBeat = beats[index - 1]
  const nextBeat = beats[index + 1]

  if (
    previousBeat?.type === 'dialogue'
    && nextBeat?.type === 'dialogue'
    && previousBeat.speakerKey
    && nextBeat.speakerKey
    && previousBeat.speakerKey === nextBeat.speakerKey
  ) {
    return {
      speakerKey: previousBeat.speakerKey,
      ...(previousBeat.speakerLabel
        ? { speakerLabel: previousBeat.speakerLabel }
        : nextBeat.speakerLabel
          ? { speakerLabel: nextBeat.speakerLabel }
          : {}),
    }
  }

  return {}
}

const canonicalizeBeat = (
  beat: StructuredScriptBeat,
  beats: StructuredScriptBeat[],
  index: number
): StructuredScriptBeat => {
  if (beat.type !== 'direction' || !isParentheticalBlock(beat.text)) {
    return beat
  }

  const inferredSpeaker = beat.speakerKey
    ? {
        speakerKey: beat.speakerKey,
        ...(beat.speakerLabel ? { speakerLabel: beat.speakerLabel } : {}),
      }
    : inferStandaloneDirectionSpeakerContext(beats, index)

  return {
    ...beat,
    text: trimParenthetical(beat.text),
    ...inferredSpeaker,
  }
}

export const normalizeStructuredScriptData = (
  data: StructuredScriptData,
  options: {
    scriptSlug: string
    sourceFile: string
    sourceIdentity?: StructuredScriptData['sourceIdentity']
    sourceSegments?: StructuredScriptSourceSegment[]
    beatLocations?: StructuredScriptBeat['location'][]
    sceneLocation?: StructuredScriptData['scene']['location']
    sceneSoundscape?: StructuredScriptData['scene']['soundscape']
  }
): StructuredScriptData => {
  const beats = data.beats.map((beat, index) => {
    const canonicalBeat = canonicalizeBeat(beat, data.beats, index)
    const rawMentions = canonicalBeat.rawMentions.map(mention => ({
      ...mention,
      characterKeys: uniqueCharacters(mention.characterKeys),
    }))

    const characterKeys = uniqueCharacters([
      ...canonicalBeat.characterKeys,
      ...rawMentions.flatMap(mention => mention.characterKeys),
      ...(canonicalBeat.speakerKey ? [canonicalBeat.speakerKey] : []),
    ])

    return {
      ...canonicalBeat,
      index: index + 1,
      ...(options.beatLocations?.[index] ? { location: options.beatLocations[index]! } : {}),
      characterKeys,
      rawMentions,
    }
  })

  const characterKeys = uniqueCharacters(
    beats.flatMap(beat => [
      ...beat.characterKeys,
      ...beat.rawMentions.flatMap(mention => mention.characterKeys),
      ...(beat.speakerKey ? [beat.speakerKey] : []),
    ])
  )

  return {
    ...data,
    ...(options.sceneLocation || options.sceneSoundscape ? { scene: { ...data.scene, ...(options.sceneLocation ? { location: options.sceneLocation } : {}), ...(options.sceneSoundscape ? { soundscape: options.sceneSoundscape } : {}) } } : {}),
    scriptSlug: options.scriptSlug,
    sourceFile: options.sourceFile,
    ...(options.sourceIdentity ? { sourceIdentity: options.sourceIdentity } : {}),
    characterKeys,
    beats,
    sourceSegments: options.sourceSegments ?? buildSourceSegmentsFromBeats(beats),
  }
}
