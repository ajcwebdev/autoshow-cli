import { describe, expect, test } from 'bun:test'
import { collectDeepinfraTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-tts-targets'
import { DEEPINFRA_TTS_RETRY_POLICY, runDeepinfraTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/run-deepinfra-tts'
import { createDeepinfraAdvancedProvider, DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-advanced-provider'
import { prepareDeepinfraChatterboxText } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-text-preparation'
import { buildDeepinfraTtsRequestBody, DEEPINFRA_TTS_SERIALIZER_VERSION, prepareDeepinfraTtsText, resolveDeepinfraTtsDefaultVoice, resolveDeepinfraTtsVoiceField } from '~/cli/commands/process-steps/step-4-tts/tts-services/tts-deepinfra/deepinfra-tts-request'
import { createTtsTargetSelection } from '~/cli/commands/process-steps/step-4-tts/tts-targets/tts-target-selection'
import { prepareComicSegmentedProviderTexts } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import { validatePreparedProviderText } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import { resolveTtsChunkCharacterLimit } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-chunking'

describe('DeepInfra Phase 4 Contracts', () => {
  test('collects DeepInfra TTS targets with correct provider and model', () => {
    const selection = createTtsTargetSelection({ deepinfraTtsModel: 'ResembleAI/chatterbox-multilingual', deepinfraTtsVoice: 'standard' })
    const targets = collectDeepinfraTtsTargets(selection)
    expect(targets).toHaveLength(1)
    expect(targets[0]?.service).toBe('deepinfra')
    expect(targets[0]?.model).toBe('ResembleAI/chatterbox-multilingual')
    expect(targets[0]?.voice).toBe('standard')
    expect(DEEPINFRA_TTS_RETRY_POLICY).toMatchObject({ maxAttempts: 8, baseDelayMs: 3_000, maxDelayMs: 30_000, jitter: true, exponential: true })
  })

  test('rejects missing credentials instead of fabricating offline audio', async () => {
    await expect(runDeepinfraTts('Hello from DeepInfra Chatterbox test', 'test-out', {
      model: 'ResembleAI/chatterbox-multilingual',
      apiKey: '',
    })).rejects.toThrow('DeepInfra API key is required')
  })

  test('normalizes Chatterbox ellipses to provider-safe comma pauses without changing canonical text', () => {
    const prepared = prepareDeepinfraChatterboxText('Teeth... more teeth. Then… wait.')
    expect(prepared.canonicalText).toBe('Teeth... more teeth. Then… wait.')
    expect(prepared.providerText).toBe('Teeth, more teeth. Then, wait.')
    expect(validatePreparedProviderText(prepared)).toBe(prepared)
    expect(prepareDeepinfraChatterboxText('Power.').preparationVersion).toBe('generic-tts-v1')

    const [target] = collectDeepinfraTtsTargets(createTtsTargetSelection({ deepinfraTtsModel: 'ResembleAI/chatterbox-multilingual' }))
    expect(prepareComicSegmentedProviderTexts({
      turnId: 'dialogue-turn-009',
      sourceSegmentId: 'dialogue-turn-009',
      subjectKey: 'seamus',
      originalSpeakerLabel: 'SEAMUS',
      canonicalText: 'Teeth... more teeth.'
    }, target!).providerTexts).toEqual(['Teeth, more teeth.'])
  })

  test('serializes each hosted model with its current DeepInfra request schema', () => {
    expect(DEEPINFRA_TTS_SERIALIZER_VERSION).toBe('deepinfra.tts.phase-4-v2')
    expect(prepareDeepinfraTtsText('ResembleAI/chatterbox-multilingual', 'Wait... now.')).toBe('Wait, now.')
    expect(buildDeepinfraTtsRequestBody({ model: 'ResembleAI/chatterbox-multilingual', text: 'Hello', voice: 'provider-default' })).toEqual({ text: 'Hello', response_format: 'wav' })
    expect(buildDeepinfraTtsRequestBody({ model: 'ResembleAI/chatterbox-turbo', text: 'Hello', voice: 'custom-voice' })).toEqual({ text: 'Hello', response_format: 'wav', voice_id: 'custom-voice' })
    expect(buildDeepinfraTtsRequestBody({ model: 'XiaomiMiMo/MiMo-V2.5-tts', text: 'Hello', voice: 'mimo_default', promptInstructions: 'Bright delivery' })).toEqual({ text: 'Hello', voice: 'mimo_default', output_format: 'wav', stream: false, instruct: 'Bright delivery' })
    expect(buildDeepinfraTtsRequestBody({ model: 'XiaomiMiMo/MiMo-V2.5-tts-voicedesign', text: 'Hello', voice: 'Warm narrator' })).toEqual({ text: 'Hello', voice: 'Warm narrator', output_format: 'wav', stream: false })
    expect(buildDeepinfraTtsRequestBody({ model: 'Qwen/Qwen3-TTS', text: 'Hello', voice: 'Vivian' })).toEqual({ input: 'Hello', voice: 'Vivian', language: 'Auto', response_format: 'wav' })
    expect(buildDeepinfraTtsRequestBody({ model: 'Qwen/Qwen3-TTS-VoiceDesign', text: 'Hello', voice: 'Warm narrator' })).toEqual({ input: 'Hello', voice: 'Warm narrator', language: 'Auto', response_format: 'wav' })
    expect(resolveDeepinfraTtsDefaultVoice('Qwen/Qwen3-TTS')).toBe('Vivian')
    expect(resolveDeepinfraTtsVoiceField('ResembleAI/chatterbox-turbo')).toBe('voice_id')
    expect(resolveDeepinfraTtsVoiceField('Qwen/Qwen3-TTS')).toBe('voice')
  })

  test('uses the provider-advertised per-model input limits for planning and dispatch', () => {
    expect(resolveTtsChunkCharacterLimit('deepinfra', 'ResembleAI/chatterbox-multilingual')).toBe(5000)
    expect(resolveTtsChunkCharacterLimit('deepinfra', 'XiaomiMiMo/MiMo-V2.5-tts')).toBe(1000)
    expect(resolveTtsChunkCharacterLimit('deepinfra', 'Qwen/Qwen3-TTS')).toBe(4000)
  })

  test('advanced provider declares unsupported management facets without fake catalog entries', () => {
    expect(DEEPINFRA_ADVANCED_CAPABILITY_FIXTURE.records.length).toBeGreaterThan(0)
    const provider = createDeepinfraAdvancedProvider({ apiKey: 'test-key-deepinfra' })
    expect(provider.catalog).toBeUndefined()
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'voice-catalog')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
    expect(provider.getDeclaredCapabilities().find(record => record.scope.feature === 'native-dialogue')).toMatchObject({ adapterSupport: 'unsupported', channel: 'unsupported' })
  })
})
