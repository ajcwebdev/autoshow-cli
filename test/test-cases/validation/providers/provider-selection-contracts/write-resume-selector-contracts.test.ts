import { describe, expect, test } from 'bun:test'
import { buildWriteResumeOutputFileName } from '~/cli/commands/setup-and-utilities/resume/resume-write/write-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { Step3Metadata } from '~/types'
import { normalizeResumeSelectorFlagsForTarget, normalizeWriteStepSelectorFlags } from './generic-selector-test-adapters'



describe('provider selection contracts', () => {

  test('write step-scoped --all-local normalizes local provider groups and rejects bare usage', () => {
    const normalized = normalizeWriteStepSelectorFlags({
      'all-local': ['stt', 'ocr', 'url']
    }, new Set(['all-local']))

    expect(normalized.flags).toMatchObject({
      'all-local-stt': true,
      'all-local-ocr': true,
      'all-local-url': true
    })
    expect(normalized.flags['all-local-llm']).toBeUndefined()
    expect(normalized.flags['all-local-tts']).toBeUndefined()
    expect(normalized.flags['all-local-image']).toBeUndefined()
    expect(normalized.flags['all-local-video']).toBeUndefined()
    expect(normalized.flags['all-local-music']).toBeUndefined()
    expect(normalized.explicitFlags.has('all-local-stt')).toBe(true)
    expect(normalized.explicitFlags.has('all-local')).toBe(false)

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': ['llm']
    }, new Set(['all-local']))).toThrow('--all-local does not support step "llm"')

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': ['image']
    }, new Set(['all-local']))).toThrow('Invalid --all-local step "image"')

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': ['tts']
    }, new Set(['all-local']))).toThrow('Invalid --all-local step "tts"')

    expect(() => normalizeWriteStepSelectorFlags({
      'all-local': true
    }, new Set(['all-local']))).toThrow('--all-local requires a step')
  })

  test('write resume generic providers normalize to LLM runtime option keys', () => {
    const normalized = normalizeResumeSelectorFlagsForTarget({
      kind: 'write',
      scope: 'single',
      dir: '/tmp/write-run',
      manifestPath: '/tmp/write-run/manifest.json'
    }, {
      provider: ['together=kimi-k2.6', 'together=glm-5.1', 'anthropic=claude-haiku-4-5', 'anthropic=claude-sonnet-4-6']
    }, new Set(['provider']), [
      'resume',
      '/tmp/write-run',
      '--provider',
      'together=kimi-k2.6',
      '--provider',
      'together=glm-5.1',
      '--provider',
      'anthropic=claude-haiku-4-5',
      '--provider',
      'anthropic=claude-sonnet-4-6'
    ])
    const opts = buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags, { flagOccurrences: normalized.flagOccurrences })

    expect(normalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'together', value: 'kimi-k2.6' },
      { name: 'together', value: 'glm-5.1' },
      { name: 'anthropic', value: 'claude-haiku-4-5' },
      { name: 'anthropic', value: 'claude-sonnet-4-6' }
    ])
    expect(opts.togetherModels).toEqual(['kimi-k2.6', 'glm-5.1'])
    expect(opts.anthropicModels).toEqual(['claude-haiku-4-5', 'claude-sonnet-4-6'])
  })

  test('write resume filenames keep duplicate short model selectors service-qualified', () => {
    const existingEntries: Step3Metadata[] = [
      {
        llmService: 'glm',
        llmModel: 'glm-5.1',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-glm-5.1.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      },
      {
        llmService: 'kimi',
        llmModel: 'kimi-k2.6',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-kimi-k2.6.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      }
    ]
    const selectedTargets = [
      { service: 'together' as const, model: 'kimi-k2.6' },
      { service: 'together' as const, model: 'glm-5.1' },
      { service: 'anthropic' as const, model: 'claude-haiku-4-5' },
      { service: 'anthropic' as const, model: 'claude-sonnet-4-6' }
    ]
    const reservedFileNames = new Set(existingEntries.map((entry) => entry.outputFileName))

    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[0]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-together-kimi-k2.6.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[1]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-together-glm-5.1.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[2]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-claude-haiku-4-5.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[3]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-claude-sonnet-4-6.json')
  })
})
