import { describe, expect, test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { resumeFlags } from '~/cli/flags/resume-flags'
import { allArticleFlags, ocrInputFlags, ocrTuningFlags } from '~/cli/flags/shared-flags'
import { epubInspectFlags } from '~/cli/flags/ocr-flags'
import { dialogueTtsCommandOptionNames, genericTtsOptionFlags } from '~/cli/flags/tts-flags'
import { imageGenerationOptionNames, imageInputOptionNames, imageProviderSpecificOptionNames } from '~/cli/flags/image-flags'
import { videoGenerationOptionNames, videoInputOptionNames } from '~/cli/flags/video-flags'
import { musicGenFlags } from '~/cli/flags/music-flags'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from '~/cli/flags/service-selector-normalization/extract-selectors'
import {
  STANDALONE_IMAGE_PROVIDER_TARGETS,
  STANDALONE_MUSIC_PROVIDER_TARGETS,
  STANDALONE_TTS_PROVIDER_TARGETS,
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { PIPELINE_MANIFEST_FILE, readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { normalizeResumeSelectorFlagsForTarget as normalizeResumeSelectorOccurrencesForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { getResumeHandler } from '~/cli/commands/setup-and-utilities/resume/resume-registry'
import { installMockFetch, jsonResponse, restoreEnv, snapshotEnv } from '../../../test-utils/rest-contract-helpers'
import type { CliFlagOccurrence, ResumeTarget, Step3Metadata } from '~/types'
import { flagOccurrencesFromValues } from '../../../test-utils/flag-occurrences'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'

const hasResumableTtsWork = getResumeHandler('tts')!.hasResumableWork
const writeResumeHandler = getResumeHandler('write')!
const hasResumableImageWork = getResumeHandler('image')!.hasResumableWork
const hasResumableVideoWork = getResumeHandler('video')!.hasResumableWork
const hasResumableMusicWork = getResumeHandler('music')!.hasResumableWork

const expectResumeHasFlags = (flags: readonly string[]): void => {
  for (const flag of flags) {
    expect(resumeFlags, `resumeFlags should include --${flag}`).toHaveProperty(flag)
  }
}

const expectResumeLacksFlags = (flags: readonly string[]): void => {
  for (const flag of flags) {
    expect(resumeFlags, `resumeFlags should not include --${flag}`).not.toHaveProperty(flag)
  }
}

// Every provider name resume can select through --provider provider[=model].
const RESUME_PROVIDER_NAMES = [...new Set([
  ...Object.keys(EXTRACT_PUBLIC_SELECTOR_FLAGS),
  ...Object.keys(WRITE_LLM_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_TTS_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_IMAGE_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_MUSIC_PROVIDER_TARGETS)
])]

// Provider-named option flags resume used to inherit by stripping whole command
// flag sets with omitFlags. Provider tuning now comes from the originating
// command or autoshow.config, never from resume's own flag surface.
const REMOVED_PROVIDER_NAMED_FLAGS = [
  'minimax-tts-language-boost',
  'minimax-tts-volume',
  'minimax-tts-pitch',
  'minimax-tts-emotion',
  'minimax-tts-pronunciation',
  'deepgram-tts-container',
  'deepgram-tts-bit-rate',
  'deepgram-tts-sample-rate',
  'speechify-tts-voice-locale',
  'speechify-tts-voice-gender',
  'hume-tts-voice-provider',
  'elevenlabs-tts-clone-remove-background-noise',
  'elevenlabs-tts-stability',
  'elevenlabs-tts-similarity-boost',
  'elevenlabs-tts-style',
  'elevenlabs-tts-use-speaker-boost',
  'elevenlabs-tts-seed',
  'elevenlabs-tts-pronunciation-dictionary-locator',
  'elevenlabs-tts-optimize-streaming-latency',
  'replicate-video-seed',
  'replicate-video-generate-audio',
  'replicate-video-reference-video',
  'replicate-video-reference-audio',
  'replicate-video-negative-prompt',
  'replicate-video-audio',
  'replicate-video-prompt-expansion',
  'grok-video-storage-filename',
  'grok-video-storage-expires-after',
  'stt-reverb-verbatimicity',
  'stt-happyscribe-organization-id',
  'stt-supadata-lang',
  'stt-scrapecreators-lang',
] as const

const target = (
  kind: ResumeTarget['kind'],
  dir = '/tmp/autoshow-resume-test',
  extractRoute?: ResumeTarget['extractRoute']
): ResumeTarget => ({
  kind,
  ...(extractRoute ? { extractRoute } : {}),
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

const buildOpts = (
  flags: Record<string, unknown>,
  explicit: Set<string>,
  flagOccurrences: CliFlagOccurrence[]
) =>
  buildOptsFromFlags(false, flags, {}, explicit, flagOccurrences)

const normalizeResumeSelectorFlagsForTarget = (
  resumeTarget: ResumeTarget,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  _rawArgs: string[]
) => normalizeResumeSelectorOccurrencesForTarget(
  resumeTarget,
  flags,
  explicitFlags,
  flagOccurrencesFromValues(flags, explicitFlags)
)

const originalFetch = globalThis.fetch

describe('resume provider flag surface', () => {
  test('resume orchestration modules live under the resume command directory', async () => {
    const migratedModules = [
      'src/cli/commands/setup-and-utilities/resume/generation-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/provider-batch-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/extract/stt-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/extract/ocr-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/extract/url-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/write/write-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/generation/tts-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/generation/image-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/generation/video-resume.ts',
      'src/cli/commands/setup-and-utilities/resume/generation/music-resume.ts'
    ]
    const removedStepLocalModules = [
      'src/cli/commands/process-steps/generation-resume-utils.ts',
      'src/cli/commands/process-steps/step-2-extract/step-2-stt/resume.ts',
      'src/cli/commands/process-steps/step-2-extract/step-2-ocr/resume.ts',
      'src/cli/commands/process-steps/step-2-extract/step-2-url/resume.ts',
      'src/cli/commands/process-steps/step-4-tts/resume.ts',
      'src/cli/commands/process-steps/step-5-image/resume.ts',
      'src/cli/commands/process-steps/step-6-video/resume.ts',
      'src/cli/commands/process-steps/step-7-music/resume.ts'
    ]

    for (const modulePath of migratedModules) {
      expect(await Bun.file(modulePath).exists(), `${modulePath} should exist`).toBe(true)
    }
    for (const modulePath of removedStepLocalModules) {
      expect(await Bun.file(modulePath).exists(), `${modulePath} should have migrated`).toBe(false)
    }

    const registry = await Bun.file('src/cli/commands/setup-and-utilities/resume/resume-registry.ts').text()
    const sttBatch = await Bun.file('src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-batch/stt-batch.ts').text()
    expect(registry).toContain('./extract/stt-resume')
    expect(registry).toContain('./write/write-resume')
    expect(registry).toContain('./generation/tts-resume')
    expect(sttBatch).toContain('~/cli/commands/setup-and-utilities/resume/extract/stt-resume')
    for (const stalePath of removedStepLocalModules) {
      expect(registry).not.toContain(stalePath.replace('src/', '~/').replace(/\.ts$/, ''))
      expect(sttBatch).not.toContain(stalePath.replace('src/', '~/').replace(/\.ts$/, ''))
    }
  })

  test('resume exposes only provider-neutral resumable option flags', () => {
    expectResumeHasFlags([
      'provider',
      'all-providers',
      'all-local',
      'provider-concurrency',
      'local-concurrency',
      'price',
      'batch-concurrency',
      'prompt',
      'prompt-md'
    ])
    expectResumeHasFlags([
      'youtube-captions',
      'speaker-count',
      'split',
      'stt-segment-concurrency',
      'stt-preflight-concurrency'
    ])
    expectResumeHasFlags(Object.keys(ocrInputFlags))
    expectResumeHasFlags(Object.keys(ocrTuningFlags))
    expectResumeHasFlags(Object.keys(allArticleFlags))
    expectResumeHasFlags(Object.keys(epubInspectFlags))
    expectResumeHasFlags(Object.keys(genericTtsOptionFlags))
    expectResumeHasFlags(dialogueTtsCommandOptionNames)
    expectResumeHasFlags([
      ...imageGenerationOptionNames,
      ...imageInputOptionNames,
      ...imageProviderSpecificOptionNames
    ])
    expectResumeHasFlags([...videoGenerationOptionNames, ...videoInputOptionNames])
    expectResumeHasFlags(Object.keys(musicGenFlags))

    expectResumeLacksFlags([
      'batch-limit',
      'batch-all',
      'batch-order',
      'all-url',
      'url-backend',
      'output-dir'
    ])
  })

  test('resume rejects the provider-named option flags it used to inherit', () => {
    expectResumeLacksFlags(REMOVED_PROVIDER_NAMED_FLAGS)
  })

  test('no resume flag is named after a selectable provider', () => {
    const offenders = Object.keys(resumeFlags).filter((flag) =>
      RESUME_PROVIDER_NAMES.some((provider) => flag.startsWith(`${provider}-`))
    )
    expect(offenders, 'resume flags must not be named after a provider').toEqual([])
  })

  test('resume keeps generic TTS options in place of provider-specific tuning', () => {
    expectResumeHasFlags([
      'tts-voice', 'tts-speed', 'tts-language', 'tts-ref-audio',
      'tts-voice-name',
      'tts-consent-name', 'tts-consent-email', 'tts-text-normalization',
      'tts-instructions', 'tts-output-format', 'tts-chunk-concurrency'
    ])
    expectResumeLacksFlags([
      'elevenlabs-tts-stability', 'elevenlabs-tts-similarity-boost',
      'hume-tts-voice-provider',
      'minimax-tts-language-boost', 'minimax-tts-emotion'
    ])
  })

  test('resume accepts generic video mode and input flags but not provider storage flags', () => {
    expectResumeHasFlags([
      'video-mode',
      'video-input-image',
      'video-last-frame',
      'video-reference-image',
      'video-input-video'
    ])
    expectResumeLacksFlags([
      'grok-video-storage-filename',
      'grok-video-storage-expires-after'
    ])
  })
})

describe('resume target-aware provider selectors', () => {
  test('normalizes --provider and generic TTS options for TTS resume targets', () => {
    const tts = normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { provider: ['kitten=kitten-tts-nano'], 'tts-voice': ['Luna'] },
      new Set(['provider', 'tts-voice']),
      ['resume', 'out', '--provider', 'kitten=kitten-tts-nano', '--tts-voice', 'Luna']
    )
    expect(tts.flags['kitten-tts']).toBe('kitten-tts-nano')
    expect(tts.flags['kitten-voice']).toBe('Luna')
    expect(tts.explicitFlags.has('kitten-tts')).toBe(true)
    expect(tts.explicitFlags.has('kitten-voice')).toBe(true)
  })

  test('normalizes --provider for generation resume targets', () => {
    const write = normalizeResumeSelectorFlagsForTarget(
      target('write'),
      { provider: ['together=kimi-k2.6', 'cerebras=zai-glm-4.7'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'together=kimi-k2.6', '--provider', 'cerebras=zai-glm-4.7']
    )
    expect(write.flags['together']).toBe('kimi-k2.6')
    expect(write.flags['cerebras']).toBe('zai-glm-4.7')
    expect(buildOpts(write.flags, write.explicitFlags, write.flagOccurrences).togetherModels).toEqual(['kimi-k2.6'])
    expect(buildOpts(write.flags, write.explicitFlags, write.flagOccurrences).cerebrasModels).toEqual(['zai-glm-4.7'])

    const image = normalizeResumeSelectorFlagsForTarget(
      target('image'),
      { provider: ['openai=gpt-image-2'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'openai=gpt-image-2']
    )
    expect(image.flags['openai-image']).toBe('gpt-image-2')
    expect(buildOpts(image.flags, image.explicitFlags, image.flagOccurrences).openaiImageModels).toEqual(['gpt-image-2'])

    const video = normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { provider: ['runway=gen4.5'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'runway=gen4.5']
    )
    expect(video.flags['runway-video']).toBe('gen4.5')
    expect(buildOpts(video.flags, video.explicitFlags, video.flagOccurrences).runwayVideoModels).toEqual(['gen4.5'])

    const ltxVideo = normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { provider: ['ltx=ltx-2-3-pro'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'ltx=ltx-2-3-pro']
    )
    expect(ltxVideo.flags['ltx-video']).toBe('ltx-2-3-pro')
    expect(buildOpts(ltxVideo.flags, ltxVideo.explicitFlags, ltxVideo.flagOccurrences).ltxVideoModels).toEqual(['ltx-2-3-pro'])

    const music = normalizeResumeSelectorFlagsForTarget(
      target('music'),
      { provider: ['elevenlabs=music_v1'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'elevenlabs=music_v1']
    )
    expect(music.flags['elevenlabs-music']).toBe('music_v1')
    expect(buildOpts(music.flags, music.explicitFlags, music.flagOccurrences).elevenlabsMusicModels).toEqual(['music_v1'])

    const currentMusic = normalizeResumeSelectorFlagsForTarget(
      target('music'),
      { provider: ['elevenlabs=music_v2', 'minimax=music-3.0'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'elevenlabs=music_v2', '--provider', 'minimax=music-3.0']
    )
    expect(currentMusic.flags['elevenlabs-music']).toBe('music_v2')
    expect(currentMusic.flags['minimax-music']).toBe('music-3.0')
    const currentMusicOpts = buildOpts(currentMusic.flags, currentMusic.explicitFlags, currentMusic.flagOccurrences)
    expect(currentMusicOpts.elevenlabsMusicModels).toEqual(['music_v2'])
    expect(currentMusicOpts.minimaxMusicModels).toEqual(['music-3.0'])
  })

  test('normalizes extract --provider selectors by route', () => {
    const stt = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-media', 'media'),
      { provider: ['deepgram=nova-3'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'deepgram=nova-3']
    )
    expect(stt.flags['deepgram-stt']).toBe('nova-3')
    expect(stt.flags['deepinfra-ocr']).toBeUndefined()
    expect(buildOpts(stt.flags, stt.explicitFlags, stt.flagOccurrences).deepgramSttModels).toEqual(['nova-3'])

    const ocr = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-document', 'document'),
      { provider: ['deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct']
    )
    expect(ocr.flags['deepinfra-ocr']).toBe('Qwen/Qwen3-VL-30B-A3B-Instruct')
    expect(ocr.flags['deepgram-stt']).toBeUndefined()
    expect(buildOpts(ocr.flags, ocr.explicitFlags, ocr.flagOccurrences).deepinfraOcrModels).toEqual(['Qwen/Qwen3-VL-30B-A3B-Instruct'])

    const article = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-article', 'x-space'),
      { provider: ['supadata'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'supadata']
    )
    expect(article.flags['url-provider']).toBe('supadata')
    expect(buildOpts(article.flags, article.explicitFlags, article.flagOccurrences).urlBackend).toBe('supadata')
  })

  test('normalizes --all-local by resolved resume target kind and extract route', () => {
    const tts = normalizeResumeSelectorFlagsForTarget(
      target('tts'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )
    expect(tts.flags['all-local-tts']).toBe(true)
    expect(buildOpts(tts.flags, tts.explicitFlags, tts.flagOccurrences).kittenTtsModels).toBeDefined()

    // Image resume has no local providers, so --all-local is rejected rather than
    // silently dropped (see native-global-args contracts).
    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('image'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )).toThrow('--all-local is not supported')

    const stt = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-media', 'media'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )
    expect(stt.flags['all-local-stt']).toBe(true)
    expect(buildOpts(stt.flags, stt.explicitFlags, stt.flagOccurrences).whisperModels).toBeDefined()

    const ocr = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-document', 'document'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )
    expect(ocr.flags['all-local-ocr']).toBe(true)
    expect(buildOpts(ocr.flags, ocr.explicitFlags, ocr.flagOccurrences).useTesseract).toBe(true)

    const article = normalizeResumeSelectorFlagsForTarget(
      target('extract', '/tmp/autoshow-resume-article', 'x-space'),
      { 'all-local': true },
      new Set(['all-local']),
      ['resume', 'out', '--all-local']
    )
    expect(article.flags['all-local-url']).toBe(true)
    expect(buildOpts(article.flags, article.explicitFlags, article.flagOccurrences).urlBackends).toEqual(['defuddle'])
  })

  test('rejects providers that do not apply to the resolved target', () => {
    expect(() => normalizeResumeSelectorFlagsForTarget(
      target('video'),
      { provider: ['openai=gpt-image-2'] },
      new Set(['provider']),
      ['resume', 'out', '--provider', 'openai=gpt-image-2']
    )).toThrow('Unknown provider "openai" for --provider')
  })

})

describe('resume all-shortcut additive selection', () => {
  test('explicit all shortcuts make write LLM runs resumable without provider calls', async () => {
    await withTempDir('autoshow-write-resume-all-shortcuts-', async (dir) => {
      await writeSingleManifestFixture(dir, 'write', {
        step3: {
          llmService: 'openai',
          llmModel: 'gpt-5.5',
          processingTime: 1,
          inputTokenCount: 1,
          outputTokenCount: 1,
          outputFileName: 'text-gpt-5.5.json',
          outputFormat: 'json',
          structuredMode: 'native',
          structuredPresetNames: ['shortSummary']
        }
      })
      await Bun.write(join(dir, 'prompt.md'), 'Prompt')
      const normalized = normalizeResumeSelectorFlagsForTarget(
        target('write', dir),
        { 'all-providers': true },
        new Set(['all-providers']),
        ['resume', dir, '--all-providers']
      )
      const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)
      await expect(writeResumeHandler.hasResumableWork(target('write', dir), opts, normalized.explicitFlags)).resolves.toBe(true)
    })
  })

  test('write resume resolves a completed selection before requiring prompt.md', async () => {
    await withTempDir('autoshow-write-resume-complete-no-prompt-', async (dir) => {
      await writeSingleManifestFixture(dir, 'write', {
        step3: {
          llmService: 'openai',
          llmModel: 'gpt-5.5',
          processingTime: 1,
          inputTokenCount: 1,
          outputTokenCount: 1,
          outputFileName: 'text-gpt-5.5.json',
          outputFormat: 'json',
          structuredMode: 'native',
          structuredPresetNames: ['shortSummary']
        } satisfies Step3Metadata
      })

      const normalized = normalizeResumeSelectorFlagsForTarget(
        target('write', dir),
        { provider: ['openai=gpt-5.5'] },
        new Set(['provider']),
        ['resume', dir, '--provider', 'openai=gpt-5.5']
      )
      const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)

      await expect(writeResumeHandler.resume(target('write', dir), opts, normalized.explicitFlags)).resolves.toEqual({
        full: 1,
        incomplete: 0,
        failed: 0
      })
      expect(await Bun.file(join(dir, 'prompt.md')).exists()).toBe(false)
    })
  })

  test('write resume records successful partial LLM results and exits incomplete for failed targets', async () => {
    const env = snapshotEnv([
      'TOGETHER_API_KEY',
      'CEREBRAS_API_KEY'
    ])
    try {
      process.env['TOGETHER_API_KEY'] = 'together-key'
      process.env['CEREBRAS_API_KEY'] = 'cerebras-key'

      await withTempDir('autoshow-write-resume-partial-', async (dir) => {
        await writeSingleManifestFixture(dir, 'write', {
          step3: {
            llmService: 'openai',
            llmModel: 'gpt-5.5',
            processingTime: 1,
            inputTokenCount: 1,
            outputTokenCount: 1,
            outputFileName: 'text-gpt-5.5.json',
            outputFormat: 'json',
            structuredMode: 'native',
            structuredPresetNames: ['shortSummary']
          } satisfies Step3Metadata
        })
        await Bun.write(join(dir, 'prompt.md'), 'Prompt')

        installMockFetch((call) => {
          if (call.headers.get('authorization') === 'Bearer cerebras-key') {
            return jsonResponse({
              error: {
                message: 'Model zai-glm-4.7 does not exist or you do not have access to it.'
              }
            }, { status: 404 })
          }

          return jsonResponse({
            model: call.bodyJson?.['model'],
            choices: [{ message: { content: '{"episodeDescription":"Together summary."}' } }],
            usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 }
          })
        })

        const normalized = normalizeResumeSelectorFlagsForTarget(
          target('write', dir),
          { provider: ['together=kimi-k2.6', 'cerebras=zai-glm-4.7'] },
          new Set(['provider']),
          ['resume', dir, '--provider', 'together=kimi-k2.6', '--provider', 'cerebras=zai-glm-4.7']
        )
        const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)

        try {
          await writeResumeHandler.resume(target('write', dir), opts, normalized.explicitFlags)
          expect.unreachable('write resume should remain incomplete')
        } catch (error) {
          expect(error).toMatchObject({
            kind: 'infrastructure',
            stage: 'resume:generation',
            exitCode: 2,
            message: 'Write resume still has 1 incomplete provider(s): cerebras/zai-glm-4.7'
          })
        }

        const manifest = await readManifest(dir)
        const item = manifest?.items[0]
        const step3 = Array.isArray(item?.metadata['step3'])
          ? item.metadata['step3'] as Step3Metadata[]
          : [item?.metadata['step3'] as Step3Metadata]
        const togetherEntry = step3.find((entry) => `${entry.llmService}/${entry.llmModel}` === 'together/kimi-k2.6')
        expect(step3.map((entry) => `${entry.llmService}/${entry.llmModel}`)).toContain('together/kimi-k2.6')
        expect(step3.map((entry) => `${entry.llmService}/${entry.llmModel}`)).not.toContain('cerebras/zai-glm-4.7')
        expect(togetherEntry).toBeDefined()
        expect(await Bun.file(join(dir, togetherEntry!.outputFileName)).exists()).toBe(true)
        expect(item?.providers).toEqual(expect.arrayContaining([
          expect.objectContaining({ service: 'together', model: 'kimi-k2.6', status: 'succeeded' }),
          expect.objectContaining({ service: 'cerebras', model: 'zai-glm-4.7', status: 'missing' })
        ]))
      })
    } finally {
      globalThis.fetch = originalFetch
      restoreEnv(env)
    }
  })

  test('explicit all shortcuts make full generation runs resumable without provider calls', async () => {
    await withTempDir('autoshow-resume-all-shortcuts-', async (dir) => {
      const cases = [
        {
          kind: 'tts' as const,
          metadataKey: 'tts',
          requestedProvider: { service: 'kitten', model: 'kitten-tts-mini' },
          metadata: {
            ttsService: 'kitten',
            ttsModel: 'kitten-tts-mini',
            processingTime: 1,
            audioFileName: 'speech.wav',
            audioFileSize: 1,
            chunkCount: 1
          },
          hasWork: hasResumableTtsWork
        },
        {
          kind: 'image' as const,
          metadataKey: 'image',
          requestedProvider: { service: 'gemini', model: 'gemini-3.1-flash-lite-image' },
          metadata: {
            imageService: 'gemini',
            imageModel: 'gemini-3.1-flash-lite-image',
            processingTime: 1,
            imageFileNames: ['generated-image.png'],
            imageCount: 1,
            imageFileSize: 1,
            imageWidth: 1,
            imageHeight: 1,
            requestMode: 'generation'
          },
          hasWork: hasResumableImageWork
        },
        {
          kind: 'video' as const,
          metadataKey: 'video',
          requestedProvider: { service: 'gemini', model: 'veo-3.1-fast-generate-preview' },
          metadata: {
            videoGenService: 'gemini',
            videoGenModel: 'veo-3.1-fast-generate-preview',
            processingTime: 1,
            videoFileName: 'generated-video.mp4',
            videoFileSize: 1,
            videoDuration: 5
          },
          hasWork: hasResumableVideoWork
        },
        {
          kind: 'music' as const,
          metadataKey: 'music',
          requestedProvider: { service: 'elevenlabs', model: 'music_v1' },
          metadata: {
            musicService: 'elevenlabs',
            musicModel: 'music_v1',
            processingTime: 1,
            musicFileName: 'music.mp3',
            musicFileSize: 1,
            musicDurationMs: 1000,
            lyricsSource: 'none'
          },
          hasWork: hasResumableMusicWork
        }
      ]

      for (const entry of cases) {
        const runDir = join(dir, entry.kind)
        await mkdir(runDir, { recursive: true })
        await writeSingleManifestFixture(runDir, entry.kind, {
          input: 'prompt',
          completionStatus: 'full',
          requestedProviders: [entry.requestedProvider],
          providerStates: [{
            ...entry.requestedProvider,
            artifactDir: '.',
            status: 'succeeded',
            attempts: 1
          }],
          [entry.metadataKey]: [entry.metadata]
        })
        const explicit = new Set(['all-providers'])
        const normalized = normalizeResumeSelectorFlagsForTarget(
          target(entry.kind, runDir),
          { 'all-providers': true },
          explicit,
          ['resume', runDir, '--all-providers']
        )
        const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)
        await expect(entry.hasWork(target(entry.kind, runDir), opts, normalized.explicitFlags)).resolves.toBe(true)
      }
    })
  })
})
