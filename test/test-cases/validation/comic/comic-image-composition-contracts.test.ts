import { describe,expect,test } from 'bun:test'
import { mkdir,readdir,rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { combineCharacterSketchSheet } from '~/cli/commands/process-steps/step-8-comic/comic-commands/character-sketch/character-sketch-sheet'
import { composeComicGridPage } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-grid-composer'
import { generateComicGridPages } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-comic-grid-pages'
import { CHARACTER_SKETCH_VIEWS } from '~/cli/commands/process-steps/step-8-comic/comic-commands/process-scenes/character-utils'
import { writeGeneratedImage } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/image-writer'
import {
getPanelPromptsDirectory,
getSceneOutputDirectory
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import type {
BunImageMetadataReader,
ComicBunImageCodec
} from '~/types'
import { pngSignature,redDotPng } from '../../../test-utils/media-fixtures'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const comicSourceRoot = 'src/cli/commands/process-steps/step-8-comic'

const getBunImageCodec = (): new (source: Uint8Array) => ComicBunImageCodec => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: Uint8Array) => ComicBunImageCodec }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for image writer contracts')
  }
  return imageConstructor
}

const getBunImageMetadataReader = (): new (source: ArrayBuffer) => BunImageMetadataReader => {
  const imageConstructor = (Bun as unknown as { Image?: new (source: ArrayBuffer) => BunImageMetadataReader }).Image
  if (!imageConstructor) {
    throw new Error('Bun.Image is required for image metadata contracts')
  }
  return imageConstructor
}

const collectTypeScriptFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      return await collectTypeScriptFiles(fullPath)
    }
    return entry.isFile() && fullPath.endsWith('.ts') ? [fullPath] : []
  }))
  return nested.flat()
}

describe('comic source coverage contracts', () => {

  test('comic source does not import OpenAI or Gemini SDK packages', async () => {
    const files = await collectTypeScriptFiles(comicSourceRoot)

    for (const file of files) {
      const source = await Bun.file(file).text()
      expect(source).not.toMatch(/from ['"](?:openai|openai\/|@google\/genai)/)
      expect(source).not.toMatch(/import\s+OpenAI\s+from ['"]openai/)
      expect(source).not.toMatch(/GoogleGenAI/)
      expect(source).not.toMatch(/(?:from|import)\s*\(?['"]sharp/)
    }
  })

  test('generated WebP and JPEG images are normalized to PNG with Bun.Image', async () => {
    const dir = await makeTempDir('autoshow-comic-image-writer-')
    const Image = getBunImageCodec()
    const encodedImages: Array<{ mimeType: string; bytes: Uint8Array; name: string }> = [
      { mimeType: 'image/webp', bytes: await new Image(redDotPng).webp().bytes(), name: 'webp' },
      { mimeType: 'image/jpeg', bytes: await new Image(redDotPng).jpeg().bytes(), name: 'jpeg' },
    ]

    try {
      for (const encoded of encodedImages) {
        const outputPath = join(dir, `${encoded.name}.png`)
        await writeGeneratedImage(outputPath, Buffer.from(encoded.bytes).toString('base64'), encoded.mimeType)
        const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())

        expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('character sketch sheet composition uses ImageMagick without sharp', async () => {
    if (!Bun.which('magick') && !Bun.which('convert')) {
      throw new Error('ImageMagick magick or convert is required for sketch sheet composition coverage')
    }

    const dir = await makeTempDir('autoshow-comic-sketch-sheet-')

    try {
      const sources = await Promise.all(CHARACTER_SKETCH_VIEWS.map(async (view) => {
        const path = join(dir, `${view}.png`)
        await writeFile(path, redDotPng)
        return { view, path }
      }))
      const outputPath = join(dir, 'sheet.png')
      const dimensions = await combineCharacterSketchSheet({
        outputPath,
        sources,
      })
      const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())

      expect(dimensions).toEqual({ width: 3, height: 1 })
      expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('comic grid composition uses ImageMagick and leaves partial cells blank', async () => {
    if (!Bun.which('magick') && !Bun.which('convert')) {
      throw new Error('ImageMagick magick or convert is required for comic grid composition coverage')
    }

    const dir = await makeTempDir('autoshow-comic-grid-page-')

    try {
      const sources = await Promise.all([1, 2, 3].map(async (panelNumber) => {
        const path = join(dir, `panel-${panelNumber}.png`)
        await writeFile(path, redDotPng)
        return path
      }))
      const outputPath = join(dir, 'page.png')
      const dimensions = await composeComicGridPage({
        sources,
        outputPath,
        grid: { columns: 2, rows: 2 },
        cellSize: { width: 1, height: 1 },
      })
      const outputBytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())
      const Image = getBunImageMetadataReader()
      const metadata = await new Image(await Bun.file(outputPath).arrayBuffer()).metadata()

      expect(dimensions).toEqual({ width: 2, height: 2 })
      expect(metadata.width).toBe(2)
      expect(metadata.height).toBe(2)
      expect(outputBytes.subarray(0, pngSignature.length)).toEqual(pngSignature)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test('comic grid generation reports missing panel PNG paths before composition', async () => {
    const sceneSlug = `grid-missing-${Date.now()}`
    const sceneRoot = getSceneOutputDirectory(sceneSlug)
    const expectedPanelPath = join(sceneRoot, 'panels', 'test-run', 'panel-01.png')

    try {
      await mkdir(join(getPanelPromptsDirectory(sceneSlug), 'panel-01'), { recursive: true })

      await expect(generateComicGridPages(sceneSlug, {
        models: ['gpt-image-2'],
        force: false,
        runId: 'test-run',
        concurrency: 1,
        panels: 'all',
        grid: { columns: 2, rows: 3 },
      }, {
        composeGridPage: async () => {
          throw new Error('compose should not run without panel PNGs')
        },
      })).rejects.toThrow(expectedPanelPath)
    } finally {
      await rm(sceneRoot, { recursive: true, force: true })
    }
  })
})
