export type LyricsRenderSummary = {
  encoder: string
  backgroundMode: 'image' | 'spectrogram'
}

export type AssStyle = {
  name: string
  fontSize: number
  primaryColor: string
  bold: boolean
  outline: number
  shadow: number
  alignment: number
}

export type AssTheme = {
  horizontalMarginRatio: number
  verticalMarginRatio: number
  styles: (height: number) => AssStyle[]
  title: { style: string, layer: number, yRatio: number }
  cue: {
    activeStyle: string
    contextStyle: string
    activeLayer: number
    previousLayer: number
    nextLayer: number
    centerYRatio: number
    lineSpacingRatio: number
    colorActiveBySpeaker?: boolean | undefined
  }
}

export type LyricsVideoOverlaySource =
  | { kind: 'ass', path: string }
  | { kind: 'frames', path: string }
