import type { MultiSpeakerStrategy, TtsProvider, TtsTargetInvocation, TtsTargetVoiceSource } from '~/types'
import { UsageError } from '~/utils/error-handler'

const MULTI_SPEAKER_CAPABILITY: Partial<Record<TtsProvider, MultiSpeakerStrategy>> = {
  openai: 'segment-and-concat',
  elevenlabs: 'segment-and-concat',
  minimax: 'segment-and-concat',
  grok: 'segment-and-concat',
  mistral: 'segment-and-concat',
  speechify: 'segment-and-concat',
  hume: 'segment-and-concat',
  cartesia: 'segment-and-concat',
  inworld: 'segment-and-concat',
}

const REF_AUDIO_PROVIDERS = new Set<TtsProvider>(['mistral'])

export const getMultiSpeakerStrategy = (
  provider: TtsProvider,
  model?: string | undefined
): MultiSpeakerStrategy | undefined => {
  if (provider === 'elevenlabs' && model === 'eleven_v3') return 'native'
  if (provider === 'hume' && model === 'octave-2') return 'native'
  return MULTI_SPEAKER_CAPABILITY[provider]
}

const supportsRefAudioMultiSpeaker = (provider: TtsProvider): boolean =>
  REF_AUDIO_PROVIDERS.has(provider)

export const resolveTtsTargetInvocationVoice = (
  service: TtsProvider,
  invocation: TtsTargetInvocation | undefined
): TtsTargetVoiceSource | undefined => {
  const voice = invocation?.voice
  if (voice?.kind === 'ref-audio' && !supportsRefAudioMultiSpeaker(service)) {
    throw UsageError(
      `Provider ${service} does not support reference audio for explicit multi-speaker TTS invocation.`
    )
  }
  return voice
}

export const resolveTtsTargetInvocationVoiceId = (
  service: TtsProvider,
  invocation: TtsTargetInvocation | undefined
): string | undefined => {
  const voice = resolveTtsTargetInvocationVoice(service, invocation)
  return voice?.kind === 'id' ? voice.value : undefined
}
