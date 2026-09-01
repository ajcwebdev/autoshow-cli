import { describe, expect, test } from 'bun:test'
import { collectTtsTargets, preflightTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { TtsOptions } from '~/types'
import { resolveStandaloneMistralTtsCliReferenceInput } from '~/cli/options/option-resolution/tts-options'

describe('Synthesis voice option contracts', () => {
  test('allows existing voice IDs and keeps an unnamed Mistral reference at the standalone edge', () => {
    const elevenLabs = buildOptsFromFlags({
      'elevenlabs-tts': 'eleven_v3',
      'tts-voice': 'voice_existing'
    })
    const speechify = buildOptsFromFlags({
      'speechify-tts': 'simba-3.2',
      'tts-voice': 'geffen_32'
    })
    const mistralFlags = {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    }
    const referenceAuthority = { cliReferenceInput: 'standalone-mistral' } as const
    const mistral = buildOptsFromFlags(mistralFlags, {}, new Set(['tts-ref-audio']), { ttsOptionResolutionAuthority: referenceAuthority })
    const referenceInput = resolveStandaloneMistralTtsCliReferenceInput(mistralFlags, {
      explicitFlags: new Set(['tts-ref-audio']),
      ...referenceAuthority
    })

    expect(collectTtsTargets(elevenLabs).map(target => target.voice)).toEqual(['voice_existing'])
    expect(collectTtsTargets(speechify).map(target => target.voice)).toEqual(['geffen_32'])
    expect(() => preflightTtsTargetSelection(mistral)).not.toThrow()
    expect(referenceInput?.sourcePath).toBe('input/examples/audio/anthony-voice.mp3')
    expect('mistralTtsRefAudio' in mistral).toBe(false)
    expect(() => collectTtsTargets({
      ...mistral,
      mistralTtsRefAudio: referenceInput?.sourcePath
    } as TtsOptions)).toThrow('must cross the protected ingestion boundary')
  })

  test('keeps the implicit Mistral price-planning voice non-executable', async () => {
    const options = {
      ...buildOptsFromFlags({ 'mistral-tts': 'voxtral-mini-tts-2603' }),
      price: true
    }
    const target = collectTtsTargets(options)[0]

    expect(target?.voice).toBe('price-planning-placeholder')
    await expect(target?.run('Pricing only', '.', options)).rejects.toThrow('price-only Mistral TTS planning target cannot execute synthesis')
  })

  test('skips an unconfigured Mistral target only for all-provider synthesis', () => {
    const allProviderOptions = buildOptsFromFlags({ 'all-tts': true })
    const allProviderTargets = collectTtsTargets(allProviderOptions)

    expect(allProviderOptions.ttsAllProvidersSelected).toBe(true)
    expect(allProviderTargets.some((target) => target.service === 'mistral')).toBe(false)
    expect(allProviderTargets.length).toBeGreaterThan(0)

    const configuredAllProviderTargets = collectTtsTargets(buildOptsFromFlags({
      'all-tts': true,
      'tts-voice': 'mistral=voice_abc123'
    }))
    expect(configuredAllProviderTargets.some((target) => target.service === 'mistral')).toBe(true)

    const explicitMistralOptions = buildOptsFromFlags({
      'mistral-tts': 'voxtral-mini-tts-2603'
    })
    expect(explicitMistralOptions.ttsAllProvidersSelected).toBe(false)
    expect(() => collectTtsTargets(explicitMistralOptions)).toThrow('requires an existing voice ID')
  })
})
