import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import type {
  CanonicalAudioProviderProjection,
  MockFetchCall,
  TtsOptions,
} from '~/types'
import { createMockWavBytes } from '../../../test-utils/media-fixtures'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { requireDefined } from '../../../test-utils/value-assertions'

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
      ...buildOptsFromFlags({
        'openai-tts': 'gpt-4o-mini-tts-2025-12-15',
        'tts-speed': '0.7',
        'tts-dialogue-format': 'labeled',
        'tts-speaker': ['Alice=alloy', 'Bob=onyx']
      }),
      ttsTurnControls: {
        'dialogue-turn-001': { openai: { speed: 0.8 } },
        'dialogue-turn-002': { openai: { speed: 1.2 } },
        'dialogue-turn-003': { openai: { speed: 0.8 } }
      }
    }
    const target = requireDefined(collectTtsTargets(options).find((candidate) => candidate.service === 'openai'), 'OpenAI TTS target')

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
    requireDefined(projection.selectedSuccess, 'selected TTS success')
    const archive = requireDefined(projection.archive, 'compact TTS archive')
    const compactRender = await Bun.file(join(outputDir, archive.renderRef.path)).json() as {
      slots: Array<{ turnIds: string[], voiceHash: string }>
    }
    expect(compactRender.slots.map((slot) => slot.turnIds)).toEqual([
      ['dialogue-turn-001'],
      ['dialogue-turn-002'],
      ['dialogue-turn-003'],
    ])
  }, 20_000)
})
