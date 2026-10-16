import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OcrTarget, SttTarget } from '~/types'
import { createPipelineItemFromRecord } from '~/cli/commands/command-shared/pipeline-manifest/manifest-record-projection'
import { parseStoredRequestedTargets, toRequestedProvider as toSttRequestedProvider } from '~/cli/commands/stt/stt-batch/stt-run-state'
import { buildMissingProviders as buildOcrMissingProviders, toRequestedProvider as toOcrRequestedProvider } from '~/cli/commands/text/ocr/ocr-run-state'
import { buildManifestMetadata } from '~/cli/commands/text/url/url-run-state'

const withDir = async <T,>(fn: (dir: string) => Promise<T> | T): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-extract-settings-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const project = (dir: string, requested: Record<string, unknown>) =>
  createPipelineItemFromRecord(dir, {
    completionStatus: 'incomplete',
    requestedProviders: [requested],
    providerStates: [{ service: requested['service'], model: requested['model'], artifactDir: '.', status: 'missing', attempts: 0 }],
  }).providers[0]

describe('extract provider settings in run records', () => {
  test('STT records call-time language only for the provider that consumes it, and keeps flat resume options', async () => {
    await withDir((dir) => {
      const runtime = { sttAudioProfile: 'lossless' as const, split: true, scrapecreatorsLang: 'fr' }
      const target = { service: 'scrapecreators', model: 'youtube-transcript', local: false } as const
      const provider = project(dir, toSttRequestedProvider(target, runtime))
      expect(provider?.options).toEqual({})
      expect(provider?.settings).toEqual({
        schemaVersion: 1,
        settingsSchema: 'scrapecreators.stt.v1',
        request: { model: 'youtube-transcript', language: 'fr' },
        local: { local: false, audioProfile: 'lossless', split: true },
      })
      const deepgram = { service: 'deepgram', model: 'nova-3', local: false, diarizationOptions: { enabled: true, speakerCount: 2 } } as SttTarget
      expect(toSttRequestedProvider(deepgram, runtime).settings?.request).toEqual({ model: 'nova-3', diarization: { enabled: true, speakerCount: 2 } })
      expect(parseStoredRequestedTargets({ requestedProviders: [toSttRequestedProvider(target, runtime)] })).toEqual([target])
    })
  })

  test('OCR records effective settings, never the PDF password, and keeps missing lists identity-only', async () => {
    await withDir((dir) => {
      const target: OcrTarget = { service: 'mistral', model: 'mistral-ocr' } as OcrTarget
      const requested = toOcrRequestedProvider(target, { dpi: 200, lang: 'deu', out: 'json', ocrProviderMode: 'fanout', pdfChapterMode: 'local', chapterFiles: true, chapterChunkLimitChars: 4000, ...{ password: 'hunter2' } })
      const provider = project(dir, requested)
      expect(JSON.stringify(provider)).not.toContain('hunter2')
      expect(provider?.settings).toMatchObject({
        settingsSchema: 'mistral.ocr.v1',
        request: { model: 'mistral-ocr', dpi: 200, language: 'deu', effectiveReasoningEffort: 'default' },
        local: { outputFormat: 'json', providerMode: 'fanout', pdfChapterMode: 'local', chapterFiles: true, chapterChunkLimitChars: 4000 },
      })
      expect(buildOcrMissingProviders([], [target])).toEqual([])
      expect(buildOcrMissingProviders([{ service: 'mistral', model: 'mistral-ocr', artifactDir: '.', status: 'missing', attempts: 0 } as never], [target])).toEqual([{ service: 'mistral', model: 'mistral-ocr' }])
    })
  })

  test('URL records request timeout and attempt limit per backend', async () => {
    await withDir((dir) => {
      const record = buildManifestMetadata({ slug: 'page', pageCount: 1, format: 'html', fileSize: 1 } as never, undefined, {
        source: { url: 'https://example.com/page' },
        completionStatus: 'incomplete',
        requestedBackends: ['defuddle'],
        providerStates: [{ service: 'defuddle', model: 'defuddle', artifactDir: 'providers/defuddle', status: 'missing', attempts: 0 }],
        failures: [],
        requestOptions: { urlRequestTimeoutMs: 45000, urlRequestAttempts: 2 },
      })
      const provider = createPipelineItemFromRecord(dir, record).providers[0]
      expect(provider?.options).toEqual({})
      expect(provider?.settings).toEqual({
        schemaVersion: 1,
        settingsSchema: 'defuddle.url.v1',
        request: { timeoutMs: 45000, requestAttempts: 2 },
      })
    })
  })
})
