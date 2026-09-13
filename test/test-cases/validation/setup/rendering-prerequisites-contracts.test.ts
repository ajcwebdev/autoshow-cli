import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderPangoLayer } from '~/cli/commands/audio/music/lyrics-video/lyrics-overlay-renderer'
import { combineCharacterSketchSheet } from '~/cli/commands/visuals/comic/comic-commands/character-sketch/character-sketch-sheet'
import { exec } from '~/utils/cli-utils'

test('synthetic sheets and TIFF retain dimensions; lyric text wraps on transparent pixels', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-render-prereqs-'))
  const convert = Bun.which('magick') ?? Bun.which('convert')
  expect(convert).toBeTruthy()
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
