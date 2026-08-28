import { expect } from 'bun:test'
import type { GenerationServiceModelCase, GenerationServiceOptions, GenerationServiceProfile, ImageGenerationOptions, ImageServiceModelCase, ImageServiceTestOptions, MusicGenerationOptions, MusicServiceModelCase, MusicServiceTestOptions, VideoGenerationOptions, VideoServiceModelCase, VideoServiceTestOptions } from '~/types'
import { E2E_TEST_TIMEOUT_MS, LONG_E2E_TEST_TIMEOUT_MS } from './budget'
import { readCanonicalRecord } from './manifest-helpers'
import {
  defineBudgetedLiveServiceTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
import { fileExists } from './test-helpers'

const readMetadataPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((current, part) =>
  typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[part] : undefined,
value)

const defineGenerationServiceTest = <
  TModel extends GenerationServiceModelCase,
  TOptions extends GenerationServiceOptions<TModel>
>(options: TOptions, profile: GenerationServiceProfile<TModel, TOptions>): void => {
  const { command, outputTitle } = profile
  withOutputLifecycle(outputTitle)

  for (const modelCase of options.models) {
    const { model, extraArgs } = modelCase
    const budgetKey = `${command}-${options.service}-${model}`
    defineBudgetedLiveServiceTest(budgetKey, profile.liveTestName(modelCase, options), [options.envVarKey], async () => {
      await requireConfiguredEnvVar(options.envVarKey, profile.envErrorMessage(options))

      const outputDir = await runCommandAndExpectOutputDir(outputTitle, [
        'src/cli/create-cli.ts',
        command,
        profile.livePrompt(modelCase),
        '--provider',
        `${options.provider}=${model}`,
        ...(extraArgs ?? [])
      ], profile.commandOptions?.(modelCase))

      const fileName = profile.artifactFileName(modelCase, options)
      const artifactPath = `${outputDir}/${fileName}`
      expect(await fileExists(artifactPath)).toBe(true)
      const artifactFile = Bun.file(artifactPath)
      expect(artifactFile.size).toBeGreaterThan(0)

      const metadata = await readCanonicalRecord(outputDir)
      const metadataEntry = (metadata[profile.metadataKey] as Array<Record<string, unknown>> | undefined)?.[0]
      const expected = profile.expectedMetadata(modelCase, { fileName, fileSize: artifactFile.size }, options)
      for (const [key, value] of Object.entries(expected)) {
        expect(readMetadataPath(metadataEntry, key)).toEqual(value)
      }
    }, profile.testTimeoutMs?.(modelCase, options) ?? E2E_TEST_TIMEOUT_MS)
  }
}

const IMAGE_PROFILE: GenerationServiceProfile<ImageServiceModelCase, ImageGenerationOptions> = {
  command: 'image',
  outputTitle: 'image-gen',
  livePrompt: ({ prompt }) => prompt,
  liveTestName: ({ model }) => `${model} generates image and metadata`,
  artifactFileName: ({ expectedExtension }, { imageExtension }) => `generated-image.${expectedExtension ?? imageExtension ?? 'png'}`,
  envErrorMessage: ({ envVarKey }) => `${envVarKey} not configured`,
  metadataKey: 'image',
  expectedMetadata: ({ model }, { fileName }, { service }) => ({ imageService: service, imageModel: model, 'imageFileNames.0': fileName })
}

export const defineImageServiceTest = (options: ImageServiceTestOptions): void => {
  defineGenerationServiceTest({ ...options, service: options.imageService }, IMAGE_PROFILE)
}

const VIDEO_PROFILE: GenerationServiceProfile<VideoServiceModelCase, VideoGenerationOptions> = {
  command: 'video',
  outputTitle: 'video-gen',
  livePrompt: ({ prompt }) => prompt ?? 'a static shot of a tiny red dot on white background',
  liveTestName: ({ model }, { service }) => `${service} ${model} generates video and metadata`,
  artifactFileName: () => 'generated-video.mp4',
  envErrorMessage: ({ envVarKey, envVarDescription }) => `${envVarKey} is required for ${envVarDescription}`,
  metadataKey: 'video',
  expectedMetadata: ({ model, expectedDuration }, { fileName, fileSize }, { service }) => ({
    videoGenService: service,
    videoGenModel: model,
    videoFileName: fileName,
    videoFileSize: fileSize,
    ...(expectedDuration === undefined ? {} : { videoDuration: expectedDuration })
  }),
  commandOptions: () => ({ timeoutMs: LONG_E2E_TEST_TIMEOUT_MS }),
  testTimeoutMs: (_, { timeoutMs }) => timeoutMs ?? LONG_E2E_TEST_TIMEOUT_MS
}

export const defineVideoServiceTest = (options: VideoServiceTestOptions): void => {
  defineGenerationServiceTest({ ...options, service: options.videoService }, VIDEO_PROFILE)
}

const MUSIC_PROFILE: GenerationServiceProfile<MusicServiceModelCase, MusicGenerationOptions> = {
  command: 'music',
  outputTitle: 'music-gen',
  livePrompt: ({ prompt }) => prompt,
  liveTestName: ({ model }, { service }) => `${service} ${model} generates music and metadata`,
  artifactFileName: () => 'generated-music.mp3',
  envErrorMessage: ({ envVarKey }) => `${envVarKey} not configured`,
  metadataKey: 'music',
  expectedMetadata: ({ model, expectedLyricsSource }, { fileName }, { service }) => ({
    musicService: service,
    musicModel: model,
    musicFileName: fileName,
    ...(expectedLyricsSource ? { lyricsSource: expectedLyricsSource } : {})
  }),
  commandOptions: ({ commandTimeoutMs }) => commandTimeoutMs === undefined ? undefined : { timeoutMs: commandTimeoutMs },
  testTimeoutMs: ({ testTimeoutMs }) => testTimeoutMs
}

export const defineMusicServiceTest = (options: MusicServiceTestOptions): void => {
  defineGenerationServiceTest({ ...options, service: options.musicService }, MUSIC_PROFILE)
}
