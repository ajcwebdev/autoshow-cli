import { describe, expect, it } from 'bun:test'
import {
  resolveRetainedPath,
  validateRecoveryProjections,
  reconcileSlotCosts,
  buildPureCurrentTtsRenderPlan,
} from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import type { PipelineProviderState, Step4Metadata, TtsTarget } from '~/types'

const createMockTarget = (service = 'openai', model = 'gpt-4o-mini-tts-2025-12-15'): TtsTarget => ({
  service: service as TtsTarget['service'],
  model,
  run: async () => ({
    audioPath: '/tmp/audio.wav',
    metadata: {} as Step4Metadata,
  }),
})

describe('TTS recovery helper modules', () => {
  it('resolveRetainedPath rejects paths that escape the base directory', () => {
    expect(() => resolveRetainedPath('/tmp/base', '../outside/file.json', 'Test artifact')).toThrow(
      'Test artifact escapes its retained evidence directory.'
    )
    expect(() => resolveRetainedPath('/tmp/base', '../../etc/passwd', 'Test artifact')).toThrow(
      'Test artifact escapes its retained evidence directory.'
    )
    expect(resolveRetainedPath('/tmp/base', 'sub/file.json', 'Test artifact')).toBe('/tmp/base/sub/file.json')
  })

  it('validateRecoveryProjections validates target key and exact projections', () => {
    const options = {
      target: createMockTarget('openai', 'gpt-4o-mini-tts-2025-12-15'),
      sourceText: 'Hello world',
      ttsOptions: {},
      rootDir: '/tmp/test',
      state: {
        service: 'openai' as const,
        model: 'wrong-model',
        targetKey: 'openai/wrong-model',
        artifactDir: 'providers/openai',
        attempts: 1,
      } as PipelineProviderState,
    }
    const pure = buildPureCurrentTtsRenderPlan(options)
    expect(() => validateRecoveryProjections(options, pure)).toThrow(
      'Stored TTS provider state does not bind the exact planned target identity.'
    )

    const emptyDirOptions = {
      ...options,
      state: {
        ...options.state,
        targetKey: pure.targetKey,
        artifactDir: '   ',
      },
    }
    expect(() => validateRecoveryProjections(emptyDirOptions, pure)).toThrow(
      'Stored TTS provider state does not bind the exact planned target identity.'
    )
  })

  it('reconcileSlotCosts correctly computes zero costs when no dispatches occurred', () => {
    const options = {
      target: createMockTarget('openai', 'gpt-4o-mini-tts-2025-12-15'),
      sourceText: 'Hello world',
      ttsOptions: {},
    }
    const pure = buildPureCurrentTtsRenderPlan(options)
    const result = reconcileSlotCosts(pure, new Map(), [], { ttsOptions: {} })
    expect(result.completedSlotIds.size).toBe(0)
    expect(result.retainedCumulativePlannedCost).toEqual({ amounts: [] })
    expect(result.reconciliationBlockers).toEqual([])
  })
})
