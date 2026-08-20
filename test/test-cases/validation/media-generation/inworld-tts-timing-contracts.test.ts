import type { NormalizedTiming, TtsRequestEvidenceScope, TtsSerializedRequestObservation } from '~/types'
import { describe, expect, test } from 'bun:test'
import { buildInworldTtsRequestBody, INWORLD_TTS_SERIALIZER_VERSION, normalizeInworldTimestampInfo } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/inworld-tts-request'
import { parseInworldMarkups, runInworldTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/inworld/run-inworld-tts'
import { createMockWavBase64 } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['INWORLD_API_KEY'],
  tempPrefix: 'autoshow-inworld-timing-'
})

describe('Inworld REST timing contracts', () => {
  test('serializes documented WAV timestamps and TTS-2 instruction without detached markups', () => {
    const text = 'Speak warmly [laugh] then [clear throat].'
    expect(parseInworldMarkups(text)).toEqual({ sanitizedText: text, markups: ['laugh', 'clear throat'] })
    expect(INWORLD_TTS_SERIALIZER_VERSION).toBe('inworld.tts.phase-3-v3')
    expect(buildInworldTtsRequestBody({ model: 'realtime-tts-2', text, voiceId: 'Dennis', steeringPrompt: 'Sound reassuring' })).toEqual({
      text,
      voiceId: 'Dennis',
      modelId: 'inworld-tts-2',
      timestampType: 'WORD',
      audioConfig: { audioEncoding: 'WAV', sampleRateHertz: 48000 },
      instruction: 'Sound reassuring'
    })
  })

  test('normalizes words and phones with Unicode-scalar canonical offsets', () => {
    const timing = normalizeInworldTimestampInfo({
      text: 'Hi 😀 [laugh]',
      identity: { turnId: 'turn-1', subjectKey: 'host' },
      timestampInfo: {
        wordAlignment: {
          words: ['Hi', ' ', '😀', ' ', '[laugh]'],
          wordStartTimeSeconds: [0, 0.1, 0.12, 0.2, 0.22],
          wordEndTimeSeconds: [0.1, 0.12, 0.2, 0.22, 0.5],
          phoneticDetails: [{ wordIndex: 0, phones: [{ phoneSymbol: 'h', startTimeSeconds: 0, durationSeconds: 0.04, visemeSymbol: 'sil' }] }]
        }
      }
    })
    expect(timing).toMatchObject({
      availability: 'timed',
      clock: 'take-audio-ms',
      provenance: 'provider-alignment',
      turns: [{ turnId: 'turn-1', subjectKey: 'host', startMs: 0, endMs: 500 }],
      phonemes: [{ turnId: 'turn-1', subjectKey: 'host', text: 'h', startMs: 0, endMs: 40, visemeSymbol: 'sil' }]
    })
    expect(timing.availability === 'timed' ? timing.words?.map(word => [word.text, word.canonicalStart, word.canonicalEnd]) : []).toEqual([
      ['Hi', 0, 2], [' ', 2, 3], ['😀', 3, 4], [' ', 4, 5], ['[laugh]', 5, 12]
    ])
  })

  test('passes mocked response alignment through output evidence with the planned identity', async () => {
    const root = await tempDirs.make()
    const observations: TtsSerializedRequestObservation[] = []
    const timings: Array<NormalizedTiming<'take-audio-ms'>> = []
    const evidence: TtsRequestEvidenceScope = {
      dispatch: async (observation, _attempt, operation) => {
        observations.push(observation)
        return await operation({ accepted: async () => {} })
      },
      recordOutput: async output => {
        if (output.timingFactory) timings.push(output.timingFactory({ turnId: 'turn-7', subjectKey: 'narrator' }))
      },
      complete: async () => {}
    }
    const calls = installMockFetch(() => Response.json({
      audioContent: createMockWavBase64({ samples: 800 }),
      timestampInfo: {
        wordAlignment: {
          words: ['Hello', ' ', '[sigh]', ' ', 'world'],
          wordStartTimeSeconds: [0, 0.04, 0.05, 0.08, 0.09],
          wordEndTimeSeconds: [0.04, 0.05, 0.08, 0.09, 0.1],
          phoneticDetails: []
        }
      }
    }))

    const result = await runInworldTts('Hello [sigh] world', root, {
      model: 'realtime-tts-2',
      apiKey: 'local-test-key',
      voiceId: 'Dennis',
      steeringPrompt: 'Sound tired',
      requestEvidence: evidence
    })
    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls[0]?.bodyJson).toMatchObject({ text: 'Hello [sigh] world', instruction: 'Sound tired', timestampType: 'WORD' })
    expect(calls[0]?.bodyJson).not.toHaveProperty('steering_prompt')
    expect(calls[0]?.bodyJson).not.toHaveProperty('markups')
    expect(observations[0]).toMatchObject({ serializerVersion: 'inworld.tts.phase-3-v3', providerText: 'Hello [sigh] world' })
    expect(timings[0]).toMatchObject({ availability: 'timed', turns: [{ turnId: 'turn-7', subjectKey: 'narrator' }] })
  }, 10_000)
})
