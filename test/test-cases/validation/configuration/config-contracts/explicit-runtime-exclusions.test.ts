import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, extractExplicitFlags } from '~/cli/commands/setup-and-utilities/config/config-merge'

describe('config explicit flag and runtime exclusion contracts', () => {
  test('extractExplicitFlags ignores tokens after the positional separator', () => {
    expect(extractExplicitFlags([
      'extract',
      'https://ajc.pics/autoshow/examples/1-audio.mp3',
      '--mistral-stt',
      'voxtral-mini-2602',
      '--',
      '--deepinfra-ocr',
      'Qwen/Qwen3-VL-30B-A3B-Instruct'
    ])).toEqual(new Set(['mistral-stt']))
  })

  test('runtime-only options are excluded from saved config patches', () => {
    expect(buildConfigPatchFromFlags({
      'reverb-stt': true,
      price: true,
      password: 'secret-pdf-password',
      'config-path': '/tmp/autoshow.json',
      'speechify-tts-ref-audio': 'input/voices/my-voice-sample.mp3',
      'speechify-tts-voice-name': 'AutoShow Anthony',
      'speechify-tts-consent-name': 'Anthony Example',
      'speechify-tts-consent-email': 'anthony@example.com',
      'speechify-tts-voice-locale': 'en-US',
      'speechify-tts-voice-gender': 'notSpecified'
    }, new Set([
      'reverb-stt',
      'price',
      'password',
      'config-path',
      'speechify-tts-ref-audio',
      'speechify-tts-voice-name',
      'speechify-tts-consent-name',
      'speechify-tts-consent-email',
      'speechify-tts-voice-locale',
      'speechify-tts-voice-gender'
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
})
