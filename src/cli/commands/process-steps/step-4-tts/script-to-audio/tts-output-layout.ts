import { CLIUsageError } from '~/utils/error-handler'

export type TtsOutputLayout = {
  mediaRoot: string
  artifactDir: string
  workDir: string
  slotsDir: string
  journalPath: string
  attemptJsonPath: string
  renderPlanPath: string
  archiveRenderPath: string
  archiveTimelinePath: string
  slotWavPath: (slotHash: string) => string
  slotResultPath: (slotHash: string) => string
}

const joinMedia = (mediaRoot: string, ...parts: string[]): string => {
  const prefix = mediaRoot ? `${mediaRoot}/` : ''
  return `${prefix}${parts.join('/')}`
}

export const resolveTtsOutputLayout = (
  artifactRoot: string,
  targetKey: string,
  renderIdentity: string
): TtsOutputLayout => {
  const normalized = artifactRoot.replace(/\/+$/, '')
  if (!normalized || normalized.includes('\\') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw CLIUsageError(`Invalid TTS provider artifact root: ${artifactRoot}`)
  }
  const mediaRoot = normalized.replace(/\/?providers$/, '')
  const workDir = joinMedia(mediaRoot, 'work', targetKey, renderIdentity)
  const artifactDir = joinMedia(mediaRoot, targetKey)
  const slotsDir = joinMedia(mediaRoot, 'slots')
  return {
    mediaRoot,
    artifactDir,
    workDir,
    slotsDir,
    journalPath: `${workDir}/journal.jsonl`,
    attemptJsonPath: `${workDir}/attempt.json`,
    renderPlanPath: `${workDir}/render-plan.json`,
    archiveRenderPath: `${artifactDir}/render.json`,
    archiveTimelinePath: `${artifactDir}/timeline.json`,
    slotWavPath: (slotHash) => `${slotsDir}/${slotHash}.wav`,
    slotResultPath: (slotHash) => `${workDir}/slots/${slotHash}/result.json`,
  }
}
