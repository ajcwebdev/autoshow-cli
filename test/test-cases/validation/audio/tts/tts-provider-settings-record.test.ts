import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildPureCurrentTtsRenderPlan } from '~/cli/commands/audio/tts/script-to-audio/current-render-attempt'
import { ttsProviderSettings } from '~/cli/commands/audio/tts/script-to-audio/tts-provider-settings'
import { ttsDeliveryPreset } from '~/cli/commands/audio/tts/tts-utils/tts-delivery-profile'
import { parseProviderState } from '~/cli/commands/command-shared/pipeline-manifest/provider-state-parser'
import { createProviderSettingsRecord, describeSettingsFile, parseProviderSettingsRecord } from '~/cli/commands/command-shared/pipeline-manifest/provider-settings-record'
import type { Step4Metadata, TtsOptions, TtsTarget } from '~/types'
import { PROJECT_ROOT } from '~/utils/project-root'
import { withTempDir } from '../../../../test-utils/temp-dirs'

const target = (service: TtsTarget['service'], model: string, voice?: string): TtsTarget => ({
  service,
  model,
  ...(voice ? { voice } : {}),
  run: async () => ({ audioPath: 'unused.wav', metadata: {} as Step4Metadata }),
})

const settingsFor = (ttsTarget: TtsTarget, ttsOptions: TtsOptions = {}, sourceText = 'One short narrated line.') => {
  const options = { target: ttsTarget, sourceText, ttsOptions }
  return ttsProviderSettings(options, buildPureCurrentTtsRenderPlan(options))
}

describe('provider settings record envelope', () => {
  test('drops empty values, relativizes project paths, redacts secrets, and sorts ignored flags', () => {
    const record = createProviderSettingsRecord({
      service: 'openai',
      operation: 'image',
      request: {
        size: '1024x1024',
        quality: undefined,
        empty: '',
        nested: { keep: 1, drop: undefined },
        apiKey: 'sk-live-secret',
        password: 'pdf-password',
        input: join(PROJECT_ROOT, 'input', 'photo.png'),
      },
      local: { unused: undefined },
      ignored: ['instrumental', 'aspect-ratio', 'instrumental'],
    })
    expect(record).toEqual({
      schemaVersion: 1,
      settingsSchema: 'openai.image.v1',
      request: { size: '1024x1024', nested: { keep: 1 }, apiKey: 'REDACTED', password: 'REDACTED', input: 'input/photo.png' },
      ignored: ['aspect-ratio', 'instrumental'],
    })
  })

  test('describes content files by project-relative path and content hash', async () => {
    await withTempDir('autoshow-settings-file-', async (dir) => {
      const path = join(dir, 'lyrics.txt')
      await Bun.write(path, 'la la la')
      const described = await describeSettingsFile(path)
      expect(described?.['sha256']).toBe(new Bun.CryptoHasher('sha256').update('la la la').digest('hex'))
      expect(await describeSettingsFile(undefined)).toBeUndefined()
    })
  })

  test('rejects malformed envelopes and provider states that carry them', () => {
    expect(parseProviderSettingsRecord({ schemaVersion: 2, settingsSchema: 'x.y.v2', request: {} })).toBeUndefined()
    expect(parseProviderSettingsRecord({ schemaVersion: 1, settingsSchema: 'x.y.v1', request: {}, extra: true })).toBeUndefined()
    expect(parseProviderSettingsRecord({ schemaVersion: 1, settingsSchema: 'x.y.v1', request: {}, ignored: [1] })).toBeUndefined()
    const state = { service: 'openai', model: 'gpt-image-2', artifactDir: '.', status: 'succeeded', attempts: 1, options: {}, metadata: {} }
    expect(parseProviderState('/tmp/run', { ...state, settings: { schemaVersion: 1, settingsSchema: 'openai.image.v1', request: { size: 'auto' } } })?.settings?.request).toEqual({ size: 'auto' })
    expect(parseProviderState('/tmp/run', { ...state, settings: { schemaVersion: 1, request: {} } })).toBeUndefined()
  })
})

