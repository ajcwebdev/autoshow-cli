import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { runTts } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import {
  assertDialogueFormatIsUsable,
  detectVoiceKind,
  isMultiSpeakerRequested,
  normalizeDialogueText,
  parseSpeakerVoiceMappings
} from '~/cli/commands/process-steps/step-4-tts/dialogue-normalizer'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { readWavSamples, segmentRms } from '../providers/tts-provider-contracts/shared'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY'],
  tempPrefix: 'autoshow-tts-dialogue-order-'
})

describe('TTS dialogue contracts', () => {
  test('labeled normalization accepts canonical speaker lines and rejects unknown speakers', () => {
    const registry = parseSpeakerVoiceMappings([
      'DUCO=input/examples/audio/anthony-voice.mp3'
    ])

    expect(normalizeDialogueText('DUCO: Hello there.', 'labeled', registry).normalizedText)
      .toBe('DUCO: Hello there.')
    expect(() => normalizeDialogueText('CHAT: Hello Duco.', 'labeled', registry))
      .toThrow('No --tts-speaker mapping found for speaker CHAT')
  })

  test('multi-speaker validates provider selection and speaker mappings', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'tts-dialogue-format': 'screenplay',
      'tts-speaker': ['DUCO=input/examples/audio/anthony-voice.mp3']
    }))).toThrow('requires at least one TTS provider')

    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-speaker': ['DUCO=input/examples/audio/anthony-voice.mp3']
    }))).toThrow('Dialogue TTS requires --tts-dialogue-format screenplay|labeled.')

    // Multi-provider multi-speaker is now allowed
    const targets = collectTtsTargets(buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['DUCO=alloy', 'CHAT=onyx']
    }))
    expect(targets.length).toBe(2)
    expect(targets.every((t) => t.multiSpeakerStrategy !== undefined)).toBe(true)
  })

  // Speaker mappings are the mode switch. A stored `ttsDialogueFormat` used to force dialogue mode
  // and abort every pipeline TTS run at step 4; it must now be inert, and only a typed flag errors.
  test('a dialogue format without speakers is inert unless it was typed explicitly', () => {
    const opts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-dialogue-format': 'screenplay'
    })

    expect(isMultiSpeakerRequested(opts)).toBe(false)
    const targets = collectTtsTargets(opts)
    expect(targets.length).toBe(1)
    expect(targets[0]?.multiSpeakerStrategy).toBeUndefined()

    expect(() => assertDialogueFormatIsUsable(opts)).not.toThrow()
    expect(() => assertDialogueFormatIsUsable(opts, new Set(['tts-dialogue-format'])))
      .toThrow('--tts-dialogue-format requires at least one --tts-speaker SPEAKER=VOICE mapping.')

    // With mappings present the format is load-bearing again, so neither arm fires.
    const dialogueOpts = buildOptsFromFlags(false, {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-dialogue-format': 'screenplay',
      'tts-speaker': ['DUCO=input/examples/audio/anthony-voice.mp3']
    })
    expect(isMultiSpeakerRequested(dialogueOpts)).toBe(true)
    expect(() => assertDialogueFormatIsUsable(dialogueOpts, new Set(['tts-dialogue-format']))).not.toThrow()
  })

  test('parseSpeakerVoiceMappings parses voice IDs and ref audio paths', () => {
    const registry = parseSpeakerVoiceMappings([
      'Host=Kore',
      'Guest=input/audio/voice.mp3'
    ])
    expect(registry.entries.length).toBe(2)
    expect(registry.entries[0]?.voiceKind).toBe('id')
    expect(registry.entries[0]?.voice).toBe('Kore')
    expect(registry.entries[1]?.voiceKind).toBe('ref-audio')
    expect(registry.entries[1]?.voice).toBe('input/audio/voice.mp3')
  })

  test('detectVoiceKind classifies voice IDs and ref audio paths', () => {
    expect(detectVoiceKind('Kore')).toBe('id')
    expect(detectVoiceKind('alloy')).toBe('id')
    expect(detectVoiceKind('input/audio/voice.mp3')).toBe('ref-audio')
    expect(detectVoiceKind('voice.wav')).toBe('ref-audio')
    expect(detectVoiceKind('https://example.com/audio.mp3')).toBe('ref-audio')
    expect(detectVoiceKind('C:\\audio\\voice.m4a')).toBe('ref-audio')
  })

  test('detectVoiceKind recognizes bare audio filenames beyond the common containers', () => {
    for (const value of ['clip.opus', 'clip.oga', 'clip.aiff', 'clip.aif', 'clip.wma', 'clip.amr', 'clip.caf', 'clip.m4b', 'clip.weba', 'clip.mka', 'clip.au', 'clip.pcm']) {
      expect(detectVoiceKind(value)).toBe('ref-audio')
    }
    expect(detectVoiceKind('Kore')).toBe('id')
    expect(detectVoiceKind('gpt-4o.mini')).toBe('id')
  })

  test('new --tts-speaker flag works with voice IDs for multi-speaker', () => {
    const targets = collectTtsTargets(buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Alice=alloy', 'Bob=onyx']
    }))
    expect(targets.length).toBe(1)
    expect(targets[0]?.service).toBe('openai')
    expect(targets[0]?.multiSpeakerStrategy).toBe('segment-and-concat')
  })

  test('hosted segment-and-concat preserves dialogue turn order under concurrent segment scheduling', async () => {
    const dir = await tempDirs.make()
    const audioByMarker = new Map([
      ['A', createSyntheticWavBytes({ durationSeconds: 0.25, amplitude: 0.2, frequencyHz: 440 })],
      ['B', createSyntheticWavBytes({ durationSeconds: 0.25, amplitude: 0.5, frequencyHz: 440 })],
      ['C', createSyntheticWavBytes({ durationSeconds: 0.25, amplitude: 0.9, frequencyHz: 440 })]
    ])

    process.env['OPENAI_API_KEY'] = 'openai-key'
    installMockFetch((call) => {
      const marker = String(call.bodyJson?.['input'] ?? '').charAt(0)
      return new Response(audioByMarker.get(marker) ?? audioByMarker.get('A'), {
        status: 200,
        headers: { 'content-type': 'audio/wav' }
      })
    })

    const result = await runTts([
      'Alice: Alpha turn.',
      'Bob: Bravo turn.',
      'Alice: Charlie turn.'
    ].join('\n'), dir, buildOptsFromFlags(false, {
      'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Alice=alloy', 'Bob=onyx']
    }))

    expect(result.metadata[0]?.chunkCount).toBe(3)
    const samples = await readWavSamples(result.audioPaths[0] as string)
    const rmsValues = [0, 1, 2].map((index) => segmentRms(samples, index, 3))
    expect(rmsValues[0] as number).toBeLessThan(rmsValues[1] as number)
    expect(rmsValues[1] as number).toBeLessThan(rmsValues[2] as number)
  }, 10_000)

  test('Gemini multispeaker uses the generic speaker mappings', () => {
    const opts = buildOptsFromFlags(false, {
      'gemini-tts': 'gemini-3.1-flash-tts-preview',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['Host=Kore', 'Guest=Puck']
    })

    expect(opts.ttsSpeakers).toEqual(['Host=Kore', 'Guest=Puck'])
    expect(opts.ttsDialogueFormat).toBe('labeled')

    const targets = collectTtsTargets(opts)
    expect(targets.length).toBe(1)
    expect(targets[0]?.service).toBe('gemini')
    expect(targets[0]?.multiSpeakerStrategy).toBe('native')
    expect(targets[0]?.voice).toBe('Host=Kore, Guest=Puck')
  })

  test('ref-audio speakers rejected for providers that do not support ref audio', () => {
    expect(() => collectTtsTargets(buildOptsFromFlags(false, {
      'groq-tts': 'canopylabs/orpheus-v1-english',
      'tts-dialogue-format': 'labeled',
      'tts-speaker': ['DUCO=input/examples/audio/anthony-voice.mp3', 'CHAT=input/examples/audio/voice.mp3']
    }))).toThrow('does not support reference audio')
  })
})
