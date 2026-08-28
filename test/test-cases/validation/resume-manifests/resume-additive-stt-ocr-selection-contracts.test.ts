import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { PIPELINE_MANIFEST_FILE } from '~/cli/commands/process-steps/pipeline-manifest'
import { hasResumableOcrTargetWork } from '~/cli/commands/setup-and-utilities/resume/extract/ocr-resume'
import { hasResumableSttTargetWork, priceSttTarget } from '~/cli/commands/setup-and-utilities/resume/extract/stt-resume'
import type { OcrTarget, ResolvedFlagOptions, SttTarget } from '~/types'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

describe('additive resume provider selection', () => {
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
      }, {} as ResolvedFlagOptions)

      expect(estimate.steps.map((step) => `${step.provider}/${step.model}`)).toEqual(['whisper/tiny'])
    })
  })
})
