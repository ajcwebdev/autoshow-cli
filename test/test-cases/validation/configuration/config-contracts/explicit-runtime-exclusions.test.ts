import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, FLAG_TO_CONFIG_PATH, RUNTIME_ONLY_FLAGS } from '~/cli/commands/setup-and-utilities/config/config-merge'

describe('config explicit flag and runtime exclusion contracts', () => {
  test('runtime-only options are excluded from saved config patches', () => {
    expect(buildConfigPatchFromFlags({
      'reverb-stt': true,
      price: true,
      password: 'secret-pdf-password',
      'config-path': '/tmp/autoshow.json',
      'mistral-tts-ref-audio': 'input/voices/mistral-sample.mp3',
      'mistral-tts-voice-name': 'Named Mistral Voice',
      'elevenlabs-tts-ref-audio': 'input/voices/elevenlabs-sample.mp3',
      'elevenlabs-tts-voice-name': 'Named ElevenLabs Voice',
      'elevenlabs-tts-clone-remove-background-noise': true,
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-voice-name': 'AutoShow Anthony',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com',
      'speechify-tts-voice-locale': 'en-US',
      'speechify-tts-voice-gender': 'notSpecified',
      'allow-over-budget': true,
      show: true,
      reset: true
    }, new Set([
      'reverb-stt',
      'price',
      'password',
      'config-path',
      'mistral-tts-ref-audio',
      'mistral-tts-voice-name',
      'elevenlabs-tts-ref-audio',
      'elevenlabs-tts-voice-name',
      'elevenlabs-tts-clone-remove-background-noise',
      'speechify-tts-ref-audio',
      'speechify-tts-voice-name',
      'speechify-tts-consent-name',
      'speechify-tts-consent-email',
      'speechify-tts-voice-locale',
      'speechify-tts-voice-gender',
      'allow-over-budget',
      'show',
      'reset'
    ]))).toEqual({
      defaults: {
        extract: {
          stt: {
            reverb: true
          }
        }
      }
    })
  })

  // `buildConfigPatchFromFlags` skips runtime-only flags before it looks for a config
  // destination, so an entry present in both sets would shadow a real destination and
  // the flag would silently stop being persisted.
  test('RUNTIME_ONLY_FLAGS stays disjoint from FLAG_TO_CONFIG_PATH', () => {
    const overlap = [...RUNTIME_ONLY_FLAGS].filter(flag => FLAG_TO_CONFIG_PATH[flag] !== undefined)

    expect(overlap).toEqual([])
  })

  // `prompt` is written by the multi-destination pass rather than through
  // FLAG_TO_CONFIG_PATH, so the disjointness check above cannot see it. Its own guard
  // reads `!RUNTIME_ONLY_FLAGS.has('prompt')`; pin the premise or that becomes a no-op.
  test('prompt is not runtime-only, so the prompt config pass stays reachable', () => {
    expect(RUNTIME_ONLY_FLAGS.has('prompt')).toBe(false)
  })
})
