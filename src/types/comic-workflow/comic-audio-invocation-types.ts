import type { ComicAudioDeliveryPolicy, ComicAudioMode, ComicAudioPacingProfile, ComicAudioRolePolicy, ComicAudioSoundscapeTimingPolicy, TtsOptions } from '~/types'

export type ResolvedComicAudioInvocation = {
  profileKey: string
  mode: ComicAudioMode
  deliveryPolicy: ComicAudioDeliveryPolicy
  pacingProfile: ComicAudioPacingProfile
  soundscapeTimingPolicy: ComicAudioSoundscapeTimingPolicy
  rolePolicies: ComicAudioRolePolicy[]
  sampleRate: number
  channels: 1 | 2
  codec: 'pcm_s16le' | 'pcm_s24le'
  price: boolean
  allowAmbiguousRedispatch: boolean
  maxGenerationSlots: number | undefined
  sfxSelector: string | undefined
  sfxLicenseUseClassification: ReturnType<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/comic-soundscape-workflow').parseSoundEffectLicenseUseClassification>
  sfxConcurrency: number
  presentationRequested: boolean
  baseOptions: TtsOptions
  compatible: Awaited<ReturnType<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/compatible-scene-run').resolveCompatibleComicSceneRun>>
  dialoguePlan: ReturnType<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/comic-dialogue-plan').createComicDialoguePlan>
}
