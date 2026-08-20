import { expect, test } from 'bun:test'
import { runCommand } from '../../../../test-utils/test-helpers'

test('rejects unsupported Luma Labs image size flag', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'lumalabs=uni-1',
    '--size',
    '1024x1024'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(2)
  expect(output).toContain('--size is not supported by Luma Labs/uni-1')
})

test('rejects invalid Luma Labs aspect ratio values', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'lumalabs=uni-1',
    '--aspect-ratio',
    '5:7'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(2)
  expect(output).toContain('Invalid --aspect-ratio value "5:7" for Luma Labs')
})

test('rejects invalid Luma Labs output format values', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'image',
    'a sunset',
    '--provider',
    'lumalabs=uni-1',
    '--format',
    'webp'
  ])
  const output = `${result.stdout}\n${result.stderr}`

  expect(result.exitCode).toBe(2)
  expect(output).toContain('Invalid --format value "webp" for Luma Labs')
})
