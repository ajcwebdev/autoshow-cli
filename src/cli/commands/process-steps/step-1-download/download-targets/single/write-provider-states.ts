import { getSttTargetDirectoryName, getSttTargetKey } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { YOUTUBE_CAPTIONS_SERVICE } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import type { BuildWriteSttProviderStatesContext, ProviderCompletionStatus, SttProviderSuccess, SttTarget, WriteSttFailure } from '~/types'

const toRequestedProvider = (
  target: Pick<SttTarget, 'service' | 'model'>
): { service: string, model: string } => ({
  service: target.service,
  model: target.model
})

const resolveWriteSttCompletionStatus = (
  requestedTargets: SttTarget[],
  successes: SttProviderSuccess[]
): ProviderCompletionStatus => {
  if (successes.length === 0) {
    return 'failed'
  }

  return successes.length === requestedTargets.length ? 'full' : 'incomplete'
}

export const buildWriteSttProviderStates = (ctx: BuildWriteSttProviderStatesContext) => {
  const { sttTargets, successfulSttProviders, sttFailures } = ctx

  const captionOnly = successfulSttProviders.length > 0
    && successfulSttProviders.every((entry) => entry.target.service === YOUTUBE_CAPTIONS_SERVICE)
  const requestedSttTargets = captionOnly
    ? successfulSttProviders.map((entry) => entry.target)
    : sttTargets
  const successfulKeys = new Set(successfulSttProviders.map((entry) => getSttTargetKey(entry.target)))
  const failureByKey = new Map<string, WriteSttFailure>(
    sttFailures.map((failure) => [`${failure.service}:${failure.model}`, failure])
  )
  const providerStates = requestedSttTargets.map((target) => {
    const success = successfulSttProviders.find((entry) => getSttTargetKey(entry.target) === getSttTargetKey(target))
    if (success) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: success.relativeDir ?? '.',
        status: 'succeeded',
        attempts: 1
      }
    }

    const failure = failureByKey.get(getSttTargetKey(target))
    if (failure) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: target.service === YOUTUBE_CAPTIONS_SERVICE ? '.' : `providers/${getSttTargetDirectoryName(target)}`,
        status: failure.skipped === true ? 'skipped' : 'failed',
        attempts: 1,
        lastError: {
          message: failure.message,
          ...(failure.skipped === true ? { skipped: true } : {}),
          ...(failure.stage ? { stage: failure.stage } : {}),
          ...(typeof failure.status === 'number' ? { status: failure.status } : {})
        }
      }
    }

    return {
      service: target.service,
      model: target.model,
      local: target.local,
      artifactDir: target.service === YOUTUBE_CAPTIONS_SERVICE ? '.' : `providers/${getSttTargetDirectoryName(target)}`,
      status: 'missing',
      attempts: 0
    }
  })
  const completionStatus = resolveWriteSttCompletionStatus(requestedSttTargets, successfulSttProviders)
  const missingProviders = requestedSttTargets
    .filter((target) => !successfulKeys.has(getSttTargetKey(target)))
    .map(toRequestedProvider)

  return {
    completionStatus,
    requestedProviders: requestedSttTargets.map(toRequestedProvider),
    providerStates,
    missingProviders
  }
}
