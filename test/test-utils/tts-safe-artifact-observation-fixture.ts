import type { TtsSerializedRequestObservation } from '~/types'

export const observationFor = (text: string): TtsSerializedRequestObservation => ({
  chunkIndex: 1,
  endpointKind: 'speech-synthesis',
  serializerVersion: 'openai.tts.phase-0-v1',
  serializedRequest: {
    body: {
      input: text,
      voice: 'alloy',
      response_format: 'wav'
    }
  },
  providerText: text,
  voiceField: 'voice',
  voices: [{ kind: 'provider-id', value: 'alloy' }],
  requestControls: { responseFormat: 'wav' },
  continuation: { kind: 'none' }
})
