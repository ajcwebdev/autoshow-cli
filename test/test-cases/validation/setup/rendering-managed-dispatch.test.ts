import { expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { renderPangoLayer, resolveConvertCommand } from '~/cli/commands/audio/music/lyrics-video/lyrics-overlay-renderer'
import { normalizeHostedDirectImageInput } from '~/cli/commands/text/ocr/hosted-ocr'
import { configureBinDir, getConfiguredBinDir } from '~/utils/runtime-paths'
import { createRuntimeTempDirectory, RUNTIME_CACHE_DIR, RUNTIME_FONTCONFIG_DIR, RUNTIME_TEMP_DIR } from '~/utils/runtime-state'

const withManagedRenderingFixture = async (run: (fixture: { bin: string, directory: string, log: string }) => Promise<void>): Promise<void> => {
  const directory = await createRuntimeTempDirectory('rendering-dispatch-')
  const bin = join(directory, 'bin')
  const log = join(directory, 'arguments.txt')
  const previousBinDir = getConfiguredBinDir()
  await mkdir(bin)
  const shellLog = `'${log.replace(/'/g, "'\\''")}'`
  const script = `#!/bin/sh\nprintf '%s\\n' "$0" "$FONTCONFIG_FILE" "$FONTCONFIG_PATH" "$XDG_CACHE_HOME" "$TMPDIR" "$@" > ${shellLog}\n`
  for (const command of ['magick', 'pango-view']) await writeFile(join(bin, command), script, { mode: 0o755 })
  configureBinDir(bin)
  try {
    await run({ bin, directory, log })
  } finally {
    configureBinDir(previousBinDir ?? '')
    await rm(directory, { recursive: true, force: true })
  }
}

test('text overlay dispatch selects managed Pango with private fonts and caches; mocked transport does not establish rendered text quality', async () => {
  await withManagedRenderingFixture(async ({ bin, directory, log }) => {
    const outputPath = join(directory, 'overlay.png')
    expect(await renderPangoLayer({
      text: 'A <caption> & a second word', font: 'DejaVu Sans', fill: '#FFFFFF', pointSize: 20,
      width: 320, outputPath, bold: true
    })).toBe(outputPath)
    const lines = (await Bun.file(log).text()).trimEnd().split('\n')
    expect(lines.slice(0, 4)).toEqual([
      join(bin, 'pango-view'), join(RUNTIME_FONTCONFIG_DIR, 'fonts.conf'), RUNTIME_FONTCONFIG_DIR,
      RUNTIME_CACHE_DIR
    ])
    expect(lines[4] === RUNTIME_TEMP_DIR || lines[4]?.startsWith(`${RUNTIME_TEMP_DIR}/`)).toBe(true)
    const args = lines.slice(5)
    expect(args[args.indexOf('--text') + 1]).toBe('<span foreground="#FFFFFF" weight="bold">A &lt;caption&gt; &amp; a second word</span>')
    expect(args[args.indexOf('--font') + 1]).toBe('DejaVu Sans 20')
    expect(args[args.indexOf('--output') + 1]).toBe(outputPath)
  })
})

test('TIFF normalization dispatch uses managed ImageMagick; mocked transport does not establish decoded image integrity', async () => {
  await withManagedRenderingFixture(async ({ bin, directory, log }) => {
    expect(resolveConvertCommand()).toBe(join(bin, 'magick'))
    const input = join(directory, 'source.tiff')
    const output = await normalizeHostedDirectImageInput(input, 'openai-ocr', directory, 'normalized')
    expect(output).toEqual({ filePath: join(directory, 'normalized.png'), format: 'png' })
    const lines = (await Bun.file(log).text()).trimEnd().split('\n')
    expect(lines[0]).toBe(join(bin, 'magick'))
    expect(lines.slice(5)).toEqual([input, join(directory, 'normalized.png')])
  })
})
