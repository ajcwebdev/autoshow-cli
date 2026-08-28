import type { AuthoredSoundscapeCue, ComicDialoguePlan, ScenePromptData } from '~/types'

export type PanelSpeech = {
  panelNumber: number
  speechOrdinal: number
  speaker: ScenePromptData['panels'][number]['speech'][number]['speaker']
  line: string
}

export type PresentationSoundSource = {
  cue: AuthoredSoundscapeCue
  originalRangeMs: { start: number, end: number }
  sourceAudio: { path: string, sha256: string, durationMs: number }
}

export type ComicDialogueTurn = Extract<ComicDialoguePlan['nodes'][number], { kind: 'turn' }>['turn']

export type SpeechTextMatch = 'exact' | 'exact-after-source-cue-elision'
