import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { buildMupdfMakeArguments } from '~/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

test('keeps retired toolchain producer workflows out of repository automation', async () => {
  expect(await Bun.file(join(PROJECT_ROOT, '.github/workflows/macos-toolchain-unsigned.yml')).exists()).toBe(false)
  expect(await Bun.file(join(PROJECT_ROOT, '.github/workflows/macos-toolchain-release.yml')).exists()).toBe(false)
})

test('keeps the retired producer tool and its scripts out of the repository', async () => {
  expect(await Bun.file(join(PROJECT_ROOT, 'src/tools/macos-toolchain-producer.ts')).exists()).toBe(false)
  const packageJson = await Bun.file(join(PROJECT_ROOT, 'package.json')).text()
  expect(packageJson).not.toContain('toolchain:')
})

test('does not configure an unsigned or release candidate in production metadata', async () => {
  const dependencyMetadata = await Bun.file(join(PROJECT_ROOT, 'src/cli/commands/setup-and-utilities/setup/dependency-metadata.ts')).text()
  expect(dependencyMetadata).not.toContain('unsigned-verification')
})

test('disables host libcrypto discovery in the shared MuPDF recipe', () => {
  expect(buildMupdfMakeArguments(4)).toEqual([
    '-j', '4',
    'build=release',
    'HAVE_X11=no',
    'HAVE_GLUT=no',
    'HAVE_OBJCOPY=no',
    'HAVE_LIBCRYPTO=no'
  ])
})
