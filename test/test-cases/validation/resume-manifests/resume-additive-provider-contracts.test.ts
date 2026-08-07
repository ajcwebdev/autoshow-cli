import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { priceGenerationTarget, resumeGenerationTarget, hasResumableGenerationWork } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { readBatchManifest, readRunManifest, writeBatchManifest, writeRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/download-targets/build-opts-from-flags/build-options-from-flags'
import { hasResumableProviderTargetWork, runProviderResumePass } from '~/cli/commands/setup-and-utilities/resume/provider-batch-resume'
import {
  resolveAdditiveResumeProviderSelection
} from '~/cli/commands/setup-and-utilities/resume/resume-provider-selection'
import { getSelectedUrlTargets, resolveUrlArticleResumePlan } from '~/cli/commands/setup-and-utilities/resume/extract/url-resume'
import { hasResumableOcrTargetWork } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { writeOcrRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-manifest'
import { hasResumableSttTargetWork, priceSttTarget } from '~/cli/commands/setup-and-utilities/resume/extract/stt-resume'
import { finalizeMusicResumeArtifacts } from '~/cli/commands/setup-and-utilities/resume/generation/music-resume'
import { writeSttRunManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-manifest'
import { readExistingSttRun } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-run-state'
import type { BatchManifestEntry, OcrTarget, ProviderBatchResumeConfig, ProviderIdentity, ResumeFakeMetadata, ResumeFakeProviderResumeEntry, ResumeTarget, RuntimeOptions, SttTarget } from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const withTempDir = async <T>(
  prefix: string,
  fn: (dir: string) => Promise<T>
): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const fakeResumeConfig = (
  selectedTargets: ProviderIdentity[],
  ranTargets: ProviderIdentity[]
) => ({
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Fake image',
  providerFlags: ['fake-provider'],
  getSuccessKey: (entry: ResumeFakeMetadata) =>
    getGenerationTargetKey(entry.service, entry.model),
  collectTargets: () => selectedTargets,
  collectTargetsForProviders: (providers: ProviderIdentity[]) =>
    providers.map((provider) => ({ ...provider })),
  runMissingTargets: async (targets: ProviderIdentity[]) => {
    ranTargets.push(...targets)
    return targets.map((target) => ({
      ...target,
      processingTime: 1
    }))
  },
  priceTargets: async () => ({
    steps: [],
    totalEstimatedCost: 0
  }),
  rebuildRunMetadata: (metadata: ResumeFakeMetadata[]) => ({
    cost: {
      actual: {
        totalCost: 0,
        steps: metadata.map((entry) => ({
          step: 'image',
          provider: entry.service,
          model: entry.model,
          cost: 0
        }))
      }
    },
    timing: {
      actual: {
        totalProcessingTimeMs: metadata.reduce((sum, entry) => sum + entry.processingTime, 0),
        steps: []
      }
    }
  })
})

const writeFakeImageRun = async (
  dir: string,
  requestedProviders: ProviderIdentity[],
  metadata: ResumeFakeMetadata[]
): Promise<void> => {
  await writeRunManifest(dir, 'image', {
    input: 'prompt',
    requestedProviders,
    image: metadata
  })
}

const fakeTarget = (dir: string): ResumeTarget => ({
  kind: 'image',
  scope: 'single',
  dir,
  manifestPath: join(dir, 'run.json')
})

const parseFakeProviderResumeEntry = (
  entry: unknown
): ResumeFakeProviderResumeEntry | undefined => {
  if (!isRecord(entry) || typeof entry['outputDir'] !== 'string') {
    return undefined
  }

  const requestedTargets = Array.isArray(entry['requestedProviders'])
    ? entry['requestedProviders'].filter(
        (provider): provider is ProviderIdentity =>
          isRecord(provider)
          && typeof provider['service'] === 'string'
          && typeof provider['model'] === 'string'
      )
    : []
  const missingTargets = Array.isArray(entry['missingProviders'])
    ? entry['missingProviders'].filter(
        (provider): provider is ProviderIdentity =>
          isRecord(provider)
          && typeof provider['service'] === 'string'
          && typeof provider['model'] === 'string'
      )
    : []

  return {
    outputDir: entry['outputDir'],
    source: {},
    requestedTargets,
    missingTargets,
    completionStatus: entry['completionStatus'] === 'full' ? 'full' : 'incomplete',
    rawEntry: entry
  }
}

const readFakeProviderOutputMetadata = async (
  outputDir: string
): Promise<BatchManifestEntry> => {
  const manifest = await readRunManifest(outputDir, 'extract')
  if (!manifest) {
    throw new Error(`Missing fake provider manifest at ${outputDir}`)
  }
  return manifest.metadata
}

const fakeProviderResumeConfig = (
  ranTargets: ProviderIdentity[]
): ProviderBatchResumeConfig<ProviderIdentity, ResumeFakeProviderResumeEntry> => ({
  stepLabel: 'Fake provider',
  readOutputMetadata: readFakeProviderOutputMetadata,
  writeBatchManifest: async (
    batchDir: string,
    entries: BatchManifestEntry[],
    source?: Record<string, unknown>
  ) => await writeBatchManifest(batchDir, 'extract', entries, source),
  writeRunManifest: async (
    outputDir: string,
    metadata: Record<string, unknown>
  ) => await writeRunManifest(outputDir, 'extract', metadata),
  parseEntry: async (entry: unknown) => parseFakeProviderResumeEntry(entry),
  getProviderLabels: (targets: ProviderIdentity[]) =>
    targets.map((target) => `${target.service}/${target.model}`),
  processEntry: async ({ entry }) => {
    ranTargets.push(...entry.missingTargets)
    const metadata = {
      ...entry.rawEntry,
      completionStatus: 'full',
      missingProviders: [],
      providerStates: entry.requestedTargets.map((target) => ({
        ...target,
        status: 'succeeded'
      }))
    }
    await writeRunManifest(entry.outputDir, 'extract', metadata)
    return {
      outputDir: entry.outputDir,
      metadata,
      completionStatus: 'full' as const,
      detail: 'resume complete'
    }
  }
})

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

  test('shared resolver preserves stored order and appends new selected providers', () => {
    const openai = { service: 'openai', model: 'gpt-image-2' }
    const gemini = { service: 'gemini', model: 'gemini-3.1-flash-lite-image' }
    const runway = { service: 'runway', model: 'gen4.5' }

    const resolved = resolveAdditiveResumeProviderSelection({
      storedProviders: [openai, gemini],
      runnableStoredProviders: [gemini],
      selectedProviders: [runway, openai, gemini],
      successfulProviderKeys: new Set([getGenerationTargetKey(openai.service, openai.model)])
    })

    expect(resolved.requestedProviders).toEqual([openai, gemini, runway])
    expect(resolved.providersToRun).toEqual([runway, gemini])
    expect(resolved.skippedSuccessfulProviders).toEqual([openai])
  })

  test('generic provider batch engine resumes single and batch targets in place', async () => {
    await withTempDir('autoshow-provider-resume-engine-', async (dir) => {
      const singleDir = join(dir, 'single')
      const batchDir = join(dir, 'batch')
      const completeDir = join(dir, 'complete')
      const incompleteDir = join(dir, 'incomplete')
      await Promise.all([
        mkdir(singleDir, { recursive: true }),
        mkdir(batchDir, { recursive: true }),
        mkdir(completeDir, { recursive: true }),
        mkdir(incompleteDir, { recursive: true })
      ])

      const alpha = { service: 'alpha', model: 'one' }
      const beta = { service: 'beta', model: 'two' }
      await writeRunManifest(singleDir, 'extract', {
        outputDir: singleDir,
        completionStatus: 'incomplete',
        requestedProviders: [alpha],
        missingProviders: [alpha]
      })

      const singleRanTargets: ProviderIdentity[] = []
      const singleTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'single',
        dir: singleDir,
        manifestPath: join(singleDir, 'run.json')
      }
      await expect(hasResumableProviderTargetWork(
        singleTarget,
        fakeProviderResumeConfig(singleRanTargets)
      )).resolves.toBe(true)
      const singleResult = await runProviderResumePass(
        singleTarget,
        {} as RuntimeOptions,
        fakeProviderResumeConfig(singleRanTargets)
      )
      const singleManifest = await readRunManifest(singleDir, 'extract')
      expect(singleResult).toMatchObject({ ok: 1, incomplete: 0, fail: 0, attemptedEntries: 1 })
      expect(singleRanTargets).toEqual([alpha])
      expect(singleManifest?.metadata['completionStatus']).toBe('full')
      expect(singleManifest?.metadata['outputDir']).toBeUndefined()

      await writeRunManifest(completeDir, 'extract', {
        outputDir: completeDir,
        completionStatus: 'full',
        requestedProviders: [alpha],
        missingProviders: []
      })
      await writeRunManifest(incompleteDir, 'extract', {
        outputDir: incompleteDir,
        completionStatus: 'incomplete',
        requestedProviders: [beta],
        missingProviders: [beta]
      })
      await writeBatchManifest(batchDir, 'extract', [
        {
          outputDir: completeDir,
          completionStatus: 'full',
          requestedProviders: [alpha],
          missingProviders: []
        },
        {
          outputDir: incompleteDir,
          completionStatus: 'incomplete',
          requestedProviders: [beta],
          missingProviders: [beta]
        }
      ])

      const batchRanTargets: ProviderIdentity[] = []
      const batchTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'batch',
        dir: batchDir,
        manifestPath: join(batchDir, 'batch.json')
      }
      const batchResult = await runProviderResumePass(
        batchTarget,
        {} as RuntimeOptions,
        fakeProviderResumeConfig(batchRanTargets)
      )
      const batchManifest = await readBatchManifest(batchDir, 'extract')
      expect(batchResult).toMatchObject({ ok: 2, incomplete: 0, fail: 0, attemptedEntries: 1 })
      expect(batchRanTargets).toEqual([beta])
      expect(batchManifest?.manifest.items.map((entry) => entry['completionStatus'])).toEqual(['full', 'full'])
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
        {} as RuntimeOptions,
        new Set()
      )).resolves.toBe(true)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([], ranTargets),
        {} as RuntimeOptions,
        new Set()
      )

      const manifest = await readRunManifest(dir, 'image')
      expect(ranTargets).toEqual([gemini])
      expect(manifest?.metadata['requestedProviders']).toEqual([openai, gemini])
      expect(manifest?.metadata['image']).toEqual([
        { ...openai, processingTime: 10 },
        { ...gemini, processingTime: 1 }
      ])
    })
  })

  test('STT resume keeps completed retired models readable but blocks unfinished retired targets', async () => {
    await withTempDir('autoshow-stt-retired-model-resume-', async (dir) => {
      const completeDir = join(dir, 'complete')
      const incompleteDir = join(dir, 'incomplete')
      const retired = { service: 'assemblyai' as const, model: 'universal-3-pro' }
      await Promise.all([
        mkdir(completeDir, { recursive: true }),
        mkdir(incompleteDir, { recursive: true })
      ])
      await writeSttRunManifest(completeDir, {
        step1: { url: 'file:///tmp/historical.mp3' },
        completionStatus: 'full',
        requestedProviders: [retired],
        missingProviders: [],
        providerStates: [{ ...retired, status: 'succeeded', artifactDir: 'providers/assemblyai-universal-3-pro', attempts: 1 }]
      })
      await writeSttRunManifest(incompleteDir, {
        step1: { url: 'file:///tmp/historical.mp3' },
        completionStatus: 'incomplete',
        requestedProviders: [retired],
        missingProviders: [retired],
        providerStates: [{ ...retired, status: 'missing', artifactDir: 'providers/assemblyai-universal-3-pro', attempts: 0 }]
      })

      const completeTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'media',
        scope: 'single',
        dir: completeDir,
        manifestPath: join(completeDir, 'run.json')
      }
      const incompleteTarget: ResumeTarget = {
        ...completeTarget,
        dir: incompleteDir,
        manifestPath: join(incompleteDir, 'run.json')
      }

      await expect(hasResumableSttTargetWork(
        completeTarget,
        undefined,
        { youtubeCaptions: false, currentTargets: [] }
      )).resolves.toBe(false)
      await expect(priceSttTarget(
        incompleteTarget,
        { youtubeCaptions: false } as RuntimeOptions
      )).rejects.toThrow('Stored STT target assemblyai/universal-3-pro is incomplete')
      await expect(priceSttTarget(
        incompleteTarget,
        { youtubeCaptions: false } as RuntimeOptions
      )).rejects.toThrow('Start a new target with an active assemblyai model.')
    })
  })

  test('STT resume reconstructs compacted successes from provider result artifacts', async () => {
    await withTempDir('autoshow-stt-compacted-resume-', async (dir) => {
      const target: SttTarget = { service: 'assemblyai', model: 'universal-2', local: false }
      const providerDir = join(dir, 'providers', 'assemblyai-universal-2')
      await mkdir(providerDir, { recursive: true })
      await writeSttRunManifest(dir, {
        step1: { url: 'file:///tmp/audio.mp3' },
        completionStatus: 'incomplete',
        requestedProviders: [target, { service: 'speechmatics', model: 'melia-1', local: false }],
        missingProviders: [{ service: 'speechmatics', model: 'melia-1', local: false }],
        providerStates: [{
          ...target,
          status: 'succeeded',
          artifactDir: 'providers/assemblyai-universal-2',
          attempts: 1
        }]
      })
      await writeFile(join(providerDir, 'result.json'), `${JSON.stringify({
        schemaVersion: 2,
        kind: 'provider-result',
        provider: target.service,
        model: target.model,
        metadata: {
          transcriptionService: target.service,
          transcriptionModel: target.model,
          processingTime: 10,
          tokenCount: 2
        },
        result: {
          text: 'Compacted transcript.',
          segments: [{ start: '00:00:00', end: '00:00:01', text: 'Compacted transcript.' }],
          evidence: { timingQuality: 'coarse' }
        }
      })}\n`)

      const existing = await readExistingSttRun(dir, [target])

      expect(existing.successes[0]?.result).toEqual({
        text: 'Compacted transcript.',
        segments: [{ start: '00:00:00', end: '00:00:01', text: 'Compacted transcript.' }],
        evidence: { timingQuality: 'coarse' }
      })
      expect(await Bun.file(join(providerDir, 'transcription.txt')).exists()).toBe(false)
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
        {} as RuntimeOptions,
        new Set(['fake-provider'])
      )

      const manifest = await readRunManifest(dir, 'image')
      expect(ranTargets).toEqual([gemini])
      expect(manifest?.metadata['requestedProviders']).toEqual([openai, gemini])
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
          priceTargets: async (targets: ProviderIdentity[]) => {
            pricedTargets.push(...targets)
            return {
              steps: [{
                step: 'image',
                provider: 'gemini',
                model: 'gemini-3.1-flash-lite-image',
                imageCount: 1,
                totalCost: 1
              }],
              totalEstimatedCost: 1
            }
          }
        },
        {} as RuntimeOptions,
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
        {} as RuntimeOptions,
        new Set(['fake-provider'])
      )).resolves.toBe(false)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([openai], ranTargets),
        {} as RuntimeOptions,
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
        {} as RuntimeOptions,
        new Set(['fake-provider'])
      )

      const manifest = await readRunManifest(dir, 'image')
      expect(result).toEqual({ full: 1, incomplete: 0, failed: 0 })
      expect(ranTargets).toEqual([])
      expect(manifest?.metadata['requestedProviders']).toEqual([openai, gemini])
      expect(manifest?.metadata['image']).toEqual([{ ...openai, processingTime: 10 }])
    })
  })

  test('STT and OCR resume target checks include explicit new providers', async () => {
    await withTempDir('autoshow-extract-additive-targets-', async (dir) => {
      const sttDir = join(dir, 'stt')
      const ocrDir = join(dir, 'ocr')
      await Promise.all([
        mkdir(sttDir, { recursive: true }),
        mkdir(ocrDir, { recursive: true })
      ])

      const whisper: SttTarget = { service: 'whisper', model: 'tiny', local: true }
      const deepgram: SttTarget = { service: 'deepgram', model: 'nova-3', local: false }
      await writeSttRunManifest(sttDir, {
        step1: { url: 'file:///tmp/audio.mp3' },
        completionStatus: 'full',
        requestedProviders: [whisper],
        providerStates: [{
          service: 'whisper',
          model: 'tiny',
          local: true,
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1
        }]
      })

      const tesseract: OcrTarget = { service: 'tesseract', model: 'tesseract' }
      const openaiOcr: OcrTarget = { service: 'openai', model: 'gpt-5.4-mini' }
      await writeOcrRunManifest(ocrDir, {
        source: { filePath: '/tmp/document.pdf' },
        completionStatus: 'full',
        requestedProviders: [tesseract],
        providerStates: [{
          service: 'tesseract',
          model: 'tesseract',
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1
        }]
      })

      await expect(hasResumableSttTargetWork(
        {
          kind: 'extract',
          extractRoute: 'media',
          scope: 'single',
          dir: sttDir,
          manifestPath: join(sttDir, 'run.json')
        },
        [deepgram],
        { youtubeCaptions: false, currentTargets: [deepgram] }
      )).resolves.toBe(true)
      await expect(hasResumableSttTargetWork(
        {
          kind: 'extract',
          extractRoute: 'media',
          scope: 'single',
          dir: sttDir,
          manifestPath: join(sttDir, 'run.json')
        },
        [whisper],
        { youtubeCaptions: false, currentTargets: [whisper] }
      )).resolves.toBe(false)

      await expect(hasResumableOcrTargetWork(
        {
          kind: 'extract',
          extractRoute: 'document',
          scope: 'single',
          dir: ocrDir,
          manifestPath: join(ocrDir, 'run.json')
        },
        [openaiOcr]
      )).resolves.toBe(true)
      await expect(hasResumableOcrTargetWork(
        {
          kind: 'extract',
          extractRoute: 'document',
          scope: 'single',
          dir: ocrDir,
          manifestPath: join(ocrDir, 'run.json')
        },
        [tesseract]
      )).resolves.toBe(false)
    })
  })

  test('STT resume price estimates only missing stored providers', async () => {
    await withTempDir('autoshow-stt-resume-price-targets-', async (dir) => {
      const whisper: SttTarget = { service: 'whisper', model: 'tiny', local: true }
      const deepgram: SttTarget = { service: 'deepgram', model: 'nova-3', local: false }
      await writeSttRunManifest(dir, {
        step1: { url: 'file:///tmp/audio.mp3' },
        completionStatus: 'incomplete',
        requestedProviders: [whisper, deepgram],
        step2: {
          transcriptionService: 'deepgram',
          transcriptionModel: 'nova-3',
          processingTime: 1,
          tokenCount: 1
        }
      })

      const estimate = await priceSttTarget({
        kind: 'extract',
        extractRoute: 'media',
        scope: 'single',
        dir,
        manifestPath: join(dir, 'run.json')
      }, {} as RuntimeOptions)

      expect(estimate.steps.map((step) => `${step.provider}/${step.model}`)).toEqual(['whisper/tiny'])
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

    const selectedSpiderTargets = getSelectedUrlTargets(buildOptsFromFlags(false, {
      'url-provider': 'spider'
    }, [], {}, new Set(['url-provider'])))
    expect(selectedSpiderTargets).toEqual([spider])
    expect(resolveUrlArticleResumePlan(metadata, selectedSpiderTargets)).toMatchObject({
      requestedTargets: [firecrawl, zyte, spider],
      targetsToRun: [spider],
      skippedSuccessfulTargets: [],
      requestedBackends: ['firecrawl', 'zyte', 'spider'],
      backendsToRun: ['spider'],
      skippedSuccessfulBackends: []
    })

    const selectedFirecrawlTargets = getSelectedUrlTargets(buildOptsFromFlags(false, {
      'url-provider': 'firecrawl'
    }, [], {}, new Set(['url-provider'])))
    expect(resolveUrlArticleResumePlan(metadata, selectedFirecrawlTargets)).toMatchObject({
      targetsToRun: [],
      skippedSuccessfulTargets: [firecrawl],
      backendsToRun: [],
      skippedSuccessfulBackends: ['firecrawl']
    })

    const allHostedTargets = getSelectedUrlTargets(buildOptsFromFlags(false, {
      'all-url': true
    }, [], {}, new Set(['all-url'])))
    expect(allHostedTargets).toEqual([
      firecrawl,
      { service: 'glm-reader', model: 'glm-reader' },
      spider,
      { service: 'supadata', model: 'supadata' },
      zyte
    ])
  })
})
