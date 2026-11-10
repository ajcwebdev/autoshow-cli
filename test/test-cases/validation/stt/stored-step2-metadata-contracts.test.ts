import { describe, expect, test } from 'bun:test'
import { parseStoredStep2Metadata } from '~/cli/commands/stt/stt-batch/stt-run-state'

const base = {
  transcriptionService: 'deepgram',
  transcriptionModel: 'nova-3',
  processingTime: 1200,
  tokenCount: 42
}

describe('stored STT step 2 metadata parsing contracts', () => {
  test('rejects records without a known service, model, processing time, or token count', () => {
    expect(parseStoredStep2Metadata(undefined)).toBeUndefined()
    expect(parseStoredStep2Metadata([])).toBeUndefined()
    expect(parseStoredStep2Metadata({ ...base, transcriptionService: 'unknown' })).toBeUndefined()
    expect(parseStoredStep2Metadata({ ...base, transcriptionModel: 3 })).toBeUndefined()
    expect(parseStoredStep2Metadata({ ...base, processingTime: '1200' })).toBeUndefined()
    expect(parseStoredStep2Metadata({ ...base, tokenCount: null })).toBeUndefined()
  })

  test('keeps required fields in stored key order and drops unknown keys', () => {
    const parsed = parseStoredStep2Metadata({ extra: true, tokenCount: 42, processingTime: 1200, transcriptionModel: 'nova-3', transcriptionService: 'deepgram' })
    expect<unknown>(parsed).toEqual(base)
    expect(Object.keys(parsed ?? {})).toEqual(['transcriptionService', 'transcriptionModel', 'processingTime', 'tokenCount'])
  })

  test('rejects non-finite or negative required counters and empty model identifiers', () => {
    for (const counter of [NaN, Infinity, -Infinity, -1]) {
      expect(parseStoredStep2Metadata({ ...base, processingTime: counter })).toBeUndefined()
      expect(parseStoredStep2Metadata({ ...base, tokenCount: counter })).toBeUndefined()
    }
    expect(parseStoredStep2Metadata({ ...base, transcriptionModel: '  ' })).toBeUndefined()
    expect(parseStoredStep2Metadata({ ...base, processingTime: 0, tokenCount: 0 })).toBeDefined()
  })

  test('drops invalid billing counters without losing valid zero-cost usage', () => {
    const parsed = parseStoredStep2Metadata({
      ...base,
      billing: { creditsUsed: -1, creditRateCents: Infinity, inputTokens: NaN, outputTokens: 0, totalCost: -0.5, source: 'provider_usage' }
    })
    expect(parsed?.billing).toEqual({ outputTokens: 0, source: 'provider_usage' })
  })

  test('keeps only typed billing fields in declaration order', () => {
    const parsed = parseStoredStep2Metadata({
      ...base,
      billing: {
        mode: 'token',
        source: 'provider_usage',
        totalCost: 0.5,
        textInputTokens: 1,
        audioInputTokens: 2,
        totalTokens: 3,
        outputTokens: 4,
        inputTokens: 5,
        creditRateCents: 6,
        creditsUsed: 0,
        ignored: 'x'
      }
    })
    expect(Object.keys(parsed?.billing ?? {})).toEqual([
      'creditsUsed', 'creditRateCents', 'inputTokens', 'outputTokens', 'totalTokens',
      'audioInputTokens', 'textInputTokens', 'totalCost', 'source', 'mode'
    ])
    expect(parsed?.billing).toEqual({
      creditsUsed: 0, creditRateCents: 6, inputTokens: 5, outputTokens: 4, totalTokens: 3,
      audioInputTokens: 2, textInputTokens: 1, totalCost: 0.5, source: 'provider_usage', mode: 'token'
    })
  })

  test('omits billing when no stored billing field is usable', () => {
    for (const billing of [{}, { creditsUsed: '1', source: 'other', mode: 'weekly' }, 'text', null, [1]]) {
      const parsed = parseStoredStep2Metadata({ ...base, billing })
      expect(parsed).toBeDefined()
      expect(Object.hasOwn(parsed ?? {}, 'billing')).toBe(false)
    }
  })

  test('keeps caption and diarization fields only when they have stored shapes', () => {
    const parsed = parseStoredStep2Metadata({
      ...base,
      captionFormat: 'vtt',
      captionLanguage: 'en',
      captionKind: 'auto',
      diarizationOptions: { speakers: 2 }
    })
    expect(Object.keys(parsed ?? {})).toEqual([
      'transcriptionService', 'diarizationOptions', 'transcriptionModel', 'processingTime', 'tokenCount',
      'captionKind', 'captionLanguage', 'captionFormat'
    ])
    const rejected = parseStoredStep2Metadata({ ...base, captionFormat: 'srt', captionLanguage: 7, captionKind: 'generated', diarizationOptions: 'on' })
    expect<unknown>(rejected).toEqual(base)
  })
})
