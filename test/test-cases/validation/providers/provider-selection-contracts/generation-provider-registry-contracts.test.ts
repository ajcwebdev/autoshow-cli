import { describe, expect, test } from 'bun:test'
import {
  GENERATION_SELECTION_ENTRIES,
  getGenerationSelectionEntries
} from '~/cli/commands/command-shared/generation-routing/generation-selection-entries'
import {
  GENERATION_MODEL_ENTRIES,
  getGenerationAllShortcutModelExpansions,
  getGenerationModelEntry
} from '~/cli/commands/command-shared/generation-routing/generation-model-registry'
import { collectGenerationTargets } from '~/cli/commands/command-shared/generation-routing/collect-generation-targets'
import { IMAGE_PROVIDER_REGISTRY } from '~/cli/commands/visuals/image/image-generation-targets/image-provider-registry'
import { VIDEO_PROVIDER_REGISTRY } from '~/cli/commands/visuals/video/video-targets/video-provider-registry'
import { MUSIC_PROVIDER_REGISTRY } from '~/cli/commands/audio/music/music-targets/music-provider-registry'
import { IMAGE_PRICING_PROVIDERS } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { VIDEO_PRICING_PROVIDERS } from '~/cli/commands/visuals/video/video-utils/video-pricing'
import { MUSIC_PRICING_PROVIDERS } from '~/cli/commands/audio/music/music-utils/music-pricing'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import type { GenerationModality } from '~/types'

const DOMAINS = [
  { modality: 'image' as GenerationModality, dispatch: IMAGE_PROVIDER_REGISTRY, providerTargets: STANDALONE_IMAGE_PROVIDER_TARGETS, pricing: IMAGE_PRICING_PROVIDERS, allShortcut: 'all-image' },
  { modality: 'video' as GenerationModality, dispatch: VIDEO_PROVIDER_REGISTRY, providerTargets: STANDALONE_VIDEO_PROVIDER_TARGETS, pricing: VIDEO_PRICING_PROVIDERS, allShortcut: 'all-video' },
  { modality: 'music' as GenerationModality, dispatch: MUSIC_PROVIDER_REGISTRY, providerTargets: STANDALONE_MUSIC_PROVIDER_TARGETS, pricing: MUSIC_PRICING_PROVIDERS, allShortcut: 'all-music' }
] as const

describe('generation provider registry contracts', () => {
  test('flags, pricing selections and dispatch are all derived from one registry', () => {
    for (const domain of DOMAINS) {
      const selection = getGenerationSelectionEntries(domain.modality)
      const services = selection.map(entry => entry.service)

      expect(Object.keys(domain.providerTargets), domain.modality).toEqual(services)
      expect(Object.values<string>(domain.providerTargets), domain.modality).toEqual(selection.map(entry => entry.flagName))
      expect(domain.pricing.map(spec => String(spec.service)), domain.modality).toEqual(services)
      expect(domain.pricing.map(spec => String(spec.modelsKey)), domain.modality).toEqual(selection.map(entry => entry.runtimeModelsKey))
      // Every registered provider must have a collector, and no collector may exist without an entry.
      expect(domain.dispatch.map((entry): string => entry.service), domain.modality).toEqual(services)
      for (const entry of domain.dispatch) {
        expect(typeof entry.collectTargets, `${domain.modality}/${entry.service}`).toBe('function')
        expect(entry.supportedModels.length, `${domain.modality}/${entry.service}`).toBeGreaterThan(0)
        expect(entry.allShortcut, `${domain.modality}/${entry.service}`).toBe(domain.allShortcut)
      }
    }
  })

  test('registry flag names are unique and resolvable', () => {
    const flagNames = GENERATION_SELECTION_ENTRIES.map(entry => entry.flagName)
    expect(new Set(flagNames).size).toBe(flagNames.length)
    expect(GENERATION_MODEL_ENTRIES.map(entry => entry.flagName)).toEqual(flagNames)
    for (const flagName of flagNames) {
      expect(getGenerationModelEntry(flagName)?.flagName, flagName).toBe(flagName)
    }
    expect(getGenerationModelEntry('not-a-provider')).toBeUndefined()
  })

  test('all-shortcut expansions cover exactly the registered generation flags', () => {
    const expansions = getGenerationAllShortcutModelExpansions()
    expect(Object.keys(expansions)).toEqual(GENERATION_SELECTION_ENTRIES.map(entry => entry.flagName))
    for (const entry of GENERATION_MODEL_ENTRIES) {
      expect(expansions[entry.flagName]).toEqual({ shortcut: entry.allShortcut, supported: entry.supportedModels })
    }
  })

  test('the fan-out helper dispatches to every registered provider in registry order', () => {
    const calls: string[] = []
    const entries = DOMAINS[0].dispatch.map(entry => ({
      ...entry,
      collectTargets: () => {
        calls.push(entry.service)
        return []
      }
    }))
    expect(collectGenerationTargets(entries, {}, undefined)).toEqual([])
    expect(calls).toEqual(DOMAINS[0].dispatch.map(entry => entry.service))
  })

  test('registry validators reject unknown models and accept registered ones', () => {
    for (const entry of GENERATION_MODEL_ENTRIES) {
      const first = entry.supportedModels[0] as string
      expect(entry.validateModel(first), `${entry.flagName}/${first}`).toBe(first)
      expect(() => entry.validateModel('definitely-not-a-model'), entry.flagName).toThrow()
    }
  })
})
