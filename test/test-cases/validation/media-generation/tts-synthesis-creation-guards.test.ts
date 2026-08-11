import { describe, expect, test } from 'bun:test'
import { collectTtsTargets, preflightTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { AppUsageError } from '~/utils/error-handler'
import type { TtsOptions } from '~/types'
import { resolveStandaloneMistralTtsCliReferenceInput } from '~/cli/options/option-resolution/tts-options'

const blockedCreationFlags: ReadonlyArray<[flag: string, value: string | boolean]> = [
  ['elevenlabs-tts-ref-audio', 'reference.wav'],
  ['elevenlabs-tts-voice-name', 'Created voice'],
  ['elevenlabs-tts-clone-remove-background-noise', true],
  ['speechify-tts-ref-audio', 'reference.wav'],
  ['speechify-tts-voice-name', 'Created voice'],
  ['speechify-tts-consent-name', 'Performer'],
  ['speechify-tts-consent-email', 'performer@example.com'],
  ['speechify-tts-voice-locale', 'en-US'],
  ['speechify-tts-voice-gender', 'notSpecified'],
  ['mistral-tts-voice-name', 'Created voice']
]

describe('Phase 0 synthesis-side voice creation guards', () => {
  for (const [flag, value] of blockedCreationFlags) {
    test(`rejects explicit --${flag} during option resolution`, () => {
      let thrown: unknown
      try {
        buildOptsFromFlags(false, { [flag]: value }, {}, new Set([flag]))
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(AppUsageError)
      expect((thrown as Error).message).toContain(`Explicit synthesis option --${flag}`)
      expect((thrown as AppUsageError).hints.join(' ')).toContain('`voice` command')
      expect((thrown as AppUsageError).hints.join(' ')).toContain('`comic reference-voice`')
    })
  }

  test('reports config-inherited creation defaults distinctly', () => {
    expect(() => buildOptsFromFlags(false, {
      'elevenlabs-tts-ref-audio': 'reference.wav',
      __autoshowConfigInjectedFlags: ['elevenlabs-tts-ref-audio']
    })).toThrow(
      'Configured synthesis default --elevenlabs-tts-ref-audio'
    )
  })

  test('guards target collection even when options bypass normal CLI resolution', () => {
    const options = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3'
    })
    ;(options as unknown as { elevenlabsTtsRefAudio: string }).elevenlabsTtsRefAudio = 'reference.wav'

    expect(() => collectTtsTargets(options)).toThrow(
      'Synthesis option --elevenlabs-tts-ref-audio cannot perform reference-audio cloning'
    )
  })

  test('allows existing voice IDs and keeps an unnamed Mistral reference at the standalone edge', () => {
    const elevenLabs = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-voice': 'voice_existing'
    })
    const speechify = buildOptsFromFlags(false, {
      'speechify-tts': 'simba-3.2',
      'speechify-voice': 'geffen_32'
    })
    const mistralFlags = {
      'mistral-tts': 'voxtral-mini-tts-2603',
      'mistral-tts-ref-audio': 'input/examples/audio/anthony-voice.mp3'
    }
    const referenceAuthority = { cliReferenceInput: 'standalone-mistral' } as const
    const mistral = buildOptsFromFlags(
      false,
      mistralFlags,
      {},
      new Set(['mistral-tts-ref-audio']),
      { ttsOptionResolutionAuthority: referenceAuthority }
    )
    const referenceInput = resolveStandaloneMistralTtsCliReferenceInput(mistralFlags, {
      explicitFlags: new Set(['mistral-tts-ref-audio']),
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

  test('ignores blank creation strings and a false clone preparation toggle', () => {
    const options = buildOptsFromFlags(false, {
      'elevenlabs-tts': 'eleven_v3',
      'elevenlabs-tts-ref-audio': '   ',
      'elevenlabs-tts-voice-name': '',
      'elevenlabs-tts-clone-remove-background-noise': false,
      'elevenlabs-voice': 'voice_existing'
    })

    expect(collectTtsTargets(options).map(target => target.voice)).toEqual(['voice_existing'])
  })
})
