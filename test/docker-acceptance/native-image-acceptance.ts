import { expect } from 'bun:test'
import { join } from 'node:path'
import { requireRenderingPrerequisites } from '../../src/cli/commands/setup-and-utilities/setup/rendering-readiness'
import { renderPangoLayer } from '../../src/cli/commands/audio/music/lyrics-video/lyrics-overlay-renderer'
import { combineCharacterSketchSheet } from '../../src/cli/commands/visuals/comic/comic-commands/character-sketch/character-sketch-sheet'
import { exec } from '../../src/utils/cli-utils'

// Run in the exact candidate container with --network none. The launcher must also
// verify the Docker daemon architecture; process.arch alone cannot detect QEMU.
const expected = process.argv[2]
if (!['arm64', 'x64'].includes(expected ?? '') || process.arch !== expected) throw new Error(`Expected native ${expected}, found ${process.arch}`)
await requireRenderingPrerequisites()
const directory = '/tmp/autoshow-native-acceptance'
await Bun.$`mkdir -p ${directory}`.quiet()
const convert = Bun.which('magick') ?? Bun.which('convert')
expect(convert).toBeTruthy()
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
await renderPangoLayer({ text: 'Synthetic lyrics wrap across lines with <escaped> text & symbols', font: 'DejaVu Sans', fill: '#FFFFFF', pointSize: 20, width: 320, outputPath: overlay })
expect((await new Bun.Image(await Bun.file(overlay).arrayBuffer()).metadata()).height).toBeGreaterThan(30)
expect((await exec(convert!, [overlay, '-format', '%[opaque]', 'info:'])).stdout.trim().toLowerCase()).toBe('false')
console.log(JSON.stringify({ architecture: process.arch, bun: Bun.version, status: 'passed', checks: ['rendering-readiness', 'native-image-decode', 'character-sheet-dimensions', 'opaque-sheet', 'tiff-roundtrip', 'transparent-wrapped-lyrics'] }))
