import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderPangoLayer } from '~/cli/commands/audio/music/lyrics-video/lyrics-overlay-renderer'
import { combineCharacterSketchSheet } from '~/cli/commands/visuals/comic/comic-commands/character-sketch/character-sketch-sheet'
import { exec } from '~/utils/cli-utils'
import { getImageMagickBinary, hasRuntimeTool } from '~/utils/runtime-paths'
import { requireRenderingPrerequisites, supportsImageMagickTiffRead } from '~/cli/commands/setup-and-utilities/setup/rendering-readiness'

test('rendering readiness accepts current and earlier TIFF format tables and rejects unavailable readers', () => {
  for (const formats of [
    '   Format  Mode  Description\n     TIFF* rw+   Tagged Image File Format\n',
    '     TIFF* TIFF      rw+ Tagged Image File Format\n',
    '     TIFF  r--   Tagged Image File Format\n'
  ]) expect(supportsImageMagickTiffRead(formats)).toBe(true)
  for (const formats of [
    '     TIFF* -w+   Tagged Image File Format\n',
    '     TIFF* TIFF      --- Tagged Image File Format\n',
    '     TIFF64* rw+   Tagged Image File Format\n',
    '     PNG* rw+ Portable Network Graphics\n',
    '     TIFF* reader unavailable\n'
  ]) expect(supportsImageMagickTiffRead(formats)).toBe(false)
})

test('synthetic sheets and TIFF retain dimensions; lyric text wraps on transparent pixels', async () => {
  await requireRenderingPrerequisites()
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-render-prereqs-'))
  expect(hasRuntimeTool('magick') || hasRuntimeTool('convert')).toBe(true)
  const convert = getImageMagickBinary()
  try {
    const first = join(directory, 'first.png'), second = join(directory, 'second.png'), sheet = join(directory, 'sheet.png')
    expect((await exec(convert!, ['-size', '16x24', 'xc:none', '-fill', 'red', '-draw', 'rectangle 4,4 12,20', first])).exitCode).toBe(0)
    expect((await exec(convert!, ['-size', '24x16', 'xc:blue', second])).exitCode).toBe(0)
    expect(await combineCharacterSketchSheet({ outputPath: sheet, sources: [{ view: 'front', path: first }, { view: 'profile', path: second }] })).toEqual({ width: 40, height: 24 })
    expect((await exec(convert!, [sheet, '-format', '%[opaque]', 'info:'])).stdout.trim().toLowerCase()).toBe('true')
    const tiff = join(directory, 'source.tiff'), restored = join(directory, 'restored.png')
    expect((await exec(convert!, [first, tiff])).exitCode).toBe(0)
    expect((await exec(convert!, [tiff, restored])).exitCode).toBe(0)
    expect(await new Bun.Image(await Bun.file(restored).arrayBuffer()).metadata()).toMatchObject({ width: 16, height: 24 })
    const overlay = join(directory, 'overlay.png')
    await renderPangoLayer({ text: 'Synthetic lyrics wrap over multiple lines with <escaped> text & symbols', font: 'DejaVu Sans', fill: '#FFFFFF', pointSize: 20, width: 320, outputPath: overlay })
    const metadata = await new Bun.Image(await Bun.file(overlay).arrayBuffer()).metadata()
    expect(metadata.height).toBeGreaterThan(30)
    expect((await exec(convert!, [overlay, '-format', '%[opaque]', 'info:'])).stdout.trim().toLowerCase()).toBe('false')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
