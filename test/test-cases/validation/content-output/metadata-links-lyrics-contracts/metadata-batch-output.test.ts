import { expect, test } from 'bun:test'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runCommand } from '../../../../test-utils/test-helpers'

test('metadata batch writes a manifest for every selected local item', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-metadata-batch-'))
  const listPath = join(dir, 'list.txt')
  await Bun.write(listPath, [
    resolve('input/examples/document/1-document.png'),
    resolve('input/examples/document/1-document.jpg')
  ].join('\n') + '\n')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    listPath,
    '--batch-limit', '2'
  ])

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).not.toContain('more than one terminal result')
  expect(result.outputDir).toBeTruthy()

  const children = (await readdir(result.outputDir!, { withFileTypes: true })).filter((entry) => entry.isDirectory())
  expect(children).toHaveLength(2)
  const formats: string[] = []
  for (const child of children) {
    const manifest = await Bun.file(join(result.outputDir!, child.name, 'manifest.json')).json() as {
      items: Array<{ metadata: { step1: { pageCount: number, format: string } } }>
    }
    expect(manifest.items[0]?.metadata.step1.pageCount).toBe(1)
    formats.push(manifest.items[0]!.metadata.step1.format)
  }
  expect(formats.sort()).toEqual(['jpg', 'png'])
})
