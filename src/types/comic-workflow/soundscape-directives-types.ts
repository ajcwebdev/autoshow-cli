export type DirectiveKind = 'action-sfx' | 'vocal-reaction' | 'ambience'

export type AmbientRangeBound = 'scene-start' | 'scene-end' | 'previous-line-end' | 'next-line-start'

export type LocatedDirective = {
  kind: DirectiveKind
  prompt: string
  required: boolean
  durationSeconds?: number | undefined
  gainDb?: number | undefined
  pan?: number | undefined
  rangeFrom?: AmbientRangeBound | undefined
  rangeTo?: AmbientRangeBound | undefined
  startUtf16: number
  endUtf16: number
  inline: boolean
}

export type DirectiveControls = Pick<LocatedDirective, 'durationSeconds' | 'gainDb' | 'pan' | 'rangeFrom' | 'rangeTo'>
