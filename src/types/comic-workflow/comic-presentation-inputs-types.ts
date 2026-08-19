import type { ArtifactRef, AudioRun, ComicPresentationAmbienceInput, ComicPresentationPanelInput, CompactMix, CompactMixTimelineSummary, CompactSfx, CompatibleComicSceneRun, FinalTimeline, ObservedAudioFormat, PresentationSoundSource, ScenePromptData, SoundscapePlan } from '~/types'

export type PresentationVisualInputs = {
  scene: ScenePromptData
  sceneRef: ArtifactRef
  panels: ComicPresentationPanelInput[]
  sourceDir: string
  imported: boolean
}

export type LoadedPresentationAudio = {
  kind: 'dialogue' | 'soundscape'
  targetKey: string
  provider: string
  model: string
  dialogueBinding: NonNullable<CompatibleComicSceneRun['comicMetadata']['audio']['selectedAudioRuns']>[number]
  dialogueAudioRun: AudioRun
  dialogueTimeline: FinalTimeline
  dialogueAudio: { path: string, sha256: string, format: ObservedAudioFormat, durationMs: number }
  soundscapeBinding?: NonNullable<CompatibleComicSceneRun['comicMetadata']['audio']['selectedSoundscapeRuns']>[number] | undefined
  soundscapeAudioRun?: CompactMix | undefined
  soundscapePlan?: SoundscapePlan | undefined
  soundscapeTimeline?: CompactMixTimelineSummary | undefined
  renderResult?: CompactSfx | undefined
  sounds: PresentationSoundSource[]
  ambience: ComicPresentationAmbienceInput[]
}
