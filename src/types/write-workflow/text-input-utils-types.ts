import type { LeafPrompt } from '~/types';

export type PromptFileResult =
  | { kind: 'text'; text: string }
  | { kind: 'leaf'; name: string; leaf: LeafPrompt }


export type TextInputTrackResolution = {
  trackNumber: string | undefined
  title: string
  hasTrackTitle: boolean
}

export type RenderedTextArtifactResult = {
  internalArtifacts: Record<string, string>
  externalFiles: string[]
}

export type WriteTextProjectDefaults = {
  projectDir: string
  projectName: string
  textDir: string
  lyricsDir: string
  promptFile: string
  trackList?: string | undefined
  renderedOutDir: string
}
