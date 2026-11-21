import { describe,expect,test } from 'bun:test'
import { mkdir,readdir,rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { combineCharacterSketchSheet } from '~/cli/commands/visuals/comic/comic-commands/character-sketch/character-sketch-sheet'
import { composeComicGridPage } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-grid-composer'
import { generateComicGridPages } from '~/cli/commands/visuals/comic/comic-commands/generate-images/generate-comic-grid-pages'
import { beginSceneRun } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { getPageComicImagePath } from '~/cli/commands/visuals/comic/comic-utils/scene-utils'
import { CHARACTER_SKETCH_VIEWS } from '~/cli/commands/visuals/comic/comic-commands/process-scenes/character-utils'
import { writeGeneratedImage } from '~/cli/commands/visuals/comic/comic-image-services/image-writer'
import {
getPanelPromptsDirectory,
getSceneOutputDirectory
} from '~/cli/commands/visuals/comic/comic-utils/project-paths'
import { pngSignature,redDotPng } from '../../../../test-utils/media-fixtures'
import { seededPng } from '../../../../test-utils/seeded-png-fixture'
import { makeTempDir, withTempDir } from '../../../../test-utils/temp-dirs'
import { decodePngRgba8 } from '~/utils/lossless-png'
import { hasRuntimeTool } from '~/utils/runtime-paths'

const comicSourceRoot = 'src/cli/commands/visuals/comic'

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
    const Image = Bun.Image
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
    if (!hasRuntimeTool('magick') && !hasRuntimeTool('convert')) {
      throw new Error('Managed ImageMagick is required for sketch sheet composition coverage; run bun autoshow setup --step rendering')
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
    if (!hasRuntimeTool('magick') && !hasRuntimeTool('convert')) {
      throw new Error('Managed ImageMagick is required for comic grid composition coverage; run bun autoshow setup --step rendering')
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
      const metadata = await new Bun.Image(await Bun.file(outputPath).arrayBuffer()).metadata()

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
        model: 'gpt-image-2.6-flare',
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

  test('grid generation centers a reused portrait selection and square and wide run candidates in their cells', async () => {
    await withTempDir('autoshow-comic-grid-fit-', async sceneRoot => {
      const sceneSlug = 'grid-fit'
      const runId = 'test-grid-fit'
      beginSceneRun(sceneSlug, { outputDir: sceneRoot })
      const prompts = getPanelPromptsDirectory(sceneSlug)
      await mkdir(join(prompts, 'panel-01'), { recursive: true })
      await mkdir(join(prompts, 'panel-02'), { recursive: true })
      await mkdir(join(prompts, 'panel-03'), { recursive: true })
      await mkdir(join(sceneRoot, 'panels', runId), { recursive: true })
      const portrait = seededPng(1, 1024, 2048)
      const square = seededPng(2, 512, 512)
      const wide = seededPng(3, 2048, 1024)
      const selectedPath = join(sceneRoot, 'panels', 'panel-01.png')
      const candidatePath = join(sceneRoot, 'panels', runId, 'panel-02.png')
      const widePath = join(sceneRoot, 'panels', runId, 'panel-03.png')
      await writeFile(selectedPath, portrait)
      await writeFile(candidatePath, square)
      await writeFile(widePath, wide)

      await generateComicGridPages(sceneSlug, {
        model: 'gpt-image-2.6-flare', force: false, runId, concurrency: 1, panels: 'all', grid: { columns: 2, rows: 2 },
      })
      const pagePath = getPageComicImagePath(sceneSlug, 1, [1, 2, 3], { runId })
      const page = decodePngRgba8(await new Bun.Image(Bun.file(pagePath)).png().bytes())
      expect([page.width, page.height]).toEqual([3072, 2048])
      const pixel = (x: number, y: number) => {
        const offset = (y * page.width + x) * 4
        return [...page.pixels.subarray(offset, offset + 4)]
      }
      const white = [255, 255, 255, 255]
      const portraitColor = [...decodePngRgba8(seededPng(1)).pixels.subarray(0, 4)]
      const squareColor = [...decodePngRgba8(seededPng(2)).pixels.subarray(0, 4)]
      const wideColor = [...decodePngRgba8(seededPng(3)).pixels.subarray(0, 4)]
      // The portrait occupies 512 centered columns; the square occupies 1024.
      expect(pixel(511, 0)).toEqual(white)
      expect(pixel(512, 0)).toEqual(portraitColor)
      expect(pixel(1023, 1023)).toEqual(portraitColor)
      expect(pixel(1024, 1023)).toEqual(white)
      expect(pixel(1791, 0)).toEqual(white)
      expect(pixel(1792, 0)).toEqual(squareColor)
      expect(pixel(2815, 1023)).toEqual(squareColor)
      expect(pixel(2816, 1023)).toEqual(white)
      // The wide candidate occupies 768 rows in the third cell. The fourth cell stays empty.
      expect(pixel(0, 1151)).toEqual(white)
      expect(pixel(0, 1152)).toEqual(wideColor)
      expect(pixel(1535, 1919)).toEqual(wideColor)
      expect(pixel(1535, 1920)).toEqual(white)
      expect(pixel(1536, 1500)).toEqual(white)
      expect(await Bun.file(selectedPath).bytes()).toEqual(new Uint8Array(portrait))
      expect(await Bun.file(candidatePath).bytes()).toEqual(new Uint8Array(square))
      expect(await Bun.file(widePath).bytes()).toEqual(new Uint8Array(wide))
    })
  })
})
