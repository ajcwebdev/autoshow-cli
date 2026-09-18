import { describe, expect, test } from 'bun:test'
import { resolveTtsDeliveryOptions, resolveTtsResumeDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { ttsDeliveryPreset } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-profile'
import { buildConfigPatchFromFlags, mergeConfigIntoRawFlags } from '~/cli/commands/setup-and-utilities/config-command/config-merge'
import { ttsCommandFlags } from '~/cli/flags/tts-flags'
import { resumeFlags } from '~/cli/flags/resume-flags'
import { configCommandFlags } from '~/cli/flags/config-flags'

describe('TTS delivery option resolution', () => {
  test('default: no flags selects smart chunking, the native profile, WAV delivery, and preflight on', () => {
    expect(resolveTtsDeliveryOptions({})).toEqual({
      ttsChunking: { boundary: 'smart' },
      ttsDelivery: ttsDeliveryPreset('native'),
      ttsTextPreflight: true,
    })
  })

  test('the flag defaults advertised in help match the resolver defaults', () => {
    const defaults = Object.fromEntries(Object.entries(ttsCommandFlags).flatMap(([name, definition]) =>
      typeof definition === 'object' && definition !== null && 'default' in definition && typeof definition.default === 'string' ? [[name, definition.default]] : []))
    expect(defaults).toMatchObject({ 'tts-chunk-boundary': 'smart', 'tts-audio-profile': 'native', 'tts-export-format': 'wav', 'tts-text-preflight': 'on' })
    expect(resolveTtsDeliveryOptions(defaults)).toEqual(resolveTtsDeliveryOptions({}))
  })

  test('override: the audiobook preset applies and each mastering flag overrides one field', () => {
    const resolved = resolveTtsDeliveryOptions({
      'tts-audio-profile': 'audiobook', 'tts-sample-rate': '48000', 'tts-channels': '2', 'tts-loudness': '-16', 'tts-true-peak': '-1',
      'tts-trim-silence': 'off', 'tts-paragraph-pause': '900', 'tts-sentence-pause': '100', 'tts-lead-in': '0', 'tts-lead-out': '2500',
      'tts-chunk-boundary': 'legacy', 'tts-chunk-size': '1500', 'tts-text-preflight': 'off',
    })
    expect(resolved.ttsDelivery).toEqual({
      ...ttsDeliveryPreset('audiobook'),
      sampleRate: 48000,
      channels: 2,
      loudness: { mode: 'ebu-r128', integratedLufs: -16, truePeakDb: -1 },
      trimSilence: false,
      gapsMs: { paragraph: 900, turn: 900, sentence: 100, clause: 100 },
      leadInMs: 0,
      leadOutMs: 2500,
    })
    expect(resolved.ttsChunking).toEqual({ boundary: 'legacy', maxChars: 1500 })
    expect(resolved.ttsTextPreflight).toBe(false)
  })

  test('reset: legacy-16k removes the delivery profile and loudness off disables a preset target', () => {
    expect(resolveTtsDeliveryOptions({ 'tts-audio-profile': 'legacy-16k' }).ttsDelivery).toBeUndefined()
    expect(resolveTtsDeliveryOptions({ 'tts-audio-profile': 'audiobook', 'tts-loudness': 'off' }).ttsDelivery?.loudness).toEqual({ mode: 'none' })
  })

  test('export options resolve only when a non-default delivery is requested', () => {
    expect(resolveTtsDeliveryOptions({ 'tts-export-format': 'wav' }).ttsExport).toBeUndefined()
    expect(resolveTtsDeliveryOptions({ 'tts-export-format': 'm4b', 'tts-bitrate': '64', 'tts-metadata': ['title=A Book', 'artist=An Author'], 'tts-cover': 'art/cover.jpg', 'tts-book': true }).ttsExport).toEqual({
      format: 'm4b', bitrateKbps: 64, metadata: { title: 'A Book', artist: 'An Author' }, coverPath: 'art/cover.jpg', book: true,
    })
    expect(resolveTtsDeliveryOptions({ 'tts-book': true }).ttsExport).toEqual({ format: 'wav', book: true })
  })

  for (const [flags, message] of [
    [{ 'tts-audio-profile': 'studio' }, 'Invalid --tts-audio-profile value "studio"'],
    [{ 'tts-chunk-boundary': 'word' }, 'Invalid --tts-chunk-boundary value "word"'],
    [{ 'tts-chunk-size': '50' }, 'Invalid --tts-chunk-size value "50"'],
    [{ 'tts-sample-rate': '12345' }, 'Invalid --tts-sample-rate value "12345"'],
    [{ 'tts-channels': '6' }, 'Invalid --tts-channels value "6"'],
    [{ 'tts-loudness': '-2' }, 'Invalid --tts-loudness value "-2"'],
    [{ 'tts-loudness': 'loud' }, 'Invalid --tts-loudness value "loud"'],
    [{ 'tts-true-peak': '-2' }, '--tts-true-peak requires --tts-loudness'],
    [{ 'tts-loudness': 'off', 'tts-true-peak': '-2' }, 'cannot be combined with --tts-loudness off'],
    [{ 'tts-paragraph-pause': '99999' }, 'Invalid --tts-paragraph-pause value "99999"'],
    [{ 'tts-trim-silence': 'maybe' }, 'Invalid --tts-trim-silence value "maybe"'],
    [{ 'tts-text-preflight': 'strict' }, 'Invalid --tts-text-preflight value "strict"'],
    [{ 'tts-audio-profile': 'legacy-16k', 'tts-sample-rate': '44100' }, '--tts-sample-rate cannot be combined with --tts-audio-profile legacy-16k'],
    [{ 'tts-audio-profile': 'legacy-16k', 'tts-export-format': 'mp3' }, 'require a mastered delivery profile'],
    [{ 'tts-export-format': 'opus' }, 'Invalid --tts-export-format value "opus"'],
    [{ 'tts-export-format': 'flac', 'tts-bitrate': '128' }, '--tts-bitrate does not apply to --tts-export-format flac'],
    [{ 'tts-export-format': 'mp3', 'tts-bitrate': '8' }, 'Invalid --tts-bitrate value "8"'],
    [{ 'tts-metadata': ['title=A'] }, '--tts-metadata requires --tts-export-format'],
    [{ 'tts-export-format': 'mp3', 'tts-metadata': ['title'] }, 'Expected key=value'],
    [{ 'tts-export-format': 'mp3', 'tts-metadata': ['mood=calm'] }, 'Invalid --tts-metadata key "mood"'],
    [{ 'tts-export-format': 'mp3', 'tts-metadata': ['title=A', 'title=B'] }, 'was given more than once'],
    [{ 'tts-cover': 'cover.jpg' }, '--tts-cover requires --tts-export-format'],
    [{ 'tts-export-format': 'mp3', 'tts-cover': 'cover.gif' }, 'must be a .jpg, .jpeg, or .png image'],
  ] as const) {
    test(`rejected before dispatch: ${JSON.stringify(flags)}`, () => {
      expect(() => resolveTtsDeliveryOptions(flags)).toThrow(message)
    })
  }

  test('resume may fall back to retained settings only when no identity flag was given explicitly', async () => {
    expect((await resolveTtsResumeDeliveryOptions({}, new Set())).ttsDeliveryFallbackAllowed).toBe(true)
    expect((await resolveTtsResumeDeliveryOptions({}, new Set(['tts-export-format', 'tts-metadata']))).ttsDeliveryFallbackAllowed).toBe(true)
    for (const flag of ['tts-audio-profile', 'tts-chunk-boundary', 'tts-chunk-size', 'tts-lead-in']) {
      expect((await resolveTtsResumeDeliveryOptions({}, new Set([flag]))).ttsDeliveryFallbackAllowed).toBe(false)
    }
  })

  test('config: persistable delivery flags round-trip and run-scoped ones are never persisted', () => {
    const flags = { 'tts-audio-profile': 'audiobook', 'tts-chunk-size': '1800', 'tts-export-format': 'm4b', 'tts-loudness': '-18' }
    const patch = buildConfigPatchFromFlags(flags, new Set(Object.keys(flags)))
    expect(patch).toEqual({ defaults: { tts: { audioProfile: 'audiobook', chunkSize: '1800', exportFormat: 'm4b', loudness: '-18' } } })
    expect(mergeConfigIntoRawFlags({}, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set())).toMatchObject(flags)
    expect(mergeConfigIntoRawFlags({ 'tts-audio-profile': 'native' }, patch as Parameters<typeof mergeConfigIntoRawFlags>[1], new Set(['tts-audio-profile']))['tts-audio-profile']).toBe('native')
    for (const runScoped of ['tts-metadata', 'tts-cover', 'tts-book', 'tts-pronunciations']) {
      expect(Object.keys(configCommandFlags)).not.toContain(runScoped)
      expect(Object.keys(ttsCommandFlags)).toContain(runScoped)
    }
    expect(Object.keys(resumeFlags)).toContain('tts-audio-profile')
    expect(Object.keys(resumeFlags)).not.toContain('tts-book')
  })
})
