import type { CanonicalAudioProviderProjection, PipelineProviderState, PureCurrentTtsRenderPlanOptions, TtsOptions } from '~/types'
import { planCurrentTtsRenderIdentity, readAudioProjection } from './attempt-planning'
import { restoreSharedTtsResumeOptions } from '../tts-utils/tts-resume-options'

type RetainedTtsWork = NonNullable<CanonicalAudioProviderProjection['activeWork'] | CanonicalAudioProviderProjection['selectedSuccess']>

const adoptChunkPlanIfExact = (
  options: PureCurrentTtsRenderPlanOptions,
  retained: RetainedTtsWork,
  chunking: TtsOptions['ttsChunking'],
  accounting: true | undefined
): boolean => {
  try {
    const plan = planCurrentTtsRenderIdentity({ ...options, ttsOptions: { ...options.ttsOptions, ttsChunking: chunking, ttsOpenAIAccountingReplay: accounting } })
    const matches = 'branchPlanId' in retained ? retained.branchPlanId === plan.branchPlanId : 'renderIdentity' in retained && retained.renderIdentity === plan.renderIdentity
    if (matches) {
      options.ttsOptions.ttsChunking = chunking
      options.ttsOptions.ttsOpenAIAccountingReplay = accounting
      return true
    }
  } catch {
    // An obsolete policy may not support new controls. It cannot establish replay authority.
  }
  return false
}

// Comic reruns may also be new edits. Adopt compatibility chunking only when it
// reproduces the retained branch/render exactly; new content keeps the smart default.
export const adoptExactRetainedTtsChunkPlan = (options: PureCurrentTtsRenderPlanOptions, state?: PipelineProviderState): void => {
  delete options.ttsOptions.ttsOpenAIAccountingReplay
  if (!state) return
  const projection = readAudioProjection(state)
  const retained = projection?.activeWork ?? projection?.selectedSuccess
  if (!retained) return
  const saved: TtsOptions = {}
  restoreSharedTtsResumeOptions(saved, state.settings)
  const candidates = [options.ttsOptions.ttsChunking, saved.ttsChunking, { boundary: 'smart' as const, replay: 'legacy-v0' as const }, { boundary: 'smart' as const, replay: 'smart-v1' as const }]
  const accountingModes = options.target.service === 'openai' ? [undefined, true as const] : [undefined]
  for (const accounting of accountingModes) for (const chunking of candidates) {
    if (adoptChunkPlanIfExact(options, retained, chunking, accounting)) return
  }
}
