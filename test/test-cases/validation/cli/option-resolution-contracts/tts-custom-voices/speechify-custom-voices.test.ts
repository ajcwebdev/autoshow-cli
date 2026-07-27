import { describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/speechify-custom-voices'

describe('Speechify custom voice option contracts', () => {
  test('Speechify custom voice flags build reference-audio targets and validate required consent', () => {
      const opts = buildOptsFromFlags(false, {
        'speechify-tts': ['simba-english'],
        'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
        'speechify-tts-voice-name': 'FallbackName',
        'speechify-tts-consent-name': 'Fallback Consent',
        'speechify-tts-consent-email': 'anthony@example.com',
        'speechify-tts-voice-locale': 'en-US',
        'speechify-tts-voice-gender': 'notSpecified'
      }, [], {}, new Set(), [
        '--speechify-tts-voice-name',
        'AutoShow Anthony',
        '--speechify-tts-consent-name',
        'Anthony Example'
      ])
      const speechifyTargets = collectTtsTargets(opts).filter((target) => target.service === 'speechify')

      expect(opts.speechifyTtsRefAudio).toBe('input/voices/my-voice-sample.mp3')
      expect(opts.speechifyTtsVoiceName).toBe('AutoShow Anthony')
      expect(opts.speechifyTtsConsentName).toBe('Anthony Example')
      expect(opts.speechifyTtsConsentEmail).toBe('anthony@example.com')
      expect(opts.speechifyTtsVoiceLocale).toBe('en-US')
      expect(opts.speechifyTtsVoiceGender).toBe('notSpecified')
      expect(speechifyTargets.map((target) => ({
        model: target.model,
        voice: target.voice,
        setupCostCents: target.setupCostCents,
        setupTimeMs: target.setupTimeMs,
        setupNote: target.setupNote
      }))).toEqual([
        {
          model: 'simba-english',
          voice: 'ref_audio:my-voice-sample.mp3',
          setupCostCents: 0,
          setupTimeMs: SPEECHIFY_TTS_CUSTOM_VOICE_SETUP_MS,
          setupNote: 'Speechify custom voice creation setup'
        }
      ])

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
        'speechify-tts-consent-name': 'Anthony Example',
        'speechify-tts-consent-email': 'anthony@example.com'
      }))).toThrow('Speechify TTS custom voice flags require selecting speechify TTS')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'speechify-tts': 'simba-english',
        'speechify-tts-voice-name': 'AutoShow Anthony',
        'speechify-tts-consent-name': 'Anthony Example',
        'speechify-tts-consent-email': 'anthony@example.com'
      }))).toThrow('requires --speechify-tts-ref-audio')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'speechify-tts': 'simba-english',
        'speechify-voice': 'george',
        'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
        'speechify-tts-consent-name': 'Anthony Example',
        'speechify-tts-consent-email': 'anthony@example.com'
      }))).toThrow('cannot be combined with --speechify-voice')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'speechify-tts': 'simba-english',
        'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
        'speechify-tts-consent-email': 'anthony@example.com'
      }))).toThrow('requires --speechify-tts-consent-name')

      expect(() => collectTtsTargets(buildOptsFromFlags(false, {
        'speechify-tts': 'simba-english',
        'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
        'speechify-tts-consent-name': 'Anthony Example',
        'speechify-tts-consent-email': 'anthony@example.com',
        'speechify-tts-voice-gender': 'unknown'
      }))).toThrow('Invalid --speechify-tts-voice-gender')
    })
})
