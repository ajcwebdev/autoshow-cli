import type { SttTarget } from '~/types'
import { ensureProviderReady } from '~/utils/bootstrap-broker'
import { UsageError } from '~/utils/error-handler'
import { getStep2BootstrapProviderId } from '../step-2-shared/provider-registry'

export {
  downloadWhisperModel
} from './stt-local/whisper/whisper'

const toBootstrapProviderId = (
  target: Pick<SttTarget, 'service' | 'model'>
): string => {
  switch (target.service) {
    case 'whisper':
      return `whisper:${target.model}`
    case 'whisperfile':
      return `whisperfile:${target.model}`
    case 'deepinfra':
    case 'deepgram':
    case 'soniox':
    case 'speechmatics':
    case 'groq':
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
