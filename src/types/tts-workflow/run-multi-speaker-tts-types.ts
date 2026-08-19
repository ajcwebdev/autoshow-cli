import type {
  CurrentTtsObservedTurn,
  Step4Metadata,
} from '~/types'

export type MultiSpeakerRunMetadata = Step4Metadata & {
  _ttsObservedTurns: CurrentTtsObservedTurn[]
  _ttsRenderStrategy: 'native-dialogue' | 'native-utterances' | 'segmented'
}
