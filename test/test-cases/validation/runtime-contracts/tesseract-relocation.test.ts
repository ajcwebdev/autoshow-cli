import { expect, test } from 'bun:test'
import { chmod, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { buildManagedTesseractWrapperScript } from '~/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools'
import { withTempDir } from '../../../test-utils/temp-dirs'

test('managed Tesseract wrapper follows a moved runtime and preserves spaced arguments', async () => {
  await withTempDir('tesseract-relocation-', async dir => {
    const original = join(dir, 'old workspace')
    const moved = join(dir, 'new workspace')
    await mkdir(join(original, 'runtime/bin'), { recursive: true })
    await mkdir(join(original, 'runtime/tools/tesseract/bin'), { recursive: true })
    const wrapper = join(original, 'runtime/bin/tesseract')
    const binary = join(original, 'runtime/tools/tesseract/bin/tesseract')
    await Bun.write(wrapper, buildManagedTesseractWrapperScript())
    await Bun.write(binary, '#!'+process.execPath+'\nconsole.log(process.env.TESSDATA_PREFIX);console.log(process.env.DYLD_LIBRARY_PATH);console.log(process.argv.slice(2).join("\\n"));\n')
    await chmod(wrapper, 0o755)
    await chmod(binary, 0o755)
    await rename(original, moved)
    const child = Bun.spawn([join(moved, 'runtime/bin/tesseract'), 'image with spaces.png', 'stdout'], { stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'], DYLD_LIBRARY_PATH: '' } })
    const output = await new Response(child.stdout).text()
    expect(await child.exited).toBe(0)
    expect(output.trim().split('\n')).toEqual([
      join(moved, 'runtime/tools/tessdata'),
      `${join(moved, 'runtime/tools/leptonica/lib')}:${join(moved, 'runtime/tools/tesseract/lib')}:`,
      'image with spaces.png', 'stdout'
    ])
  })
})
