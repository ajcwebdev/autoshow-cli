import { describe, expect, test } from 'bun:test'
import { readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { videoResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/video-resume'
import { imageResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/image-resume'
import { musicResumeConfig } from '~/cli/commands/setup-and-utilities/resume/generation/music-resume'
import { resumeGenerationTarget } from '~/cli/commands/setup-and-utilities/resume/generation-resume'
import { readCanonicalRecord, writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import type { GenerationResumeRunContext, ImageGenOptions, ImageTarget, MusicGenOptions, MusicTarget, Step5Metadata, Step6VideoMetadata, Step7MusicMetadata, VideoGenOptions, VideoTarget } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'

// Fake targets write fixed bytes into whatever directory the runner hands them, exactly like a provider adapter
// writing its single-target artifact name. No provider is called; the real resume configs choose staging and names.
const purchased = new Uint8Array([9, 9, 9, 9])
const added = new Uint8Array([1, 2, 3])

const context = <TTarget extends VideoTarget | ImageTarget | MusicTarget, TMetadata, TOptions extends object>(
  dir: string, targets: TTarget[], existingEntries: TMetadata[], options: TOptions
): GenerationResumeRunContext<TTarget, TMetadata, TOptions> => ({
  outputDir: dir, runtimeOptions: options, targets, existingEntries, currentManifestMetadata: {}, currentProviderStates: []
})

const videoTarget = (): VideoTarget => ({
  service: 'gemini', model: 'gemini-omni-1.2-flash', requestSettings: {},
  run: async (_prompt, outputDir) => {
    const videoPath = join(outputDir, 'generated-video.mp4')
    await Bun.write(videoPath, added)
    return { videoPath, metadata: { videoGenService: 'gemini', videoGenModel: 'gemini-omni-1.2-flash', processingTime: 1, videoFileName: 'generated-video.mp4', videoFileSize: 3, videoDuration: 10 } }
  }
})

const imageTarget = (): ImageTarget => ({
  service: 'openai', model: 'gpt-image-2.6-flare', requestSettings: {},
  run: async (_prompt, outputDir) => {
    const imagePath = join(outputDir, 'generated-image.png')
    await Bun.write(imagePath, added)
    return { imagePaths: [imagePath], metadata: { imageService: 'openai', imageModel: 'gpt-image-2.6-flare', processingTime: 1, imageFileNames: ['generated-image.png'], imageCount: 1, imageFileSize: 3, imageWidth: undefined, imageHeight: undefined, requestMode: 'generation' } }
  }
})

const musicTarget = (): MusicTarget => ({
  service: 'elevenlabs', model: 'music_v2', requestSettings: {},
  run: async (_prompt, outputDir) => {
    const musicPath = join(outputDir, 'generated-music.mp3')
    await Bun.write(musicPath, added)
    return { musicPath, metadata: { musicService: 'elevenlabs', musicModel: 'music_v2', processingTime: 1, musicFileName: 'generated-music.mp3', musicFileSize: 3, musicDurationMs: 1000, lyricsSource: 'none' } }
  }
})

const bytes = async (path: string): Promise<Uint8Array> => new Uint8Array(await Bun.file(path).arrayBuffer())

const purchasedImage: Step5Metadata = { imageService: 'gemini', imageModel: 'gemini-nano-banana-2.1', processingTime: 1, imageFileNames: ['generated-image.png'], imageCount: 1, imageFileSize: 4, imageWidth: undefined, imageHeight: undefined, requestMode: 'generation' }

describe('additive generation resume never overwrites earlier single-target artifacts', () => {
  test('video: a lone added model is staged and suffixed when the run already holds generated-video.mp4', async () => {
    await withTempDir('autoshow-video-resume-collision-', async dir => {
      await Bun.write(join(dir, 'generated-video.mp4'), purchased)
      const existing: Step6VideoMetadata[] = [{ videoGenService: 'grok', videoGenModel: 'grok-imagine-video-1.5-lite', processingTime: 1, videoFileName: 'generated-video.mp4', videoFileSize: 4, videoDuration: 8 }]
      const targets = [videoTarget()]
      const options = {} as VideoGenOptions
      const [metadata] = await videoResumeConfig.runMissingTargets(targets, 'prompt', dir, options, context(dir, targets, existing, options))
      expect(metadata).toMatchObject({ videoGenModel: 'gemini-omni-1.2-flash', videoFileName: 'generated-video-gemini-gemini-omni-1.2-flash.mp4', videoFileSize: 3 })
      expect(await bytes(join(dir, 'generated-video.mp4'))).toEqual(purchased)
      expect(await bytes(join(dir, 'generated-video-gemini-gemini-omni-1.2-flash.mp4'))).toEqual(added)
      expect((await readdir(dir)).sort()).toEqual(['generated-video-gemini-gemini-omni-1.2-flash.mp4', 'generated-video.mp4'])
    })
  })

  test('video: a resume with no earlier outputs keeps the fresh single-target name', async () => {
    await withTempDir('autoshow-video-resume-fresh-', async dir => {
      const targets = [videoTarget()]
      const options = {} as VideoGenOptions
      const [metadata] = await videoResumeConfig.runMissingTargets(targets, 'prompt', dir, options, context(dir, targets, [], options))
      expect(metadata?.videoFileName).toBe('generated-video.mp4')
      expect(await readdir(dir)).toEqual(['generated-video.mp4'])
    })
  })

  test('image: a lone added model keeps an earlier bare generated-image.png intact', async () => {
    await withTempDir('autoshow-image-resume-collision-', async dir => {
      await Bun.write(join(dir, 'generated-image.png'), purchased)
      const existing: Step5Metadata[] = [{ imageService: 'gemini', imageModel: 'gemini-nano-banana-2.1', processingTime: 1, imageFileNames: ['generated-image.png'], imageCount: 1, imageFileSize: 4, imageWidth: undefined, imageHeight: undefined, requestMode: 'generation' }]
      const targets = [imageTarget()]
      const options = {} as ImageGenOptions
      const [metadata] = await imageResumeConfig.runMissingTargets(targets, 'prompt', dir, options, context(dir, targets, existing, options))
      expect(metadata?.imageFileNames).toEqual(['generated-image-openai-gpt-image-2.6-flare.png'])
      expect(await bytes(join(dir, 'generated-image.png'))).toEqual(purchased)
      expect(await bytes(join(dir, 'generated-image-openai-gpt-image-2.6-flare.png'))).toEqual(added)
    })
  })

  test('music: a lone added model keeps an earlier bare generated-music.mp3 intact', async () => {
    await withTempDir('autoshow-music-resume-collision-', async dir => {
      await Bun.write(join(dir, 'generated-music.mp3'), purchased)
      const existing: Step7MusicMetadata[] = [{ musicService: 'minimax', musicModel: 'music-3.0', processingTime: 1, musicFileName: 'generated-music.mp3', musicFileSize: 4, musicDurationMs: 1000, lyricsSource: 'none' }]
      const targets = [musicTarget()]
      const options = {} as MusicGenOptions
      const [metadata] = await musicResumeConfig.runMissingTargets(targets, 'prompt', dir, options, context(dir, targets, existing, options))
      expect(metadata?.musicFileName).toBe('generated-music-elevenlabs-music_v2.mp3')
      expect(await bytes(join(dir, 'generated-music.mp3'))).toEqual(purchased)
      expect(await bytes(join(dir, 'generated-music-elevenlabs-music_v2.mp3'))).toEqual(added)
    })
  })

  test('video blocks a second dispatch after publication was interrupted before manifest reconciliation', async () => {
    await withTempDir('autoshow-video-interrupted-', async dir => {
      const artifact = 'generated-video-gemini-gemini-omni-1.2-flash.mp4'
      await Bun.write(join(dir, artifact), purchased)
      const target = videoTarget()
      const options = {} as VideoGenOptions
      let calls = 0
      const run = target.run
      target.run = async (...args) => { calls++; return await run(...args) }
      await expect(videoResumeConfig.runMissingTargets([target], 'prompt', dir, options, context(dir, [target], [], options))).rejects.toThrow(artifact)
      expect(calls).toBe(0)
      expect(await bytes(join(dir, artifact))).toEqual(purchased)
      expect(await readdir(dir)).toEqual([artifact])
    })
  })

  test('an interrupted image batch preserves its first file, blocks redispatch, and records only a later completed retry', async () => {
    await withTempDir('autoshow-image-interrupted-', async dir => {
      const target = imageTarget()
      const completed = { service: purchasedImage.imageService, model: purchasedImage.imageModel }
      await Bun.write(join(dir, 'generated-image.png'), purchased)
      await writeSingleManifestFixture(dir, 'image', {
        input: 'prompt', completionStatus: 'full', requestedProviders: [completed], image: [purchasedImage],
        providerStates: [{ ...completed, artifactDir: '.', status: 'succeeded', attempts: 1 }]
      })
      const manifestPath = join(dir, 'manifest.json')
      const originalManifest = await Bun.file(manifestPath).text()
      let calls = 0
      const run = target.run
      target.run = async (...args) => {
        calls++
        if (calls > 1) return await run(...args)
        await Bun.write(join(args[1], 'generated-image.png'), added)
        throw new Error('Failed to download second image')
      }
      const resume = () => resumeGenerationTarget(
        { kind: 'image', scope: 'single', dir, manifestPath },
        { ...imageResumeConfig, collectTargets: () => [target] },
        {} as ImageGenOptions, new Set(['openai-image'])
      )
      const workspace = join(dir, '.image-tmp-openai-gpt-image-2.6-flare')
      await expect(resume()).rejects.toThrow('Failed to download second image')
      expect(await bytes(join(workspace, 'generated-image.png'))).toEqual(added)
      await expect(resume()).rejects.toThrow(workspace)
      expect(calls).toBe(1)
      expect(await Bun.file(manifestPath).text()).toBe(originalManifest)
      expect(await bytes(join(dir, 'generated-image.png'))).toEqual(purchased)

      const archive = join(dir, 'earlier-attempt')
      await rename(workspace, archive)
      await resume()
      expect(calls).toBe(2)
      expect(await bytes(join(archive, 'generated-image.png'))).toEqual(added)
      const record = await readCanonicalRecord(dir)
      expect(record['image']).toMatchObject([
        { imageModel: purchasedImage.imageModel, imageFileNames: ['generated-image.png'] },
        { imageModel: target.model, imageFileNames: ['generated-image-openai-gpt-image-2.6-flare.png'] }
      ])
      await resume()
      expect(calls).toBe(2)
    })
  })

  test('publication refuses a destination created during dispatch and retains both sets of bytes', async () => {
    await withTempDir('autoshow-video-publish-race-', async dir => {
      const target = videoTarget()
      const run = target.run
      const dest = join(dir, 'generated-video.mp4')
      target.run = async (...args) => {
        await Bun.write(dest, purchased)
        return await run(...args)
      }
      const options = {} as VideoGenOptions
      await expect(videoResumeConfig.runMissingTargets([target], 'prompt', dir, options, context(dir, [target], [], options))).rejects.toThrow(dest)
      expect(await bytes(dest)).toEqual(purchased)
      expect(await bytes(join(dir, '.video-tmp-gemini-gemini-omni-1.2-flash', 'generated-video.mp4'))).toEqual(added)
    })
  })

  test('overlapping resumes for different image models preserve both provider records, costs and files', async () => {
    await withTempDir('autoshow-image-concurrent-resume-', async dir => {
      const complete = { service: purchasedImage.imageService, model: purchasedImage.imageModel }
      await Bun.write(join(dir, 'generated-image.png'), purchased)
      await writeSingleManifestFixture(dir, 'image', {
        input: 'prompt', completionStatus: 'full', requestedProviders: [complete], image: [purchasedImage],
        providerStates: [{ ...complete, artifactDir: '.', status: 'succeeded', attempts: 1 }]
      })
      const firstDispatch = Promise.withResolvers<void>()
      const releaseFirst = Promise.withResolvers<void>()
      const dispatches: string[] = []
      const resume = (model: 'gpt-image-2.6-flare' | 'gpt-image-2.6-sunburst', hold: boolean, data: Uint8Array) => {
        const target: ImageTarget = {
          service: 'openai', model, requestSettings: { model },
          run: async (_prompt, workspace) => {
            dispatches.push(model)
            if (hold) { firstDispatch.resolve(); await releaseFirst.promise }
            const path = join(workspace, 'generated-image.png')
            await Bun.write(path, data)
            return { imagePaths: [path], metadata: { ...purchasedImage, imageService: 'openai', imageModel: model, imageFileSize: data.length } }
          }
        }
        return resumeGenerationTarget(
          { kind: 'image', scope: 'single', dir, manifestPath: join(dir, 'manifest.json') },
          { ...imageResumeConfig, collectTargets: () => [target] },
          {} as ImageGenOptions, new Set(['openai-image'])
        )
      }
      const first = resume('gpt-image-2.6-flare', true, added)
      await firstDispatch.promise
      const otherBytes = new Uint8Array([2, 8])
      const second = resume('gpt-image-2.6-sunburst', false, otherBytes)
      try {
        // Give the second caller an opportunity to acquire its claim while the first still owns the run.
        await Bun.sleep(40)
        expect(dispatches).toEqual(['gpt-image-2.6-flare'])
      } finally {
        releaseFirst.resolve()
        await Promise.all([first, second])
      }
      expect(dispatches).toEqual(['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'])
      const record = await readCanonicalRecord(dir)
      expect(record['requestedProviders']).toMatchObject([complete, ...dispatches.map(model => ({ service: 'openai', model, settings: { request: { model } } }))])
      expect(record['image']).toMatchObject([
        { imageModel: purchasedImage.imageModel, imageFileNames: purchasedImage.imageFileNames },
        { imageModel: dispatches[0], imageFileNames: ['generated-image-openai-gpt-image-2.6-flare.png'] },
        { imageModel: dispatches[1], imageFileNames: ['generated-image-openai-gpt-image-2.6-sunburst.png'] }
      ])
      expect(record['cost']).toMatchObject({ actual: { steps: [ { model: complete.model }, { model: dispatches[0] }, { model: dispatches[1] } ] } })
      expect(await bytes(join(dir, 'generated-image-openai-gpt-image-2.6-flare.png'))).toEqual(added)
      expect(await bytes(join(dir, 'generated-image-openai-gpt-image-2.6-sunburst.png'))).toEqual(otherBytes)
    })
  })

  test('music blocks dispatch for an unrecorded additional paid part even when the primary output is missing', async () => {
    await withTempDir('autoshow-music-additional-part-', async dir => {
      const part = 'generated-music-elevenlabs-music_v2-part-2.mp3'
      await Bun.write(join(dir, part), purchased)
      const target = musicTarget()
      let calls = 0
      const run = target.run
      target.run = async (...args) => { calls++; return await run(...args) }
      const options = {} as MusicGenOptions
      await expect(musicResumeConfig.runMissingTargets([target], 'prompt', dir, options, context(dir, [target], [], options))).rejects.toThrow(part)
      expect(calls).toBe(0)
      expect(await bytes(join(dir, part))).toEqual(purchased)
    })
  })

  test('music accepts the original lyric and part files of an already recorded single-provider run', async () => {
    await withTempDir('autoshow-music-recorded-sidecars-', async dir => {
      const existing: Step7MusicMetadata = {
        musicService: 'gemini', musicModel: 'lyria-3.5', musicFileName: 'generated-music.mp3',
        musicDurationMs: 1000, musicFileSize: 4, processingTime: 1, lyricsSource: 'generated',
        generatedTextFileName: 'generated-music-gemini-lyria-3.5.txt',
        additionalAudioFileNames: ['generated-music-gemini-lyria-3.5-part-2.mp3']
      }
      for (const name of [existing.musicFileName, existing.generatedTextFileName!, ...existing.additionalAudioFileNames!, 'generated-music.txt', 'generated-music-part-2.mp3']) {
        await Bun.write(join(dir, name), purchased)
      }
      const target = musicTarget()
      const opts = {} as MusicGenOptions
      const [created] = await musicResumeConfig.runMissingTargets([target], 'prompt', dir, opts, context(dir, [target], [existing], opts))
      expect(created?.musicFileName).toBe('generated-music-elevenlabs-music_v2.mp3')
      expect(await bytes(join(dir, 'generated-music-part-2.mp3'))).toEqual(purchased)
      expect(await bytes(join(dir, 'generated-music.txt'))).toEqual(purchased)
    })
  })
})
