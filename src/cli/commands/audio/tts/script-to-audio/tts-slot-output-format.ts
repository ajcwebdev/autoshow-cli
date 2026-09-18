import type { CreateCurrentTtsRenderAttemptOptions, RequestedAudioFormat } from '~/types'
import { REQUESTED_OUTPUT } from './attempt-shared'

// Paid slot identity predates delivery mastering: purchased provider audio is retained
// as native bytes, so the locally mastered format must never reach the slot hash.
export const paidSlotOutputFormat = (options: Pick<CreateCurrentTtsRenderAttemptOptions, 'ttsOptions'>): RequestedAudioFormat => options.ttsOptions.ttsMasteringProfile
  ? {
      codec: options.ttsOptions.ttsMasteringProfile.codec,
      container: options.ttsOptions.ttsMasteringProfile.container,
      sampleRate: options.ttsOptions.ttsMasteringProfile.sampleRate,
      channels: options.ttsOptions.ttsMasteringProfile.channels,
    }
  : REQUESTED_OUTPUT

export const slotOutputFormatOfPlan = (requestedOutput: RequestedAudioFormat): RequestedAudioFormat =>
  'delivery' in requestedOutput && requestedOutput.delivery !== undefined ? REQUESTED_OUTPUT : requestedOutput
