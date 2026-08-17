import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, FLAG_TO_CONFIG_PATH, RUNTIME_ONLY_FLAGS } from '~/cli/commands/setup-and-utilities/config/config-merge'

describe('config explicit flag and runtime exclusion contracts', () => {
  test('runtime-only options are excluded from saved config patches', () => {
    expect(buildConfigPatchFromFlags({
      'tesseract-ocr': true,
      price: true,
      password: 'secret-pdf-password',
      'config-path': '/tmp/autoshow.json',
      'mistral-tts-ref-audio': 'input/voices/mistral-sample.mp3',
      'allow-over-budget': true,
      show: true,
      reset: true
    }, new Set([
      'tesseract-ocr',
      'price',
      'password',
      'config-path',
      'mistral-tts-ref-audio',
      'allow-over-budget',
      'show',
      'reset'
    ]))).toEqual({
      defaults: {
        extract: {
          ocr: {
            tesseract: true
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