describe('TTS provider settings record (plan-derived, no dispatch)', () => {
  test('ElevenLabs records defaulted output format when no controls are passed', () => {
    const settings = settingsFor(target('elevenlabs', 'eleven_v3', 'hpp4J3VqNfWAUOO0d1Us'))
    expect(settings.settingsSchema).toBe('elevenlabs.tts-synthesis.v1')
    expect(settings.request).toMatchObject({
      model: 'eleven_v3',
      strategy: 'segmented',
      voice: 'hpp4J3VqNfWAUOO0d1Us',
      endpointKind: 'speech-synthesis',
      controls: { outputFormat: 'mp3_44100_128' },
    })
    expect(settings.local).toMatchObject({ audioProfile: 'legacy-16k', textPreflight: true, chunking: { boundary: 'smart', providerLimit: 5000, effectiveMaxChars: 5000 } })
  })

  test('ElevenLabs records stability, seed, text normalization, and response format overrides', () => {
    const settings = settingsFor(target('elevenlabs', 'eleven_v3', 'hpp4J3VqNfWAUOO0d1Us'), {
      elevenlabsTtsStability: 0.8,
      elevenlabsTtsSeed: 12345,
      elevenlabsTtsTextNormalization: 'on',
      elevenlabsTtsResponseFormat: 'mp3_44100_192',
    })
    expect(settings.request['controls']).toEqual({
      outputFormat: 'mp3_44100_192',
      voiceSettings: { stability: 0.8 },
      seed: 12345,
      textNormalization: 'on',
    })
  })

  test('Inworld records speed and steering instruction', () => {
    const inworld = settingsFor(target('inworld', 'realtime-tts-2'), { inworldTtsSpeed: 0.9, inworldTtsInstructions: 'Calm, measured narration' })
    expect(inworld.request['voice']).toBeDefined()
    expect(JSON.stringify(inworld.request['controls'])).toContain('0.9')
    expect(JSON.stringify(inworld.request['controls'])).toContain('Calm, measured narration')
  })

  test('every hosted TTS provider produces a request record with endpoint, serializer, and voice', () => {
    const targets = [
      target('openai', 'gpt-4o-mini-tts-2025-12-15'),
      target('grok', 'grok-tts'),
      target('inworld', 'realtime-tts-2'),
      target('elevenlabs', 'eleven_v3'),
    ]
    for (const ttsTarget of targets) {
      const settings = settingsFor(ttsTarget)
      expect(settings.settingsSchema).toBe(`${ttsTarget.service}.tts-synthesis.v1`)
      expect(typeof settings.request['endpointKind']).toBe('string')
      expect(typeof settings.request['serializerVersion']).toBe('string')
      expect(typeof settings.request['voice']).toBe('string')
    }
  })

  test('audiobook delivery, pause overrides, chunking, and export settings are recorded locally', () => {
    const delivery = ttsDeliveryPreset('audiobook')
    delivery.gapsMs = { ...delivery.gapsMs, paragraph: 1000, turn: 1000, sentence: 450 }
    const settings = settingsFor(target('inworld', 'realtime-tts-2'), {
      ttsDelivery: delivery,
      ttsChunking: { boundary: 'smart', maxChars: 300 },
      ttsExport: { format: 'mp3', bitrateKbps: 192, metadata: { title: 'Audiobook Test' } },
    })
    expect(settings.local).toMatchObject({
      audioProfile: 'audiobook',
      delivery: { sampleRate: 44100, channels: 1, loudness: { mode: 'ebu-r128', integratedLufs: -19, truePeakDb: -3 }, gapsMs: { paragraph: 1000, sentence: 450 } },
      chunking: { boundary: 'smart', requestedMaxChars: 300, effectiveMaxChars: 300 },
      export: { format: 'mp3', bitrateKbps: 192, metadata: { title: 'Audiobook Test' } },
    })
  })

  test('multi-speaker scripts record one entry per distinct voice', () => {
    const settings = settingsFor(target('openai', 'gpt-4o-mini-tts-2025-12-15'), {
      ttsDialogueFormat: 'labeled',
      ttsSpeakers: ['ALICE=alloy', 'BOB=verse'],
    } as TtsOptions, 'ALICE: Hello there.\nBOB: Hi, Alice.')
    const speakers = settings.request['speakers'] as Array<Record<string, unknown>>
    expect(speakers.map((entry) => entry['voice']).sort()).toEqual(['alloy', 'verse'])
  })
})
