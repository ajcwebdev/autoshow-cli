export type RecapMontageSceneEntry = {
  scriptPath: string
  sceneTitle: string
  location: string
  characterKeys: string[]
  visualBeats: string[]
}

export type RecapMontageExpansion = {
  sourceSegmentId: string
  sourceSegmentIds: string[]
  beatIndex: number
  cueText: string
  previousEpisodeDirectory: string
  priorScenes: RecapMontageSceneEntry[]
}
