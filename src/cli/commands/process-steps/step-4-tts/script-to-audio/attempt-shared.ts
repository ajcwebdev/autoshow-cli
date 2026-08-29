import type { TtsTarget } from '~/types'
import { hashCanonicalTtsValue } from './contract-identity'

export const SCHEMA_VERSION = 'phase-0-v1'
export const PREPARATION_VERSION = 'generic-tts-v1'
export const EPOCH = new Date(0).toISOString()
export const CAPABILITY_CHECKED_AT = '2026-08-11T00:00:00.000Z'
export const LOCAL_ACTOR = { namespace: 'local-user' as const, actorId: 'current-cli-user' }
export const REQUESTED_OUTPUT = { codec: 'pcm_s16le', container: 'wav', sampleRate: 16000, channels: 1 }

export const CAPABILITY_SOURCE_REFS: Record<TtsTarget['service'], string[]> = {
  openai: ['https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create'],
  mistral: ['https://docs.mistral.ai/studio-api/audio/text_to_speech/speech'],
  grok: ['https://docs.x.ai/developers/model-capabilities/audio/text-to-speech'],
  elevenlabs: ['https://elevenlabs.io/docs/overview/capabilities/text-to-speech'],
  speechify: ['https://docs.sws.speechify.com/tts/text-to-speech/get-started/models'],
  hume: ['https://dev.hume.ai/reference/text-to-speech-tts/synthesize-json'],
  cartesia: ['https://docs.cartesia.ai/build-with-cartesia/tts-models/sonic-3-5'],
  minimax: ['https://platform.minimax.io/docs/api-reference/api-overview'],
  fish: ['https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech'],
  inworld: ['https://docs.inworld.ai/'],
  deepinfra: ['https://docs.deepinfra.com/apis/text-to-speech'],
}

export const withIdentity = <T extends Record<string, unknown>, K extends string>(value: T, field: K): T & Record<K, string> =>
  ({ ...value, [field]: hashCanonicalTtsValue(value) }) as T & Record<K, string>
