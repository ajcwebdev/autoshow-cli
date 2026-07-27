import { expect, test } from 'bun:test'
import { runCommand } from '../../../../test-utils/test-helpers'

test('rejects simultaneous Recraft size and aspect-ratio flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'recraft=recraftv4_1',
    '--size',
    '1024x1024',
    '--aspect-ratio',
    '1:1'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('--image-size and --image-aspect-ratio cannot be used together for Recraft/recraftv4_1')
})

test('rejects Recraft counts above six', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'recraft=recraftv4_1',
    '--count',
    '7'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('Invalid --image-count value "7" for Recraft/recraftv4_1')
})

test('rejects Recraft edit and output-format flags', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'recraft=recraftv4_1',
    '--input',
    'input/examples/document/1-document.png',
    '--format',
    'webp'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).not.toBe(0)
  expect(output).toContain('--image-format, --image-input are not supported by Recraft/recraftv4_1')
})
