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
      provider: ['together=kimi-k3', 'together=glm-5.3-flash', 'anthropic=claude-sonnet-5', 'anthropic=claude-sonnet-5']
    }, new Set(['provider']))
    const opts = buildOptsFromFlags(normalized.flags, {}, normalized.explicitFlags, { flagOccurrences: normalized.flagOccurrences })

    expect(normalized.flagOccurrences.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: 'together', value: 'kimi-k3' },
      { name: 'together', value: 'glm-5.3-flash' },
      { name: 'anthropic', value: 'claude-sonnet-5' },
      { name: 'anthropic', value: 'claude-sonnet-5' }
    ])
    expect(opts.togetherModels).toEqual(['kimi-k3', 'glm-5.3-flash'])
    expect(opts.anthropicModels).toEqual(['claude-sonnet-5'])
  })

  test('write resume filenames keep duplicate short model selectors service-qualified', () => {
    const existingEntries: Step3Metadata[] = [
      {
        llmService: 'glm',
        llmModel: 'glm-5.3-flash',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-glm-5.3-flash.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      },
      {
        llmService: 'kimi',
        llmModel: 'kimi-k3',
        processingTime: 1,
        inputTokenCount: 1,
        outputTokenCount: 1,
        outputFileName: 'text-kimi-k3.json',
        outputFormat: 'json',
        structuredMode: 'native',
        structuredPresetNames: ['shortSummary']
      }
    ]
    const selectedTargets = [
      { service: 'together' as const, model: 'kimi-k3' },
      { service: 'together' as const, model: 'glm-5.3-flash' },
      { service: 'anthropic' as const, model: 'claude-sonnet-5' },
      { service: 'anthropic' as const, model: 'claude-sonnet-5' }
    ]
    const reservedFileNames = new Set(existingEntries.map((entry) => entry.outputFileName))

    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[0]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-together-kimi-k3.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[1]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-together-glm-5.3-flash.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[2]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-anthropic-claude-sonnet-5.json')
    expect(buildWriteResumeOutputFileName({
      target: selectedTargets[3]!,
      selectedTargets,
      existingEntries,
      reservedFileNames
    })).toBe('text-anthropic-claude-sonnet-5-2.json')
  })
})
