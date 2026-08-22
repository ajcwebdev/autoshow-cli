import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { priceGenerationTarget, resumeGenerationTarget, hasResumableGenerationWork } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { getSelectedUrlTargets, resolveUrlArticleResumePlan } from '~/cli/commands/setup-and-utilities/resume/extract/url-resume'
import { finalizeMusicResumeArtifacts } from '~/cli/commands/setup-and-utilities/resume/generation/music-resume'
import type { ProviderIdentity, ResolvedFlagOptions } from '~/types'
import { readCanonicalRecord } from '../../../test-utils/manifest-helpers'
import { collectFakeTargetsFromOptions, fakeResumeConfig, fakeTarget, writeFakeImageRun } from './resume-additive-provider-fixture'

describe('additive resume provider selection', () => {
  test('music resume promotes a single additive output to its provider-specific filename', async () => {
    await withTempDir('autoshow-music-resume-artifact-', async (dir) => {
      await Bun.write(join(dir, 'generated-music.mp3'), new Uint8Array([1, 2, 3]))

      const [metadata] = await finalizeMusicResumeArtifacts([{
        musicService: 'elevenlabs',
        musicModel: 'music_v2',
        processingTime: 1,
        musicFileName: 'generated-music.mp3',
        musicFileSize: 0,
        musicDurationMs: 3000,
        lyricsSource: 'none'
      }], dir)

      expect(metadata?.musicFileName).toBe('generated-music-elevenlabs-music_v2.mp3')
      expect(metadata?.musicFileSize).toBe(3)
      expect(await Bun.file(join(dir, 'generated-music.mp3')).exists()).toBe(false)
      expect(await Bun.file(join(dir, 'generated-music-elevenlabs-music_v2.mp3')).exists()).toBe(true)
    })
  })

  test('generation resume without provider flags retries stored missing providers', async () => {
    await withTempDir('autoshow-generation-additive-missing-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-2' }
      const gemini = { service: 'gemini', model: 'gemini-3.1-flash-lite-image' }
      const ranTargets: ProviderIdentity[] = []
      await writeFakeImageRun(dir, [openai, gemini], [{ ...openai, processingTime: 10 }])

      await expect(hasResumableGenerationWork(
        fakeTarget(dir),
        fakeResumeConfig([], ranTargets),
        {} as ResolvedFlagOptions,
        new Set()
      )).resolves.toBe(true)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([], ranTargets),
        {} as ResolvedFlagOptions,
        new Set()
      )

      const record = await readCanonicalRecord(dir)
      expect(ranTargets).toEqual([gemini])
      expect(record['requestedProviders']).toEqual([openai, gemini])
      expect(record['image']).toEqual([
        { ...openai, processingTime: 10 },
        { ...gemini, processingTime: 1 }
      ])
    })
  })

  test('generation resume appends explicit new providers to a full run', async () => {
    await withTempDir('autoshow-generation-additive-new-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-2' }
      const gemini = { service: 'gemini', model: 'gemini-3.1-flash-lite-image' }
      const ranTargets: ProviderIdentity[] = []
      await writeFakeImageRun(dir, [openai], [{ ...openai, processingTime: 10 }])

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([gemini], ranTargets),
        {} as ResolvedFlagOptions,
        new Set(['fake-provider'])
      )

      const record = await readCanonicalRecord(dir)
      expect(ranTargets).toEqual([gemini])
      expect(record['requestedProviders']).toEqual([openai, gemini])
    })
  })

  test('generation resume price reconstructs targets without running providers', async () => {
    await withTempDir('autoshow-generation-price-targets-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-2' }
      const gemini = { service: 'gemini', model: 'gemini-3.1-flash-lite-image' }
      const pricedTargets: ProviderIdentity[] = []
      await writeFakeImageRun(dir, [openai, gemini], [{ ...openai, processingTime: 10 }])

      const estimate = await priceGenerationTarget(
        fakeTarget(dir),
        {
          ...fakeResumeConfig([], []),
          runMissingTargets: async () => {
            throw new Error('runner should not be called')
          },
          buildEstimates: (opts: ResolvedFlagOptions) => {
            const targets = collectFakeTargetsFromOptions(opts)
            pricedTargets.push(...targets)
            return [{
                step: 'image',
                provider: 'gemini',
                model: 'gemini-3.1-flash-lite-image',
                imageCount: 1,
                totalCost: 1
              }]
          }
        },
        {} as ResolvedFlagOptions,
        new Set()
      )

      expect(pricedTargets).toEqual([gemini])
      expect(estimate.totalEstimatedCost).toBe(1)
    })
  })

  test('generation resume skips already successful explicit providers', async () => {
    await withTempDir('autoshow-generation-additive-skip-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-2' }
      const ranTargets: ProviderIdentity[] = []
      await writeFakeImageRun(dir, [openai], [{ ...openai, processingTime: 10 }])

      await expect(hasResumableGenerationWork(
        fakeTarget(dir),
        fakeResumeConfig([openai], ranTargets),
        {} as ResolvedFlagOptions,
        new Set(['fake-provider'])
      )).resolves.toBe(false)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([openai], ranTargets),
        {} as ResolvedFlagOptions,
        new Set(['fake-provider'])
      )

      expect(ranTargets).toEqual([])
    })
  })

  test('generation resume treats selected providers as complete while unrelated providers remain missing', async () => {
    await withTempDir('autoshow-generation-selected-complete-', async (dir) => {
      const openai = { service: 'openai', model: 'gpt-image-2' }
      const gemini = { service: 'gemini', model: 'gemini-3.1-flash-lite-image' }
      const ranTargets: ProviderIdentity[] = []
      await writeFakeImageRun(dir, [openai, gemini], [{ ...openai, processingTime: 10 }])

      const result = await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([openai], ranTargets),
        {} as ResolvedFlagOptions,
        new Set(['fake-provider'])
      )

      const record = await readCanonicalRecord(dir)
      expect(result).toEqual({ full: 1, incomplete: 0, failed: 0 })
      expect(ranTargets).toEqual([])
      expect(record['requestedProviders']).toEqual([openai, gemini])
      expect(record['image']).toEqual([{ ...openai, processingTime: 10 }])
    })
  })

  test('URL article resume uses selected targets for additive provider planning', () => {
    const firecrawl = { service: 'firecrawl' as const, model: 'firecrawl' as const }
    const zyte = { service: 'zyte' as const, model: 'zyte' as const }
    const spider = { service: 'spider' as const, model: 'spider' as const }
    const metadata = {
      resolvedStep2: { route: 'article' },
      requestedProviders: [firecrawl, zyte],
      providerStates: [
        {
          ...firecrawl,
          artifactDir: 'providers/firecrawl',
          status: 'succeeded',
          attempts: 1
        },
        {
          ...zyte,
          artifactDir: 'providers/zyte',
          status: 'failed',
          attempts: 2,
          lastError: { message: 'timeout' }
        }
      ]
    }

    expect(resolveUrlArticleResumePlan(metadata)).toMatchObject({
      requestedTargets: [firecrawl, zyte],
      targetsToRun: [zyte],
      requestedBackends: ['firecrawl', 'zyte'],
      backendsToRun: ['zyte']
    })

    const selectedSpiderTargets = getSelectedUrlTargets(buildOptsFromFlags({
      'url-provider': 'spider'
    }, {}, new Set(['url-provider'])))
    expect(selectedSpiderTargets).toEqual([spider])
    expect(resolveUrlArticleResumePlan(metadata, selectedSpiderTargets)).toMatchObject({
      requestedTargets: [firecrawl, zyte, spider],
      targetsToRun: [spider],
      skippedSuccessfulTargets: [],
      requestedBackends: ['firecrawl', 'zyte', 'spider'],
      backendsToRun: ['spider'],
      skippedSuccessfulBackends: []
    })

    const selectedFirecrawlTargets = getSelectedUrlTargets(buildOptsFromFlags({
      'url-provider': 'firecrawl'
    }, {}, new Set(['url-provider'])))
    expect(resolveUrlArticleResumePlan(metadata, selectedFirecrawlTargets)).toMatchObject({
      targetsToRun: [],
      skippedSuccessfulTargets: [firecrawl],
      backendsToRun: [],
      skippedSuccessfulBackends: ['firecrawl']
    })

    const allHostedTargets = getSelectedUrlTargets(buildOptsFromFlags({
      'all-url': true
    }, {}, new Set(['all-url'])))
    expect(allHostedTargets).toEqual([
      firecrawl,
      { service: 'glm-reader', model: 'glm-reader' },
      spider,
      { service: 'supadata', model: 'supadata' },
      zyte
    ])
  })
})
