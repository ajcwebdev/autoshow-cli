import { describe,expect,test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('option resolution contracts', () => {

  test('buildOptsFromFlags maps repeatable dialogue speaker flags', () => {
      const opts = buildOptsFromFlags({
        'mistral-tts': 'voxtral-mini-tts-2603',
        'tts-dialogue-format': 'screenplay',
        'tts-speaker': [
          'DUCO=voice_duco',
          'CHAT=voice_chat'
        ]
      })

      expect(opts.ttsDialogueFormat).toBe('screenplay')
      expect(opts.ttsSpeakers).toEqual([
        'DUCO=voice_duco',
        'CHAT=voice_chat'
      ])
    })

  test('buildOptsFromFlags maps and validates provider-specific TTS request controls', () => {
      const opts = buildOptsFromFlags({
        'grok-tts': 'grok-tts',
        'tts-voice': 'grok=AB12CD34',
        'tts-language': ['grok=pt-br', 'minimax=english', 'speechify=en-US', 'elevenlabs=en'],
        'tts-text-normalization': ['grok=true', 'minimax=true', 'elevenlabs=AUTO'],
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
        'tts-instructions': 'openai=Speak with calm narration.',
        'tts-speed': ['openai=1.25', 'minimax=1.2', 'deepgram=1.1', 'elevenlabs=1.1'],
        'minimax-tts': 'speech-2.8-hd',
        'minimax-tts-volume': '2.5',
        'minimax-tts-pitch': '-2',
        'minimax-tts-emotion': 'CALM',
        'minimax-tts-pronunciation': ['AutoShow/auto show', 'TTS/tee tee ess'],
        'deepgram-tts': 'aura-2-thalia-en',
        'speechify-tts': 'simba-3.2',
        'elevenlabs-tts': 'eleven_v3',
        'elevenlabs-tts-stability': '0.4',
        'elevenlabs-tts-similarity-boost': '0.8',
        'elevenlabs-tts-style': '0.2',
        'elevenlabs-tts-use-speaker-boost': true,
        'elevenlabs-tts-seed': '12345',
        'elevenlabs-tts-pronunciation-dictionary-locator': ['dict_1:version_2']
      })

      expect(opts.grokTtsVoice).toBe('ab12cd34')
      expect(opts.grokTtsLanguage).toBe('pt-BR')
      expect(opts.grokTtsTextNormalization).toBe(true)
      expect(opts.openaiTtsInstructions).toBe('Speak with calm narration.')
      expect(opts.openaiTtsSpeed).toBe(1.25)
      expect(opts.minimaxTtsModels?.[0]).toBe('speech-2.8-hd')
      expect(opts.minimaxTtsLanguageBoost).toBe('English')
      expect(opts.minimaxTtsSpeed).toBe(1.2)
      expect(opts.minimaxTtsVolume).toBe(2.5)
      expect(opts.minimaxTtsPitch).toBe(-2)
      expect(opts.minimaxTtsEmotion).toBe('calm')
      expect(opts.minimaxTtsEnglishNormalization).toBe(true)
      expect(opts.minimaxTtsPronunciations).toEqual(['AutoShow/auto show', 'TTS/tee tee ess'])
      expect(opts.deepgramTtsSpeed).toBe(1.1)
      expect(opts.speechifyTtsLanguage).toBe('en-US')
      expect(opts.elevenlabsTtsLanguageCode).toBe('en')
      expect(opts.elevenlabsTtsStability).toBe(0.4)
      expect(opts.elevenlabsTtsSimilarityBoost).toBe(0.8)
      expect(opts.elevenlabsTtsStyle).toBe(0.2)
      expect(opts.elevenlabsTtsUseSpeakerBoost).toBe(true)
      expect(opts.elevenlabsTtsSpeed).toBe(1.1)
      expect(opts.elevenlabsTtsSeed).toBe(12345)
      expect(opts.elevenlabsTtsTextNormalization).toBe('auto')
      expect(opts.elevenlabsTtsPronunciationDictionaryLocators).toEqual(['dict_1:version_2'])

      expect(() => buildOptsFromFlags({ 'grok-tts': 'grok-tts', 'tts-language': 'xx' })).toThrow('Invalid --grok-tts-language "xx"')
      expect(() => buildOptsFromFlags({ 'openai-tts': 'gpt-4o-mini-tts-2025-12-15', 'tts-speed': '0.1' })).toThrow('Invalid --tts-speed value "0.1"')
      expect(() => buildOptsFromFlags({ 'minimax-tts': 'speech-2.8-hd', 'tts-language': 'Klingon' })).toThrow('Invalid --tts-language "Klingon"')
      expect(() => buildOptsFromFlags({ 'minimax-tts': 'speech-2.8-hd', 'tts-speed': '0.4' })).toThrow('Invalid --tts-speed value "0.4"')
      expect(() => buildOptsFromFlags({ 'minimax-tts-volume': '0' })).toThrow('Invalid --minimax-tts-volume value "0"')
      expect(() => buildOptsFromFlags({ 'minimax-tts-pitch': '1.5' })).toThrow('Invalid --minimax-tts-pitch value "1.5"')
      expect(() => buildOptsFromFlags({ 'minimax-tts-emotion': 'bored' })).toThrow('Invalid --minimax-tts-emotion "bored"')
      expect(() => buildOptsFromFlags({ 'hume-tts': 'octave-legacy' })).toThrow('Invalid model "octave-legacy" for --provider/--tts hume[=model]')
      expect(() => buildOptsFromFlags({ 'cartesia-tts': 'sonic-2' })).toThrow('Invalid model "sonic-2" for --provider/--tts cartesia[=model]')
      expect(() => buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', 'tts-text-normalization': 'always' })).toThrow('Invalid --elevenlabs-tts-text-normalization "always"')
    })

  test('Inworld maps --tts-instructions onto request-level steering', () => {
    const opts = buildOptsFromFlags({
      'inworld-tts': 'realtime-tts-2',
      'tts-instructions': 'Sound reassuring'
    })
    expect(opts.inworldTtsInstructions).toBe('Sound reassuring')
    expect(collectTtsTargets(opts).map(target => target.service)).toEqual(['inworld'])
    expect(() => collectTtsTargets(buildOptsFromFlags({
      'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
      'tts-instructions': 'inworld=Sound reassuring'
    }))).toThrow('Inworld TTS request control flags require selecting inworld TTS')
    const generic = normalizeGenericTtsOptionFlags(
      { 'inworld-tts': 'realtime-tts-2', 'tts-instructions': 'Sound reassuring' },
      new Set(['inworld-tts', 'tts-instructions']),
      [{ name: 'tts-instructions', raw: '--tts-instructions', value: 'Sound reassuring', known: true }]
    )
    expect(generic.flags['tts-instructions']).toBe('Sound reassuring')
    expect(generic.flags['inworld-tts-instructions']).toBeUndefined()
    expect(buildOptsFromFlags(generic.flags, {}, generic.explicitFlags, { flagOccurrences: generic.flagOccurrences }).inworldTtsInstructions)
      .toBe('Sound reassuring')
  })
})
