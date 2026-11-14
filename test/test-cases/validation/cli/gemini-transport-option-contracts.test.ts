import { describe, expect, test } from 'bun:test'
import { ttsCommandFlags } from '~/cli/flags/tts-flags'
import { resumeFlags } from '~/cli/flags/resume-flags'
import { GEMINI_TTS_MODES, GEMINI_TTS_DEFAULT_MODE, GEMINI_TTS_BATCH_WAIT_RANGE, GEMINI_TTS_BATCH_WAIT_DEFAULT_SECONDS, GEMINI_TTS_PROVIDER_JOB_ACTIONS, GEMINI_TTS_PROVIDER_JOB_DEFAULT_ACTION } from '~/cli/flags/gemini-tts-contract'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { validateInworldTtsVoice } from '~/cli/commands/setup-and-utilities/models/tts-models'

describe('Gemini transport options share validation, help and execution fallbacks', () => {
  test('help renders the executable choices and defaults without setting parsing defaults', () => {
    expect(ttsCommandFlags['gemini-tts-mode']!.description).toContain(GEMINI_TTS_MODES.join('|'))
    expect(ttsCommandFlags['gemini-tts-mode']!.description).toContain(`default: ${GEMINI_TTS_DEFAULT_MODE}`)
    expect(ttsCommandFlags['gemini-tts-batch-wait-seconds']!.description).toContain(`integer ${GEMINI_TTS_BATCH_WAIT_RANGE.join('-')}`)
    expect(ttsCommandFlags['gemini-tts-batch-wait-seconds']!.description).toContain(`default: ${GEMINI_TTS_BATCH_WAIT_DEFAULT_SECONDS}`)
    expect(resumeFlags['provider-job-action']!.description).toContain(GEMINI_TTS_PROVIDER_JOB_ACTIONS.join('|'))
    expect(resumeFlags['provider-job-action']!.description).toContain(`default ${GEMINI_TTS_PROVIDER_JOB_DEFAULT_ACTION}`)
    for (const definition of [ttsCommandFlags['gemini-tts-mode']!, ttsCommandFlags['gemini-tts-batch-wait-seconds']!, resumeFlags['provider-job-action']!]) expect(definition.default).toBeUndefined()
  })

  test('mode overrides and reset resolve to the selected transport; invalid modes fail before dispatch', () => {
    const selection = { 'gemini-tts': 'gemini-3.8-flash-lite-tts' }
    for (const mode of GEMINI_TTS_MODES) {
      const opts = buildOptsFromFlags({ ...selection, 'gemini-tts-mode': mode })
      expect(opts.geminiTtsMode).toBe(mode)
      expect(collectTtsTargets(opts)[0]!.transport).toBe(`gemini-${mode}`)
    }
    expect(collectTtsTargets(buildOptsFromFlags(selection))[0]!.transport).toBe(`gemini-${GEMINI_TTS_DEFAULT_MODE}`)
    expect(buildOptsFromFlags(selection).geminiTtsMode).toBeUndefined()
    expect(() => buildOptsFromFlags({ ...selection, 'gemini-tts-mode': 'realtime' })).toThrow('--gemini-tts-mode must be one of: unary, stream, batch')
  })

  test('batch wait accepts both boundaries and rejects out-of-range, fractional or wrong-mode values locally', () => {
    const selection = { 'gemini-tts': 'gemini-3.8-flash-lite-tts', 'gemini-tts-mode': 'batch' }
    for (const wait of GEMINI_TTS_BATCH_WAIT_RANGE) expect(buildOptsFromFlags({ ...selection, 'gemini-tts-batch-wait-seconds': String(wait) }).geminiTtsBatchWaitSeconds).toBe(wait)
    expect(buildOptsFromFlags(selection).geminiTtsBatchWaitSeconds).toBeUndefined()
    for (const wait of ['-1', '86401', '0.5', 'infinity']) expect(() => buildOptsFromFlags({ ...selection, 'gemini-tts-batch-wait-seconds': wait })).toThrow('integer from 0 to 86400')
    expect(() => buildOptsFromFlags({ ...selection, 'gemini-tts-mode': 'unary', 'gemini-tts-batch-wait-seconds': '0' })).toThrow('requires batch mode')
  })

  test('invalid public TTS controls name supported generic spellings', () => {
    expect(() => buildOptsFromFlags({ 'grok-tts': 'grok-tts', 'tts-voice': 'zzz' })).toThrow('--tts-voice grok="zzz"')
    expect(() => validateInworldTtsVoice(' ')).toThrow('--tts-voice for inworld')
  })
})
