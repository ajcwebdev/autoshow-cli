import type { SttTarget } from '~/types'
import { ensureProviderReady } from '~/utils/bootstrap-broker'
import { UsageError } from '~/utils/error-handler'
import { getStep2BootstrapProviderId } from '../command-shared/extract-routing/provider-registry'


const toBootstrapProviderId = (
  target: Pick<SttTarget, 'service' | 'model'>
): string => {
  switch (target.service) {
    case 'whisperfile':
      return `whisperfile:${target.model}`
    case 'deepinfra':
    case 'deepgram':
    case 'soniox':
    case 'speechmatics':
    case 'grok':
    case 'mistral':
    case 'assemblyai':
    case 'gladia':
    case 'happyscribe':
    case 'supadata':
    case 'scrapecreators':
    case 'gemini-stt':
    case 'together':
      return getStep2BootstrapProviderId('stt', target.service) ?? ''
    case 'youtube-captions':
      return ''
    case 'rev':
      throw UsageError('Rev STT is retired and cannot dispatch. Start a new target with an active STT provider.')
  }
}

export const ensureSttTargetSetup = async (
  target: Pick<SttTarget, 'service' | 'model'>
): Promise<void> => {
  if (target.service === 'youtube-captions') {
    return
  }

  await ensureProviderReady(toBootstrapProviderId(target))
}
