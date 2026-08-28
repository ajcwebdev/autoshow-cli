import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  isScrapeCreatorsSupportedSourceUrl
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/scrapecreators/scrapecreators'
import {
  runScrapeCreatorsStt
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/scrapecreators/run-scrapecreators-stt'
import { expectProviderHttpError, installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { extractErrorMetadata } from '~/utils/error-handler'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['SCRAPECREATORS_API_KEY'],
  tempPrefix: 'autoshow-scrapecreators-'
})
const withTempOutputDir = tempDirs.withDir

describe('ScrapeCreators STT contracts', () => {
  test('source support is restricted to YouTube URLs', () => {
    expect(isScrapeCreatorsSupportedSourceUrl('https://www.youtube.com/watch?v=MORMZXEaONk')).toBe(true)
    expect(isScrapeCreatorsSupportedSourceUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(isScrapeCreatorsSupportedSourceUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(isScrapeCreatorsSupportedSourceUrl('https://example.com/audio.mp3')).toBe(false)
    expect(isScrapeCreatorsSupportedSourceUrl('/tmp/audio.mp3')).toBe(false)
    expect(isScrapeCreatorsSupportedSourceUrl(undefined)).toBe(false)
  })

  test('mocked success response normalizes text, timestamps, evidence, artifact, and billing', async () => {
    process.env['SCRAPECREATORS_API_KEY'] = 'test-scrapecreators-key'
    const calls = installMockFetch(() =>
      jsonResponse({
          transcript: [
            { startMs: '0', endMs: '1250', startTimeText: '0:00', text: ' Hello world. ' },
            { startMs: '1250', endMs: '3000', startTimeText: '0:01', text: 'Next line.' }
          ],
          videoId: 'dQw4w9WgXcQ',
          transcript_only_text: 'Hello world. Next line.',
          captionTracks: [{ languageCode: 'es', name: 'Spanish' }]
      }))

    await withTempOutputDir(async (outputDir) => {
        const { result, metadata } = await runScrapeCreatorsStt('unused.mp3', outputDir, {
          model: 'youtube-transcript',
          sourceUrl: 'https://www.youtube.com/watch?v=MORMZXEaONk',
          language: 'es',
          segmentOffsetMinutes: 0,
          baseUrl: 'https://mock.scrapecreators.local'
        })
        const requestedUrl = new URL(calls[0]?.url ?? '')
        const headers = calls[0]?.headers

        expect(requestedUrl.origin).toBe('https://mock.scrapecreators.local')
        expect(requestedUrl.pathname).toBe('/v1/youtube/video/transcript')
        expect(requestedUrl.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=MORMZXEaONk')
        expect(requestedUrl.searchParams.get('language')).toBe('es')
        expect(headers?.get('x-api-key')).toBe('test-scrapecreators-key')
        expect(result.text).toBe('Hello world. Next line.')
        expect(result.segments).toEqual([
          { start: '00:00:00.000', end: '00:00:01.250', text: 'Hello world.' },
          { start: '00:00:01.250', end: '00:00:03.000', text: 'Next line.' }
        ])
        expect(result.evidence?.capabilities).toEqual({
          hasNativeWordTiming: false,
          hasConfidence: false,
          hasSpeakerLabels: false
        })
        expect(result.evidence?.timingQuality).toBe('coarse')
        expect(result.evidence?.words).toBeUndefined()
        expect(result.evidence?.segments).toEqual([
          { startSeconds: 0, endSeconds: 1.25, text: 'Hello world.' },
          { startSeconds: 1.25, endSeconds: 3, text: 'Next line.' }
        ])
        expect(result.evidence?.rawResponse).toMatchObject({
          videoId: 'dQw4w9WgXcQ',
          transcript_only_text: 'Hello world. Next line.',
          captionTracks: [{ languageCode: 'es', name: 'Spanish' }],
          transcript: [
            { startMs: 0, endMs: 1250, startTimeText: '0:00' },
            { startMs: 1250, endMs: 3000, startTimeText: '0:01' }
          ]
        })
        expect(metadata).toMatchObject({
          transcriptionService: 'scrapecreators',
          transcriptionModel: 'youtube-transcript',
          captionLanguage: 'es',
          billing: {
            creditsUsed: 1,
            creditRateCents: 0.188,
            totalCost: 0.188,
            source: 'registry_fallback',
            mode: 'url'
          }
        })
        expect(metadata.timings?.requestCount).toBe(1)
        await expect(readFile(join(outputDir, 'transcription.txt'), 'utf8')).resolves.toBe(
          '[00:00:00.000] Hello world.\n[00:00:01.250] Next line.'
        )
    })
  })

  test('malformed transcript timing strings fail as an invalid payload', async () => {
    const invalidPayload = {
      transcript: [
        { startMs: 'not-a-number', endMs: '1250', text: 'Bad timing.' }
      ]
    }

    process.env['SCRAPECREATORS_API_KEY'] = 'test-scrapecreators-key'
    installMockFetch(() => jsonResponse(invalidPayload))

    await withTempOutputDir(async (outputDir) => {
      const error = await expectProviderHttpError(
        () => runScrapeCreatorsStt('unused.mp3', outputDir, {
          model: 'youtube-transcript',
          sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
          language: 'en',
          segmentOffsetMinutes: 0,
          baseUrl: 'https://mock.scrapecreators.local'
        }),
        { kind: 'provider_http', stage: 'create', messageContains: 'invalid transcript payload' }
      )
      expect(extractErrorMetadata(error)['rawResponse']).toEqual(invalidPayload)
    })
  })

  test('mocked transcript null response is skipped and non-retryable', async () => {
    process.env['SCRAPECREATORS_API_KEY'] = 'test-scrapecreators-key'
    installMockFetch(() => jsonResponse({ transcript: null }))

    await withTempOutputDir(async (outputDir) => {
      const error = await expectProviderHttpError(
        () => runScrapeCreatorsStt('unused.mp3', outputDir, {
          model: 'youtube-transcript',
          sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
          language: 'fr',
          segmentOffsetMinutes: 0,
          baseUrl: 'https://mock.scrapecreators.local'
        }),
        { kind: 'provider_http', retryable: false, messageContains: 'requested language "fr"' }
      )
      const metadata = extractErrorMetadata(error)
      expect(metadata['skipped']).toBe(true)
      expect(metadata['rawResponse']).toEqual({ transcript: null })
    })
  })

  test('unsupported sources skip before reading credentials or calling fetch', async () => {
    const calls = installMockFetch(() => new Response('{}'))

    await withTempOutputDir(async (outputDir) => {
      const error = await expectProviderHttpError(
        () => runScrapeCreatorsStt('unused.mp3', outputDir, {
          model: 'youtube-transcript',
          sourceUrl: 'https://example.com/audio.mp3',
          segmentOffsetMinutes: 0
        }),
        { kind: 'provider_http', retryable: false, messageContains: 'only supports youtube.com and youtu.be URLs' }
      )
      expect(extractErrorMetadata(error)['skipped']).toBe(true)
    })
    expect(calls).toHaveLength(0)
  })
})
