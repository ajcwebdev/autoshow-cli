import { describe, expect, test } from 'bun:test'
import { readdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import {
  buildGenerationArtifactPath,
  GENERATION_ARTIFACT_BASENAMES,
  runMediaGeneration
} from '~/cli/commands/command-shared/media-generation/media-generation-scaffold'
import { runImageGeneration } from '~/cli/commands/command-shared/media-generation/image-generation-scaffold'
import { runVideoGeneration } from '~/cli/commands/command-shared/media-generation/video-generation-scaffold'
import { runMusicGeneration } from '~/cli/commands/command-shared/media-generation/music-generation-scaffold'
import {
  getGenerationCredentialEntry,
  getGenerationStage,
  requireGenerationCredential
} from '~/cli/commands/command-shared/generation-routing/generation-credentials'
import { GENERATION_SELECTION_ENTRIES } from '~/cli/commands/command-shared/generation-routing/generation-selection-entries'
import { resolveCredential } from '~/utils/validate/env-utils'
import { UsageError } from '~/utils/error-handler'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const withCredential = async <T,>(service: string, run: () => Promise<T>): Promise<T> => {
  const envVar = resolveCredential(service, 'observe').envVar
  const previous = process.env[envVar]
  process.env[envVar] = 'test-key'
  try {
    return await run()
  } finally {
    if (previous === undefined) delete process.env[envVar]
    else process.env[envVar] = previous
  }
}

const writeArtifact = async (path: string, bytes: number): Promise<string> => {
  await Bun.write(path, new Uint8Array(bytes))
  return path
}

describe('media generation scaffold contracts', () => {
  test('artifact paths use the canonical basename per modality and normalize jpeg', () => {
    expect(GENERATION_ARTIFACT_BASENAMES).toEqual({ image: 'generated-image', video: 'generated-video', music: 'generated-music' })
    expect(buildGenerationArtifactPath('video', '/out')).toBe('/out/generated-video.mp4')
    expect(buildGenerationArtifactPath('music', '/out')).toBe('/out/generated-music.mp3')
    expect(buildGenerationArtifactPath('image', '/out')).toBe('/out/generated-image.png')
    expect(buildGenerationArtifactPath('image', '/out', 'jpeg')).toBe('/out/generated-image.jpg')
    expect(buildGenerationArtifactPath('image', '/out', 'webp', 2)).toBe('/out/generated-image-3.webp')
  })

  test('a rejected request fails in prepare, before any credential is read or directory is created', async () => {
    const outputDir = join(await makeTempDir('autoshow-scaffold-reject-'), 'nested')
    let credentialRead = false

    await expect(runMediaGeneration({
      modality: 'video',
      service: 'ltx',
      model: 'ltx-2-5-pro',
      outputDir,
      prepare: (context) => {
        void context
        throw UsageError('--mode reference-to-video is not supported by LTX.')
      },
      execute: async () => {
        credentialRead = true
        return { artifactPaths: [], metadata: {} }
      }
    })).rejects.toThrow('is not supported by LTX')

    expect(credentialRead).toBe(false)
    await expect(readdir(outputDir)).rejects.toThrow()
  })

  test('the credential is resolved from the registry with the modality stage and description', async () => {
    const entry = getGenerationCredentialEntry('video', 'ltx')
    expect(entry.credentialDescription).toBe('LTX video generation')
    expect(getGenerationStage('video', 'ltx')).toBe('video:ltx')

    const envVar = resolveCredential('ltx', 'observe').envVar
    const previous = process.env[envVar]
    delete process.env[envVar]
    try {
      expect(() => requireGenerationCredential('video', 'ltx'))
        .toThrow(`${envVar} environment variable is required for LTX video generation`)
    } finally {
      if (previous !== undefined) process.env[envVar] = previous
    }
  })

  test('every registered generation provider resolves a credential the registry knows', () => {
    for (const entry of GENERATION_SELECTION_ENTRIES) {
      const observation = resolveCredential(entry.service, 'observe')
      expect(observation.providerId, entry.flagName).toBe(entry.service)
      expect(entry.credentialDescription.length, entry.flagName).toBeGreaterThan(0)
      expect(getGenerationCredentialEntry(entry.modality, entry.service)).toEqual(entry)
    }
  })

  test('the run sequence logs the estimate before started and times only execute', async () => {
    const outputDir = await makeTempDir('autoshow-scaffold-sequence-')
    const order: string[] = []
    try {
      const run = await withCredential('ltx', async () => await runMediaGeneration({
        modality: 'video',
        service: 'ltx',
        model: 'ltx-2-5-fast',
        outputDir,
        startDetail: (prepared) => prepared.mode,
        prepare: async () => {
          order.push('prepare')
          await Bun.sleep(15)
          return { mode: 'text' }
        },
        estimate: () => { order.push('estimate') },
        execute: async (context) => {
          order.push('execute')
          await Bun.sleep(15)
          return {
            artifactPaths: [await writeArtifact(context.artifactPath(), 7)],
            metadata: { marker: true }
          }
        }
      }))

      expect(order).toEqual(['prepare', 'estimate', 'execute'])
      expect(run.fileNames).toEqual(['generated-video.mp4'])
      expect(run.primaryFileSize).toBe(7)
      expect(run.metadata).toEqual({ marker: true })
      // The sleep in `prepare` is excluded, so the timing covers the billed call only.
      expect(run.processingTime).toBeLessThan(30)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  test('an execute that writes no artifact is an infrastructure failure, not an empty success', async () => {
    const outputDir = await makeTempDir('autoshow-scaffold-empty-')
    try {
      await expect(withCredential('ltx', async () => await runMediaGeneration({
        modality: 'video',
        service: 'ltx',
        model: 'ltx-2-5-fast',
        outputDir,
        prepare: () => ({}),
        execute: async () => ({ artifactPaths: [], metadata: {} })
      }))).rejects.toThrow('ltx video generation completed without writing an artifact')
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  test('credential "none" leaves the key empty for providers whose client factory owns it', async () => {
    const outputDir = await makeTempDir('autoshow-scaffold-nocred-')
    try {
      const run = await runMediaGeneration({
        modality: 'music',
        service: 'minimax',
        model: 'music-3.0',
        outputDir,
        credential: 'none',
        prepare: (context) => ({ key: context.apiKey }),
        execute: async (context, prepared) => ({
          artifactPaths: [await writeArtifact(context.artifactPath(), 3)],
          metadata: prepared
        })
      })
      expect(run.metadata).toEqual({ key: '' })
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  test('the image wrapper stamps identity, count, names and primary size', async () => {
    const outputDir = await makeTempDir('autoshow-scaffold-image-')
    try {
      const result = await withCredential('gemini', async () => await runImageGeneration({
        service: 'gemini',
        model: 'gemini-3.1-flash-lite-image',
        outputDir,
        prepare: () => ({}),
        execute: async (context) => ({
          artifactPaths: [
            await writeArtifact(context.artifactPath('png', 0), 11),
            await writeArtifact(context.artifactPath('png', 1), 22)
          ],
          metadata: { imageWidth: undefined, imageHeight: undefined, requestMode: 'generation' as const }
        })
      }))

      expect(result.imagePaths.map(path => basename(path))).toEqual(['generated-image.png', 'generated-image-2.png'])
      expect(result.metadata.imageService).toBe('gemini')
      expect(result.metadata.imageModel).toBe('gemini-3.1-flash-lite-image')
      expect(result.metadata.imageCount).toBe(2)
      expect(result.metadata.imageFileNames).toEqual(['generated-image.png', 'generated-image-2.png'])
      expect(result.metadata.imageFileSize).toBe(11)
      expect(result.metadata.requestMode).toBe('generation')
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  test('the video and music wrappers stamp the primary file name and size', async () => {
    const outputDir = await makeTempDir('autoshow-scaffold-av-')
    try {
      const video = await withCredential('lumalabs', async () => await runVideoGeneration({
        service: 'lumalabs',
        model: 'ray-3.2',
        outputDir,
        prepare: () => ({}),
        execute: async (context) => ({
          artifactPaths: [await writeArtifact(context.artifactPath(), 5)],
          metadata: { videoDuration: 5, videoResolution: '720p' }
        })
      }))
      expect(video.metadata.videoGenService).toBe('lumalabs')
      expect(video.metadata.videoFileName).toBe('generated-video.mp4')
      expect(video.metadata.videoFileSize).toBe(5)
      expect(basename(video.videoPath)).toBe('generated-video.mp4')

      const music = await withCredential('gemini', async () => await runMusicGeneration({
        service: 'gemini',
        model: 'lyria-3.5',
        outputDir,
        prepare: () => ({}),
        execute: async (context) => ({
          artifactPaths: [await writeArtifact(context.artifactPath(), 9)],
          metadata: { musicDurationMs: 120_000, lyricsSource: 'generated' as const }
        })
      }))
      expect(music.metadata.musicService).toBe('gemini')
      expect(music.metadata.musicFileName).toBe('generated-music.mp3')
      expect(music.metadata.musicFileSize).toBe(9)
      expect(music.metadata.musicDurationMs).toBe(120_000)
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })
})
