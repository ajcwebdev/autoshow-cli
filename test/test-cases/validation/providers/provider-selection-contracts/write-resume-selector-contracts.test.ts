import { describe, expect, test } from 'bun:test'
import { buildWriteResumeOutputFileName } from '~/cli/commands/setup-and-utilities/resume/resume-write/write-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { Step3Metadata } from '~/types'
import { normalizeResumeSelectorFlagsForTarget } from './generic-selector-test-adapters'



describe('provider selection contracts', () => {


  test('write resume generic providers normalize to LLM runtime option keys', () => {
    const normalized = normalizeResumeSelectorFlagsForTarget({
      kind: 'write',
      scope: 'single',
      dir: '/tmp/write-run',
      manifestPath: '/tmp/write-run/manifest.json'
    }, {
      provider: ['openai=gpt-6-luna', 'openai=gpt-6.1-sol', 'anthropic=claude-sonnet-5-5', 'anthropic=claude-sonnet-5-5']
    }, new Set(['provider']))
    const opts = buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags, { flagOccurrences: normalized.flagOccurrences })

    expect(normalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'openai', value: 'gpt-6-luna' },
      { name: 'openai', value: 'gpt-6.1-sol' },
      { name: 'anthropic', value: 'claude-sonnet-5-5' },
      { name: 'anthropic', value: 'claude-sonnet-5-5' }
    ])
    expect(opts.openaiModels).toEqual(['gpt-6-luna', 'gpt-6.1-sol'])
    expect(opts.anthropicModels).toEqual(['claude-sonnet-5-5'])
  })

  test('write resume filenames qualify collisions with existing outputs and repeated selectors', () => {
    const existingEntries: Step3Metadata[] = [
      {
        llmService: 'openai',
        llmModel: 'gpt-6.1-sol',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-gpt-6.1-sol.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      },
      {
        llmService: 'openai',
        llmModel: 'gpt-6-luna',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-gpt-6-luna.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      }
    ]
    const selectedTargets = [
      { service: 'openai' as const, model: 'gpt-6-luna' },
      { service: 'openai' as const, model: 'gpt-6.1-sol' },
      { service: 'anthropic' as const, model: 'claude-sonnet-5-5' },
      { service: 'anthropic' as const, model: 'claude-sonnet-5-5' }
    ]
    const reservedFileNames = new Set(existingEntries.map((entry) => entry.outputFileName))

    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[0]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-openai-gpt-6-luna.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[1]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-openai-gpt-6.1-sol.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[2]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-anthropic-claude-sonnet-5-5.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[3]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-anthropic-claude-sonnet-5-5-2.json')
  })
})
