import { describe, expect, test } from 'bun:test'
import { readdir, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { runImageGen, runImageTargets } from '~/cli/commands/visuals/image/run-image-gen'
import type { ImageGenOptions, ImageTarget, Step5Metadata } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const BASE_OPTIONS: ImageGenOptions = { openaiImageModels: undefined, geminiImageModels: undefined }

const metadataFor = (target: ImageTarget, fileNames: string[]): Step5Metadata => ({
  imageService: target.service,
  imageModel: target.model,
  processingTime: 1,
  imageFileNames: fileNames,
  imageCount: fileNames.length,
  imageFileSize: 0,
  imageWidth: undefined,
  imageHeight: undefined,
  requestMode: 'generation'
})

// Writes as the real adapters do: single-target runs land straight in the output directory.
const makeTarget = (model: string, artifactNames: string[]): ImageTarget => ({
  service: 'openai',
  model,
  run: async (_prompt, workspaceDir) => {
    const imagePaths: string[] = []
    for (const name of artifactNames) {
      const filePath = join(workspaceDir, name)
      await writeFile(filePath, new Uint8Array([1, 2, 3, 4]))
      imagePaths.push(filePath)
    }
    return { imagePaths, metadata: metadataFor({ service: 'openai', model } as ImageTarget, artifactNames) }
  }
})

describe('image artifact finalization contracts', () => {
  test('a single target keeps its output-directory artifacts and still stamps names and size', async () => {
    const outputDir = await makeTempDir('autoshow-image-single-target-')
    try {
      const result = await runImageTargets(
        [makeTarget('gpt-image-2', ['generated-image.png', 'generated-image-2.png'])],
        'prompt',
        outputDir,
        BASE_OPTIONS
      )

      expect(result.imagePaths.map(path => basename(path))).toEqual(['generated-image.png', 'generated-image-2.png'])
      expect(result.metadata[0]?.imageFileNames).toEqual(['generated-image.png', 'generated-image-2.png'])
      expect(result.metadata[0]?.imageCount).toBe(2)
      expect(result.metadata[0]?.imageFileSize).toBe(4)
      expect((await readdir(outputDir)).sort()).toEqual(['generated-image-2.png', 'generated-image.png'])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  test('multiple targets are renamed per service and model, including extra artifacts', async () => {
    const outputDir = await makeTempDir('autoshow-image-multi-target-')
    try {
      const result = await runImageTargets(
        [
          makeTarget('gpt-image-2', ['a.png', 'b.png']),
          makeTarget('gpt-image-2.5-flare', ['c.jpg'])
        ],
        'prompt',
        outputDir,
        BASE_OPTIONS
      )

      expect(result.metadata.map(entry => entry.imageFileNames)).toEqual([
        ['generated-image-openai-gpt-image-2.png', 'generated-image-openai-gpt-image-2-2.png'],
        ['generated-image-openai-gpt-image-2.5-flare.jpg']
      ])
      expect(result.imagePaths.map(path => basename(path))).toEqual([
        'generated-image-openai-gpt-image-2.png',
        'generated-image-openai-gpt-image-2-2.png',
        'generated-image-openai-gpt-image-2.5-flare.jpg'
      ])
      // The per-target workspaces are cleaned up, leaving only the renamed artifacts.
      expect((await readdir(outputDir)).sort()).toEqual([
        'generated-image-openai-gpt-image-2-2.png',
        'generated-image-openai-gpt-image-2.5-flare.jpg',
        'generated-image-openai-gpt-image-2.png'
      ])
    } finally {
      await rm(outputDir, { recursive: true, force: true })
    }
  })

  test('selecting no image provider is a usage error, matching video and music', async () => {
    await expect(runImageGen('prompt', '/unused', {})).rejects.toMatchObject({ kind: 'usage' })
    await expect(runImageGen('prompt', '/unused', {})).rejects.toThrow('Specify an image generation provider')
  })
})
