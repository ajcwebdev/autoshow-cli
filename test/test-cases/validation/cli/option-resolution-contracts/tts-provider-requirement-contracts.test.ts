import { describe,expect,test } from 'bun:test'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

describe('option resolution contracts', () => {

  test('TTS request control flags require their matching provider selection', () => {
      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-speed': 'openai=1.1'
      }))).toThrow('OpenAI TTS request control flags require selecting openai TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-text-normalization': 'grok=true'
      }))).toThrow('Grok TTS request control flags require selecting grok TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'minimax-tts-emotion': 'calm'
      }))).toThrow('MiniMax TTS request control flags require selecting minimax TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-speed': 'deepgram=1.1'
      }))).toThrow('Deepgram TTS request control flags require selecting deepgram TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-language': 'elevenlabs=en'
      }))).toThrow('ElevenLabs TTS request control flags require selecting elevenlabs TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-language': 'speechify=en-US'
      }))).toThrow('Speechify TTS request control flags require selecting speechify TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-voice': 'hume=Studio Voice'
      }))).toThrow('Hume TTS voice flags require selecting hume TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-language': 'cartesia=en'
      }))).toThrow('Cartesia TTS request control flags require selecting cartesia TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags({
        'tts-instructions': 'inworld=Sound reassuring'
      }))).toThrow('Inworld TTS request control flags require selecting inworld TTS')

    })
})
