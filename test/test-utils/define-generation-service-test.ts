import { expect, test } from 'bun:test'
import type { MusicServiceModelCase, RunCommandOptions, VideoTestService } from '~/types'
import { E2E_TEST_TIMEOUT_MS } from './budget'
import { readCanonicalRecord } from './manifest-helpers'
import {
  defineBudgetedLiveServiceTest,
  defineInvalidModelTest,
  requireConfiguredEnvVar,
  runCommandAndExpectOutputDir,
  withOutputLifecycle
} from './service-test-kit'
import { fileExists, runCommand } from './test-helpers'

type GenerationCommand = 'image' | 'video' | 'music'
type GenerationServiceModelCase = { model: string, extraArgs?: string[] | undefined }
type GenerationServiceOptions<TModel extends GenerationServiceModelCase> = {
  models: TModel[]
  provider: string
  service: string
  envVarKey: string
}
type GenerationArtifact = { fileName: string, fileSize: number }

const readMetadataPath = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((current, part) =>
  typeof current === 'object' && current !== null ? (current as Record<string, unknown>)[part] : undefined,
value)

type GenerationServiceProfile<
  TModel extends GenerationServiceModelCase,
  TOptions extends GenerationServiceOptions<TModel>
> = {
  command: GenerationCommand
  outputTitle: string
  invalidModelTestName: (options: TOptions) => string
  invalidModelPrompt: string
  pricePrompt: string
  livePrompt: (modelCase: TModel) => string
  liveTestName: (modelCase: TModel, options: TOptions) => string
  artifactFileName: (modelCase: TModel, options: TOptions) => string
  envErrorMessage: (options: TOptions) => string
  metadataKey: string
  expectedMetadata: (modelCase: TModel, artifact: GenerationArtifact, options: TOptions) => Record<string, unknown>
  commandOptions?: ((modelCase: TModel) => RunCommandOptions | undefined) | undefined
  testTimeoutMs?: ((modelCase: TModel, options: TOptions) => number | undefined) | undefined
}

export const defineGenerationServiceTest = <
  TModel extends GenerationServiceModelCase,
  TOptions extends GenerationServiceOptions<TModel>
>(options: TOptions, profile: GenerationServiceProfile<TModel, TOptions>): void => {
  const { command, outputTitle } = profile
  defineInvalidModelTest(profile.invalidModelTestName(options), [
    'src/cli/create-cli.ts',
    command,
    profile.invalidModelPrompt,
    '--provider',
    `${options.provider}=invalid-model`
  ])

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

export const defineGenerationServicePriceTests = <TModel extends GenerationServiceModelCase>(
  options: Pick<GenerationServiceOptions<TModel>, 'models' | 'provider' | 'service'>,
  profile: Pick<GenerationServiceProfile<TModel, GenerationServiceOptions<TModel>>, 'command' | 'pricePrompt'>
): void => {
  for (const { model, extraArgs } of options.models) {
    test(`${options.service} ${model} --price prints estimate`, async () => {
      const result = await runCommand([
        'src/cli/create-cli.ts',
        profile.command,
        profile.pricePrompt,
        '--provider',
        `${options.provider}=${model}`,
        ...(extraArgs ?? []),
        '--price'
      ])
      expect(result.exitCode).toBe(0)
    }, E2E_TEST_TIMEOUT_MS)
  }
}

type ImageServiceModelCase = {
  model: string
  prompt: string
  extraArgs?: string[]
  expectedExtension?: string
}
type ImageServiceTestOptions = {
  models: ImageServiceModelCase[]
  provider: string
  imageService: string
  envVarKey: string
  imageExtension?: string
}
type ImageGenerationOptions = ImageServiceTestOptions & GenerationServiceOptions<ImageServiceModelCase>

const IMAGE_PROFILE: GenerationServiceProfile<ImageServiceModelCase, ImageGenerationOptions> = {
  command: 'image',
  outputTitle: 'image-gen',
  invalidModelTestName: ({ service }) => `rejects invalid ${service} image model`,
  invalidModelPrompt: 'a sunset',
  pricePrompt: 'a sunset',
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

export const defineImageServicePriceTests = ({ models, provider, imageService }: Pick<ImageServiceTestOptions, 'models' | 'provider' | 'imageService'>): void => {
  defineGenerationServicePriceTests({ models, provider, service: imageService }, IMAGE_PROFILE)
}

type VideoServiceModelCase = { model: string, extraArgs?: string[], expectedDuration?: number, prompt?: string }
type VideoServiceTestOptions = {
  models: VideoServiceModelCase[]
  provider: string
  videoService: VideoTestService
  envVarKey: string
  envVarDescription: string
  timeoutMs?: number
}
type VideoGenerationOptions = VideoServiceTestOptions & GenerationServiceOptions<VideoServiceModelCase>

const VIDEO_PROFILE: GenerationServiceProfile<VideoServiceModelCase, VideoGenerationOptions> = {
  command: 'video',
  outputTitle: 'video-gen',
  invalidModelTestName: ({ provider }) => `rejects invalid model for ${provider}`,
  invalidModelPrompt: 'a cinematic mountain sunrise',
  pricePrompt: 'a cinematic mountain sunrise',
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
  testTimeoutMs: (_, { timeoutMs }) => timeoutMs
}

export const defineVideoServiceTest = (options: VideoServiceTestOptions): void => {
  defineGenerationServiceTest({ ...options, service: options.videoService }, VIDEO_PROFILE)
}

export const defineVideoServicePriceTests = ({ models, provider, videoService }: Pick<VideoServiceTestOptions, 'models' | 'provider' | 'videoService'>): void => {
  defineGenerationServicePriceTests({ models, provider, service: videoService }, VIDEO_PROFILE)
}

type MusicServiceTestOptions = {
  models: MusicServiceModelCase[]
  provider: string
  musicService: string
  envVarKey: string
}
type MusicGenerationOptions = MusicServiceTestOptions & GenerationServiceOptions<MusicServiceModelCase>

const MUSIC_PROFILE: GenerationServiceProfile<MusicServiceModelCase, MusicGenerationOptions> = {
  command: 'music',
  outputTitle: 'music-gen',
  invalidModelTestName: ({ service }) => `rejects invalid ${service} music model`,
  invalidModelPrompt: 'an ambient piano song',
  pricePrompt: 'an ambient piano song',
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

export const defineMusicServicePriceTests = ({ models, provider, musicService }: Pick<MusicServiceTestOptions, 'models' | 'provider' | 'musicService'>): void => {
  defineGenerationServicePriceTests({ models, provider, service: musicService }, MUSIC_PROFILE)
}
