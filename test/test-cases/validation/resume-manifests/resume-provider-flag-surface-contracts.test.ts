import { describe,expect,test } from 'bun:test'
import { imageResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/image-resume'
import { musicResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/music-resume'
import { ttsResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/tts-resume'
import { videoResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/video-resume'
import { writeResumeConfig } from '~/cli/commands/setup-and-utilities/resume/write/write-resume'
import { imageGenerationOptionNames,imageInputOptionNames,imageProviderSpecificOptionNames } from '~/cli/flags/image-flags'
import { musicGenFlags } from '~/cli/flags/music-flags'
import { resumeFlags } from '~/cli/flags/resume-flags'
import { EXTRACT_PUBLIC_SELECTOR_FLAGS } from '~/cli/flags/service-selector-normalization/extract-selectors'
import {
deriveGenerationResumeModelFields,
IMAGE_GENERATION_SELECTION,
MUSIC_GENERATION_SELECTION,
STANDALONE_IMAGE_PROVIDER_TARGETS,
STANDALONE_MUSIC_PROVIDER_TARGETS,
STANDALONE_TTS_PROVIDER_TARGETS,
STANDALONE_VIDEO_PROVIDER_TARGETS,
TTS_GENERATION_SELECTION,
VIDEO_GENERATION_SELECTION,
WRITE_LLM_GENERATION_SELECTION,
WRITE_LLM_PROVIDER_TARGETS,
WRITE_OCR_PROVIDER_TARGETS,
WRITE_STT_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { articleTuningFlags,ocrInputFlags,ocrTuningFlags } from '~/cli/flags/shared-flags'
import { dialogueTtsCommandOptionNames,genericTtsOptionFlags } from '~/cli/flags/tts-flags'
import { videoGenerationOptionNames,videoInputOptionNames } from '~/cli/flags/video-flags'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'

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

const RESUME_PROVIDER_NAMES = [...new Set([
  ...Object.keys(EXTRACT_PUBLIC_SELECTOR_FLAGS),
  ...Object.keys(WRITE_LLM_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_TTS_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_IMAGE_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS),
  ...Object.keys(STANDALONE_MUSIC_PROVIDER_TARGETS)
])]

const REMOVED_PROVIDER_NAMED_FLAGS = [
  'minimax-tts-language-boost',
  'minimax-tts-volume',
  'minimax-tts-pitch',
  'minimax-tts-emotion',
  'minimax-tts-pronunciation',
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
  'replicate-video-seed',
  'replicate-video-generate-audio',
  'replicate-video-reference-video',
  'replicate-video-reference-audio',
  'replicate-video-negative-prompt',
  'stt-happyscribe-organization-id',
  'stt-supadata-lang',
  'stt-scrapecreators-lang',
] as const

describe('resume provider flag surface', () => {
  test('every extract provider is derived into route-aware resume selection', () => {
    const expected: Record<string, { stt?: string, ocr?: string }> = {}
    for (const [provider, flag] of Object.entries(WRITE_STT_PROVIDER_TARGETS)) {
      expected[provider] = { ...expected[provider], stt: flag }
    }
    for (const [provider, flag] of Object.entries(WRITE_OCR_PROVIDER_TARGETS)) {
      expected[provider] = { ...expected[provider], ocr: flag }
    }
    expect(EXTRACT_PUBLIC_SELECTOR_FLAGS).toEqual(expected)
  })

  test('every generation provider and model field is derived into resume selection', () => {
    const cases = [
      {
        label: 'write',
        config: writeResumeConfig,
        descriptor: WRITE_LLM_GENERATION_SELECTION,
        shortcuts: ['all-llm']
      },
      {
        label: 'TTS',
        config: ttsResumeConfig,
        descriptor: TTS_GENERATION_SELECTION,
        shortcuts: ['all-tts']
      },
      {
        label: 'image',
        config: imageResumeConfig,
        descriptor: IMAGE_GENERATION_SELECTION,
        shortcuts: ['all-image']
      },
      {
        label: 'video',
        config: videoResumeConfig,
        descriptor: VIDEO_GENERATION_SELECTION,
        shortcuts: ['all-video']
      },
      {
        label: 'music',
        config: musicResumeConfig,
        descriptor: MUSIC_GENERATION_SELECTION,
        shortcuts: ['all-music']
      }
    ] as const

    for (const entry of cases) {
      expect(entry.config.providerFlags, `${entry.label} resume provider inventory`).toEqual([
        ...entry.shortcuts,
        ...Object.values(entry.descriptor.providerTargets)
      ])
    }

    expect(ttsResumeConfig.modelFields).toEqual(
      deriveGenerationResumeModelFields(TTS_GENERATION_SELECTION)
    )
  })

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
    expectResumeHasFlags(Object.keys(articleTuningFlags))
    expectResumeHasFlags(Object.keys(genericTtsOptionFlags))
    expect(buildOptsFromFlags({ 'allow-ambiguous-redispatch': true }).ttsAllowAmbiguousRedispatch).toBe(true)
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
      'url-provider',
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
      'tts-voice', 'tts-speed', 'tts-language', 'tts-text-normalization',
      'tts-instructions', 'tts-chunk-concurrency'
    ])
    expectResumeLacksFlags([
      'tts-ref-audio',
      'tts-voice-name',
      'tts-consent-name',
      'tts-consent-email',
      'elevenlabs-tts-stability', 'elevenlabs-tts-similarity-boost',
      'hume-tts-voice-provider',
      'minimax-tts-language-boost', 'minimax-tts-emotion'
    ])
  })

  test('resume accepts generic video mode and input flags but not provider-specific video flags', () => {
    expectResumeHasFlags([
      'video-mode',
      'video-generate-audio',
      'video-input-image',
      'video-last-frame',
      'video-reference-image',
      'video-input-video',
      'video-reference-video',
      'video-reference-audio'
    ])
    expectResumeLacksFlags([
      'replicate-video-multi-prompt',
      'replicate-video-seed'
    ])
  })
})
