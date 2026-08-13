import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import type {
  CanonicalAudioProviderProjection,
  MockFetchCall,
  ProviderRenderResult,
  TtsOptions,
} from '~/types'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['OPENAI_API_KEY'],
  tempPrefix: 'autoshow-tts-current-render-controls-dispatch-'
})

const readInput = (call: MockFetchCall): string => String(call.bodyJson?.['input'] ?? '')

describe('current TTS render control dispatch', () => {
  test('authorizes and retains final OpenAI A/X, B/Y, A/X serializer evidence', async () => {
    process.env['OPENAI_API_KEY'] = 'openai-test-key'
    const audioBytes = createMockWavBytes()
    const calls = installMockFetch(() => new Response(audioBytes, {
      status: 200,
      headers: { 'content-type': 'audio/wav' }
    }))
    const outputDir = await tempDirs.make()
    const options: TtsOptions = {
      ...buildOptsFromFlags(false, {
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
        'openai-tts-speed': '0.7',
        'tts-dialogue-format': 'labeled',
        'tts-speaker': ['Alice=alloy', 'Bob=onyx']
      }),
      ttsTurnControls: {
        'dialogue-turn-001': { openai: { speed: 0.8 } },
        'dialogue-turn-002': { openai: { speed: 1.2 } },
        'dialogue-turn-003': { openai: { speed: 0.8 } }
      }
    }
    const target = collectTtsTargets(options).find((candidate) => candidate.service === 'openai')
    if (!target) throw new Error('Missing OpenAI TTS target')

    const result = await runTtsForTargets(
      'Alice: First.\nBob: Second.\nAlice: Third.',
      outputDir,
      options,
      [target]
    )

    expect(new Map(calls.map((call) => [readInput(call), {
      voice: call.bodyJson?.['voice'],
      speed: call.bodyJson?.['speed']
    }]))).toEqual(new Map([
      ['First.', { voice: 'alloy', speed: 0.8 }],
      ['Second.', { voice: 'onyx', speed: 1.2 }],
      ['Third.', { voice: 'alloy', speed: 0.8 }]
    ]))

    const metadata = result.metadata[0]
    if (!metadata?.artifactDir || !metadata.ttsAudio) throw new Error('Missing retained OpenAI TTS artifacts')
    const projection = metadata.ttsAudio as CanonicalAudioProviderProjection
    const selected = projection.selectedSuccess
    if (!selected) throw new Error('Missing selected TTS success')
    const render = projection.renderHistory.find((entry) => entry.renderIdentity === selected.renderIdentity)
    const event = render?.events.find((entry) => entry.sequence === selected.eventSequence)
    if (!event?.providerRenderResultRef) throw new Error('Missing retained provider render result')
    const renderResult = await Bun.file(join(
      outputDir,
      metadata.artifactDir,
      event.providerRenderResultRef
    )).json() as ProviderRenderResult

    const observedByTurn = new Map(renderResult.observedRequests.flatMap((request) =>
      request.turns.map((turn) => [turn.turnId, {
        voiceHash: turn.actualSerializedVoice.valueHash,
        controlsHash: turn.actualSerializedControlsHash
      }] as const)
    ))
    expect(observedByTurn).toEqual(new Map([
      ['dialogue-turn-001', {
        voiceHash: sha256Bytes('alloy'),
        controlsHash: hashCanonicalTtsValue({ responseFormat: 'wav', speed: 0.8 })
      }],
      ['dialogue-turn-002', {
        voiceHash: sha256Bytes('onyx'),
        controlsHash: hashCanonicalTtsValue({ responseFormat: 'wav', speed: 1.2 })
      }],
      ['dialogue-turn-003', {
        voiceHash: sha256Bytes('alloy'),
        controlsHash: hashCanonicalTtsValue({ responseFormat: 'wav', speed: 0.8 })
      }]
    ]))
    expect(renderResult.turnOutcomes.map((outcome) => outcome.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded'
    ])
  }, 20_000)
})
