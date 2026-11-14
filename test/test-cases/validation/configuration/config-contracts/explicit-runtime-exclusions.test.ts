import { describe, expect, test } from 'bun:test'
import { buildConfigPatchFromFlags, FLAG_TO_CONFIG_PATH, RUNTIME_ONLY_FLAGS } from '~/cli/commands/setup-and-utilities/config-command/config-merge'

describe('config explicit flag and runtime exclusion contracts', () => {
  test('runtime-only options are excluded from saved config patches', () => {
    expect(buildConfigPatchFromFlags({
      'tesseract-ocr': true,
      price: true,
      password: 'secret-pdf-password',
      'config-path': '/tmp/autoshow.json',
      'tts-ref-audio': 'input/voices/mistral-sample.mp3',
      'allow-over-budget': true,
      show: true,
      reset: true
    }, new Set([
      'tesseract-ocr',
      'price',
      'password',
      'config-path',
      'tts-ref-audio',
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

  test('RUNTIME_ONLY_FLAGS stays disjoint from FLAG_TO_CONFIG_PATH', () => {
    const overlap = [...RUNTIME_ONLY_FLAGS].filter(flag => FLAG_TO_CONFIG_PATH[flag] !== undefined)

    expect(overlap).toEqual([])
  })

  test('setup diagnostics and installation controls never become saved defaults', () => {
    const controls = {
      doctor: true, strict: true, 'dry-run': true, step: 'rendering', 'force-redownload': true,
      models: ['tiny'], 'network-check': 'serve', port: '8787', 'delay-seconds': '1',
      'probe-url': 'http://127.0.0.1:8787', 'probe-client': 'fetch',
      'bin-dir': 'runtime/bin', json: true, 'result-file': 'runtime/result.json', color: false
    }
    expect(buildConfigPatchFromFlags(controls, new Set(Object.keys(controls)))).toEqual({})
    for (const name of Object.keys(controls)) expect(RUNTIME_ONLY_FLAGS.has(name)).toBe(true)
  })

  test('prompt is not runtime-only, so the prompt config pass stays reachable', () => {
    expect(RUNTIME_ONLY_FLAGS.has('prompt')).toBe(false)
  })
})
