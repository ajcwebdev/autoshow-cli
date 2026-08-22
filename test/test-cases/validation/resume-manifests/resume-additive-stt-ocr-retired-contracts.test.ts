import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { priceOcrTarget } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { hasResumableSttTargetWork, priceSttTarget } from '~/cli/commands/setup-and-utilities/resume/extract/stt-resume'
import { buildProviderStates as buildSttProviderStates, readExistingSttRun } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-run-state'
import type { OcrTarget, ResolvedFlagOptions, ResumeTarget, SttProviderState, SttProviderSuccess, SttTarget } from '~/types'
import { readCanonicalRecord, writeProviderResultFixture, writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

describe('additive resume provider selection', () => {
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
        { youtubeCaptions: false } as ResolvedFlagOptions
      )).rejects.toThrow('Stored STT target assemblyai/universal-3-pro is incomplete')
      await expect(priceSttTarget(
        incompleteTarget,
        { youtubeCaptions: false } as ResolvedFlagOptions
      )).rejects.toThrow('Start a new target with an active assemblyai model.')
    })
  })

  test('OCR resume blocks an unfinished retired target until its replacement is selected explicitly', async () => {
    await withTempDir('autoshow-ocr-retired-model-resume-', async (dir) => {
      const retired: OcrTarget = { service: 'gemini', model: 'gemini-3.1-flash-lite' }
      const replacement: OcrTarget = { service: 'gemini', model: 'gemini-3.5-flash-lite' }
      await writeSingleManifestFixture(dir, 'extract', {
        source: { filePath: join(process.cwd(), 'input/examples/document/1-document.pdf') },
        completionStatus: 'incomplete',
        requestedProviders: [retired],
        missingProviders: [retired],
        providerStates: [{ ...retired, status: 'missing', artifactDir: 'providers/gemini-gemini-3.1-flash-lite', attempts: 0 }]
      }, { extractRoute: 'document' })

      const resumeTarget: ResumeTarget = {
        kind: 'extract',
        extractRoute: 'document',
        scope: 'single',
        dir,
        manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
      }
      const opts = buildOptsFromFlags(false, {})

      await expect(priceOcrTarget(resumeTarget, opts)).rejects.toThrow(
        'Stored OCR target gemini/gemini-3.1-flash-lite is incomplete, but that model is no longer in the active registry.'
      )
      await expect(priceOcrTarget(resumeTarget, opts)).rejects.toThrow(
        'Re-run with --provider gemini=gemini-3.5-flash-lite to add the replacement as a distinct target.'
      )

      const estimate = await priceOcrTarget(resumeTarget, opts, [replacement])
      expect(estimate.steps).toHaveLength(1)
      expect(estimate.steps[0]).toMatchObject({
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite'
      })

      const record = await readCanonicalRecord(dir)
      expect(record['requestedProviders']).toEqual([retired])
      expect(record['missingProviders']).toEqual([retired])
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
    const schedulerSkip: SttTarget = { service: 'together', model: 'openai/whisper-large-v3', local: false }
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
      ['together:openai/whisper-large-v3', { ...schedulerSkip, artifactDir: 'providers/together-openai-whisper-large-v3', status: 'skipped', attempts: 0 }]
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
})
