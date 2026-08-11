import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { getGenerationTargetKey } from '~/cli/commands/process-steps/generation-command-utils'
import { priceGenerationTarget, resumeGenerationTarget, hasResumableGenerationWork } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { PIPELINE_MANIFEST_FILE, readSinglePipelineItemRecord, writePipelineItemRecords } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { hasResumableProviderTargetWork, runProviderResumePass } from '~/cli/commands/setup-and-utilities/resume/provider-batch-resume'
import {
  resolveAdditiveResumeProviderSelection
} from '~/cli/commands/setup-and-utilities/resume/resume-provider-selection'
import { getSelectedUrlTargets, resolveUrlArticleResumePlan } from '~/cli/commands/setup-and-utilities/resume/extract/url-resume'
import { hasResumableOcrTargetWork } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { hasResumableSttTargetWork, priceSttTarget } from '~/cli/commands/setup-and-utilities/resume/extract/stt-resume'
import { finalizeMusicResumeArtifacts } from '~/cli/commands/setup-and-utilities/resume/generation/music-resume'
import { buildProviderStates as buildSttProviderStates, readExistingSttRun } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-run-state'
import type { OcrTarget, PipelineItemRecord, ProviderBatchResumeConfig, ProviderIdentity, ResumeFakeMetadata, ResumeFakeProviderResumeEntry, ResumeTarget, SttProviderState, SttProviderSuccess, SttTarget } from '~/types'
import { readCanonicalManifest, readCanonicalRecord, writeProviderResultFixture, writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const FAKE_MODEL_FIELDS = {
  openai: ['openaiImageModels', 'openaiImageModel'],
  gemini: ['geminiImageModels', 'geminiImageModel']
} as const

type ResolvedOptions = ReturnType<typeof buildOptsFromFlags>

const collectFakeTargetsFromOptions = (opts: ResolvedOptions): ProviderIdentity[] => {
  const valuesByField = opts as Record<string, unknown>
  return Object.entries(FAKE_MODEL_FIELDS).flatMap(([service, [modelsField, modelField]]) => {
    const models = valuesByField[modelsField] ?? valuesByField[modelField]
    const values = Array.isArray(models) ? models : [models]
    return values.flatMap((model) => typeof model === 'string' ? [{ service, model }] : [])
  })
}

const fakeResumeConfig = (
  selectedTargets: ProviderIdentity[],
  ranTargets: ProviderIdentity[]
) => ({
  kind: 'image' as const,
  metadataKey: 'image',
  stepLabel: 'Fake image',
  providerFlags: ['fake-provider'],
  selectionMode: 'additive-stored' as const,
  modelFields: FAKE_MODEL_FIELDS,
  getSuccessKey: (entry: ResumeFakeMetadata) =>
    getGenerationTargetKey(entry.service, entry.model),
  collectTargets: (opts: ResolvedOptions) =>
    selectedTargets.length > 0 ? selectedTargets : collectFakeTargetsFromOptions(opts),
  runMissingTargets: async (targets: ProviderIdentity[]) => {
    ranTargets.push(...targets)
    return targets.map((target) => ({
      ...target,
      processingTime: 1
    }))
  },
  buildEstimates: () => [],
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
  await writeSingleManifestFixture(dir, 'image', {
    input: 'prompt',
    requestedProviders,
    image: metadata
  })
}

const fakeTarget = (dir: string): ResumeTarget => ({
  kind: 'image',
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
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
    rawRecord: entry
  }
}

const readFakeProviderItemRecord = async (
  outputDir: string
): Promise<PipelineItemRecord> => {
  const record = await readSinglePipelineItemRecord(outputDir, { command: 'extract' })
  if (!record) {
    throw new Error(`Missing fake provider manifest at ${outputDir}`)
  }
  return record
}

const fakeProviderResumeConfig = (
  ranTargets: ProviderIdentity[]
): ProviderBatchResumeConfig<ProviderIdentity, ResumeFakeProviderResumeEntry> => ({
  stepLabel: 'Fake provider',
  readItemRecord: readFakeProviderItemRecord,
  parseRecord: async (record: unknown) => parseFakeProviderResumeEntry(record),
  getProviderLabels: (targets: ProviderIdentity[]) =>
    targets.map((target) => `${target.service}/${target.model}`),
  processEntry: async ({ entry }) => {
    ranTargets.push(...entry.missingTargets)
    const record = {
      ...entry.rawRecord,
      completionStatus: 'full',
      missingProviders: [],
      providerStates: entry.requestedTargets.map((target) => ({
        ...target,
        status: 'succeeded'
      }))
    }
    await writeSingleManifestFixture(entry.outputDir, 'extract', record, { extractRoute: 'document' })
    return {
      outputDir: entry.outputDir,
      record,
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
      const completeDir = join(batchDir, 'complete')
      const incompleteDir = join(batchDir, 'incomplete')
      await Promise.all([
        mkdir(singleDir, { recursive: true }),
        mkdir(batchDir, { recursive: true }),
        mkdir(completeDir, { recursive: true }),
        mkdir(incompleteDir, { recursive: true })
      ])

      const alpha = { service: 'alpha', model: 'one' }
      const beta = { service: 'beta', model: 'two' }
      await writeSingleManifestFixture(singleDir, 'extract', {
        outputDir: singleDir,
        completionStatus: 'incomplete',
        requestedProviders: [alpha],
        missingProviders: [alpha]
      }, { extractRoute: 'document' })

      const singleRanTargets: ProviderIdentity[] = []
      const singleTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'single',
        dir: singleDir,
        manifestPath: join(singleDir, PIPELINE_MANIFEST_FILE)
      }
      await expect(hasResumableProviderTargetWork(
        singleTarget,
        fakeProviderResumeConfig(singleRanTargets)
      )).resolves.toBe(true)
      const singleResult = await runProviderResumePass(
        singleTarget,
        {} as ResolvedOptions,
        fakeProviderResumeConfig(singleRanTargets)
      )
      const singleRecord = await readCanonicalRecord(singleDir)
      expect(singleResult).toMatchObject({ ok: 1, incomplete: 0, fail: 0, attemptedEntries: 1 })
      expect(singleRanTargets).toEqual([alpha])
      expect(singleRecord['completionStatus']).toBe('full')
      expect(singleRecord['outputDir']).toBe(singleDir)

      await writeSingleManifestFixture(completeDir, 'extract', {
        outputDir: completeDir,
        completionStatus: 'full',
        requestedProviders: [alpha],
        providerStates: [{
          ...alpha,
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1,
          metadata: {}
        }],
        missingProviders: []
      }, { extractRoute: 'document' })
      await writeSingleManifestFixture(incompleteDir, 'extract', {
        outputDir: incompleteDir,
        completionStatus: 'incomplete',
        requestedProviders: [beta],
        missingProviders: [beta]
      }, { extractRoute: 'document' })
      await writePipelineItemRecords(batchDir, 'extract', 'batch', [
        {
          outputDir: completeDir,
          completionStatus: 'full',
          requestedProviders: [alpha],
          providerStates: [{
            ...alpha,
            artifactDir: '.',
            status: 'succeeded',
            attempts: 1,
            metadata: {}
          }],
          missingProviders: []
        },
        {
          outputDir: incompleteDir,
          completionStatus: 'incomplete',
          requestedProviders: [beta],
          missingProviders: [beta]
        }
      ], { extractRoute: 'document' })

      const batchRanTargets: ProviderIdentity[] = []
      const batchTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'batch',
        dir: batchDir,
        manifestPath: join(batchDir, PIPELINE_MANIFEST_FILE)
      }
      const batchResult = await runProviderResumePass(
        batchTarget,
        {} as ResolvedOptions,
        fakeProviderResumeConfig(batchRanTargets)
      )
      const batchManifest = await readCanonicalManifest(batchDir)
      expect(batchResult).toMatchObject({ ok: 2, incomplete: 0, fail: 0, attemptedEntries: 1 })
      expect(batchRanTargets).toEqual([beta])
      expect(batchManifest.items.map((entry) => entry.status)).toEqual(['full', 'full'])
    })
  })

  test('generic provider batch resume rejects a corrupt canonical item without rewriting it', async () => {
    await withTempDir('autoshow-provider-resume-corrupt-item-', async (dir) => {
      const manifestPath = join(dir, PIPELINE_MANIFEST_FILE)
      const now = new Date().toISOString()
      const original = `${JSON.stringify({
        command: 'extract',
        scope: 'batch',
        createdAt: now,
        updatedAt: now,
        items: ['corrupt-item']
      }, null, 2)}\n`
      await Bun.write(manifestPath, original)
      const ranTargets: ProviderIdentity[] = []

      await expect(runProviderResumePass({
        kind: 'extract',
        extractRoute: 'document',
        scope: 'batch',
        dir,
        manifestPath
      }, {} as ResolvedOptions, fakeProviderResumeConfig(ranTargets))).rejects.toThrow(
        `Invalid canonical manifest at ${manifestPath}`
      )
      expect(ranTargets).toEqual([])
      expect(await Bun.file(manifestPath).text()).toBe(original)
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
        {} as ResolvedOptions,
        new Set()
      )).resolves.toBe(true)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([], ranTargets),
        {} as ResolvedOptions,
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

  test('STT resume keeps completed retired models readable but blocks unfinished retired targets', async () => {
    await withTempDir('autoshow-stt-retired-model-resume-', async (dir) => {
      const completeDir = join(dir, 'complete')
      const incompleteDir = join(dir, 'incomplete')
      const retired = { service: 'assemblyai' as const, model: 'universal-3-pro' }
      await Promise.all([
        mkdir(completeDir, { recursive: true }),
        mkdir(incompleteDir, { recursive: true })
      ])
      await writeSingleManifestFixture(completeDir, 'extract', {
        step1: { url: 'file:///tmp/historical.mp3' },
        completionStatus: 'full',
        requestedProviders: [retired],
        missingProviders: [],
        providerStates: [{ ...retired, status: 'succeeded', artifactDir: 'providers/assemblyai-universal-3-pro', attempts: 1 }]
      }, { extractRoute: 'media' })
      await writeSingleManifestFixture(incompleteDir, 'extract', {
        step1: { url: 'file:///tmp/historical.mp3' },
        completionStatus: 'incomplete',
        requestedProviders: [retired],
        missingProviders: [retired],
        providerStates: [{ ...retired, status: 'missing', artifactDir: 'providers/assemblyai-universal-3-pro', attempts: 0 }]
      }, { extractRoute: 'media' })

      const completeTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'media',
        scope: 'single',
        dir: completeDir,
        manifestPath: join(completeDir, PIPELINE_MANIFEST_FILE)
      }
      const incompleteTarget: ResumeTarget = {
        ...completeTarget,
        dir: incompleteDir,
        manifestPath: join(incompleteDir, PIPELINE_MANIFEST_FILE)
      }

      await expect(hasResumableSttTargetWork(
        completeTarget,
        undefined,
        { youtubeCaptions: false, currentTargets: [] }
      )).resolves.toBe(false)
      await expect(priceSttTarget(
        incompleteTarget,
        { youtubeCaptions: false } as ResolvedOptions
      )).rejects.toThrow('Stored STT target assemblyai/universal-3-pro is incomplete')
      await expect(priceSttTarget(
        incompleteTarget,
        { youtubeCaptions: false } as ResolvedOptions
      )).rejects.toThrow('Start a new target with an active assemblyai model.')
    })
  })

  test('STT resume reconstructs compacted successes from canonical provider results only', async () => {
    await withTempDir('autoshow-stt-compacted-resume-', async (dir) => {
      const target: SttTarget = { service: 'assemblyai', model: 'universal-2', local: false }
      const providerDir = join(dir, 'providers', 'assemblyai-universal-2')
      const canonicalResult = {
        text: 'Compacted transcript.',
        segments: [{ start: '00:00:00', end: '00:00:01', text: 'Compacted transcript.' }],
        evidence: { timingQuality: 'coarse' as const }
      }
      await mkdir(providerDir, { recursive: true })
      await writeSingleManifestFixture(dir, 'extract', {
        step1: { url: 'file:///tmp/audio.mp3' },
        completionStatus: 'incomplete',
        requestedProviders: [target, { service: 'speechmatics', model: 'melia-1', local: false }],
        missingProviders: [{ service: 'speechmatics', model: 'melia-1', local: false }],
        providerStates: [{
          ...target,
          status: 'succeeded',
          artifactDir: 'providers/assemblyai-universal-2',
          attempts: 1,
          metadata: {
            transcriptionService: target.service,
            transcriptionModel: target.model,
            processingTime: 10,
            tokenCount: 2
          },
          result: canonicalResult
        }]
      }, { extractRoute: 'media' })
      await writeProviderResultFixture(
        providerDir,
        {
          text: 'User-facing artifact is not resume control state.',
          segments: []
        }
      )

      const existing = await readExistingSttRun(dir, [target])

      expect(existing.successes[0]?.result).toEqual(canonicalResult)
      expect(await Bun.file(join(providerDir, 'transcription.txt')).exists()).toBe(false)
    })
  })

  test('STT provider-state reconciliation preserves artifact locations and one attempt per run', () => {
    const resumedRoot: SttTarget = { service: 'whisper', model: 'large-v3-turbo', local: true }
    const freshSuccess: SttTarget = { service: 'assemblyai', model: 'universal-2', local: false }
    const currentFailure: SttTarget = { service: 'deepgram', model: 'nova-3', local: false }
    const freshFailure: SttTarget = { service: 'groq', model: 'whisper-large-v3-turbo', local: false }
    const untouched: SttTarget = { service: 'speechmatics', model: 'melia-1', local: false }
    const attemptedSkip: SttTarget = { service: 'soniox', model: 'stt-rt-v4', local: false }
    const schedulerSkip: SttTarget = { service: 'reverb', model: 'reverb_asr_v2', local: false }
    const requestedTargets = [resumedRoot, freshSuccess, currentFailure, freshFailure, untouched, attemptedSkip, schedulerSkip]
    const successes: Array<SttProviderSuccess | undefined> = [
      {
        target: resumedRoot,
        metadata: {} as SttProviderSuccess['metadata'],
        result: {} as SttProviderSuccess['result'],
        relativeDir: '.'
      },
      {
        target: freshSuccess,
        metadata: {} as SttProviderSuccess['metadata'],
        result: {} as SttProviderSuccess['result']
      },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    ]
    const failures = new Map([
      [2, { message: 'current failure', retryable: true }],
      [3, { message: 'fresh failure', retryable: true }],
      [5, { message: 'provider classified this attempt as skipped', retryable: false, skipped: true }]
    ])
    const existingStates = new Map<string, SttProviderState>([
      ['whisper:large-v3-turbo', { ...resumedRoot, artifactDir: '.', status: 'succeeded', attempts: 3 }],
      ['deepgram:nova-3', { ...currentFailure, artifactDir: 'providers/deepgram-nova-3', status: 'failed', attempts: 5 }],
      ['speechmatics:melia-1', { ...untouched, artifactDir: 'providers/speechmatics-melia-1', status: 'missing', attempts: 2 }],
      ['soniox:stt-rt-v4', { ...attemptedSkip, artifactDir: 'providers/soniox-stt-rt-v4', status: 'skipped', attempts: 4 }],
      ['reverb:reverb_asr_v2', { ...schedulerSkip, artifactDir: 'providers/reverb-reverb_asr_v2', status: 'skipped', attempts: 0 }]
    ])

    const states = buildSttProviderStates(requestedTargets, successes, failures, existingStates)

    expect(states.slice(0, 5).map(({ artifactDir, status, attempts }) => ({ artifactDir, status, attempts }))).toEqual([
      { artifactDir: '.', status: 'succeeded', attempts: 3 },
      { artifactDir: 'providers/assemblyai-universal-2', status: 'succeeded', attempts: 1 },
      { artifactDir: 'providers/deepgram-nova-3', status: 'failed', attempts: 5 },
      { artifactDir: 'providers/groq-whisper-large-v3-turbo', status: 'failed', attempts: 1 },
      { artifactDir: 'providers/speechmatics-melia-1', status: 'missing', attempts: 2 }
    ])
    expect(states[5]).toMatchObject({ status: 'skipped', attempts: 4 })
    expect(states[6]).toMatchObject({ status: 'skipped', attempts: 0 })
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
        {} as ResolvedOptions,
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
          buildEstimates: (opts: ResolvedOptions) => {
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
        {} as ResolvedOptions,
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
        {} as ResolvedOptions,
        new Set(['fake-provider'])
      )).resolves.toBe(false)

      await resumeGenerationTarget(
        fakeTarget(dir),
        fakeResumeConfig([openai], ranTargets),
        {} as ResolvedOptions,
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
        {} as ResolvedOptions,
        new Set(['fake-provider'])
      )

      const record = await readCanonicalRecord(dir)
      expect(result).toEqual({ full: 1, incomplete: 0, failed: 0 })
      expect(ranTargets).toEqual([])
      expect(record['requestedProviders']).toEqual([openai, gemini])
      expect(record['image']).toEqual([{ ...openai, processingTime: 10 }])
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
      await writeSingleManifestFixture(sttDir, 'extract', {
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
      }, { extractRoute: 'media' })

      const tesseract: OcrTarget = { service: 'tesseract', model: 'tesseract' }
      const openaiOcr: OcrTarget = { service: 'openai', model: 'gpt-5.4-mini' }
      await writeSingleManifestFixture(ocrDir, 'extract', {
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
      }, { extractRoute: 'document' })

      await expect(hasResumableSttTargetWork(
        {
          kind: 'extract',
          extractRoute: 'media',
          scope: 'single',
          dir: sttDir,
          manifestPath: join(sttDir, PIPELINE_MANIFEST_FILE)
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
          manifestPath: join(sttDir, PIPELINE_MANIFEST_FILE)
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
          manifestPath: join(ocrDir, PIPELINE_MANIFEST_FILE)
        },
        [openaiOcr]
      )).resolves.toBe(true)
      await expect(hasResumableOcrTargetWork(
        {
          kind: 'extract',
          extractRoute: 'document',
          scope: 'single',
          dir: ocrDir,
          manifestPath: join(ocrDir, PIPELINE_MANIFEST_FILE)
        },
        [tesseract]
      )).resolves.toBe(false)
    })
  })

  test('STT resume price estimates only missing stored providers', async () => {
    await withTempDir('autoshow-stt-resume-price-targets-', async (dir) => {
      const whisper: SttTarget = { service: 'whisper', model: 'tiny', local: true }
      const deepgram: SttTarget = { service: 'deepgram', model: 'nova-3', local: false }
      await writeSingleManifestFixture(dir, 'extract', {
        step1: { url: 'file:///tmp/audio.mp3' },
        completionStatus: 'incomplete',
        requestedProviders: [whisper, deepgram],
        missingProviders: [whisper],
        providerStates: [{
          ...deepgram,
          artifactDir: 'providers/deepgram-nova-3',
          status: 'succeeded',
          attempts: 1,
          metadata: {
            transcriptionService: 'deepgram',
            transcriptionModel: 'nova-3',
            processingTime: 1,
            tokenCount: 1
          },
          result: {
            text: 'Completed Deepgram transcript.',
            segments: [{
              start: '00:00:00',
              end: '00:00:01',
              text: 'Completed Deepgram transcript.'
            }]
          }
        }]
      }, { extractRoute: 'media' })

      const estimate = await priceSttTarget({
        kind: 'extract',
        extractRoute: 'media',
        scope: 'single',
        dir,
        manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
      }, {} as ResolvedOptions)

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

    const selectedFirecrawlTargets = getSelectedUrlTargets(buildOptsFromFlags(false, {
      'url-provider': 'firecrawl'
    }, {}, new Set(['url-provider'])))
    expect(resolveUrlArticleResumePlan(metadata, selectedFirecrawlTargets)).toMatchObject({
      targetsToRun: [],
      skippedSuccessfulTargets: [firecrawl],
      backendsToRun: [],
      skippedSuccessfulBackends: ['firecrawl']
    })

    const allHostedTargets = getSelectedUrlTargets(buildOptsFromFlags(false, {
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
