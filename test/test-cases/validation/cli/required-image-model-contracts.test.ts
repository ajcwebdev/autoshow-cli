import { afterEach, expect, test } from 'bun:test'
import { parseNativeCli } from '~/cli/native/native-parser'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { enforceImageCommandPolicy, assertRequiredImageModel } from '~/utils/required-image-model'
import { collectImageTargets } from '~/cli/commands/process-steps/step-5-image/image-generation-targets'
import { runImageTargets } from '~/cli/commands/process-steps/step-5-image/run-image-gen'
import { createImage } from '~/cli/commands/process-steps/step-8-comic/comic-image-services/comic-image-targets'
const original = process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
afterEach(() => { if (original === undefined) delete process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']; else process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL'] = original })
function check(args: string[]) {
  process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL'] = 'gpt-image-2'
  const p = parseNativeCli(args, COMMAND_DEFINITIONS, createNativeRootDefinition().globalFlags)
  if (p.mode === 'help' || p.mode === 'version') return
  enforceImageCommandPolicy(p.calledAs ?? p.command!.name, p.flags, p.rawParsed.flagOccurrences)
}
for (const sub of ['generate-images', 'reference-sketch']) test(`${sub} explicit policy and parsed exemptions`, () => {
  for (const flags of [[], ['--price'], ['--image-model', 'other'], ['--image-model', 'gpt-image-2,other'], ['--image-model', 'gpt-image-2', '--image-model=gpt-image-2']]) expect(() => check(['comic', sub, ...(sub === 'generate-images' ? ['fixture'] : []), ...flags])).toThrow()
  for (const flags of [['--image-model', 'gpt-image-2'], ['--image-model=gpt-image-2', '--price'], ['--help'], ['-h']]) expect(() => check(['comic', sub, ...(sub === 'generate-images' ? ['fixture'] : []), ...flags])).not.toThrow()
})
test('standalone provider comparisons and prompt-text exemptions', () => {
  for (const flags of [[], ['--price'], ['--provider', 'openai=other'], ['--provider', 'openai=gpt-image-2,other'], ['--provider', 'openai=gpt-image-2', '--provider', 'gemini=other'], ['--provider', 'openai=gpt-image-2', '--all-providers']]) expect(() => check(['image', 'prompt', ...flags])).toThrow()
  expect(() => check(['image', '--help', '--provider', 'openai=other'])).not.toThrow()
  expect(() => check(['image', '--', '--help'])).toThrow()
  expect(() => check(['image', 'prompt --help --qa-only'])).toThrow()
  expect(() => check(['comic', 'reference-sketch', 'fixture', '--qa-only'])).toThrow()
  expect(() => check(['comic', 'generate-images', 'fixture', '--qa-only'])).not.toThrow()
  expect(() => check(['image', 'literal $() `text`', '--provider=openai=gpt-image-2', '--price'])).not.toThrow()
})
test('resolved and resumed targets and internal repairs retain policy; absent environment unrestricted', async () => {
  process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL'] = 'gpt-image-2'
  expect(() => collectImageTargets({ openaiImageModels: ['gpt-image-1'] } as never)).toThrow()
  await expect(runImageTargets([{ service: 'gemini', model: 'other' }] as never, 'test', '/unused', {})).rejects.toMatchObject({ exitCode: 64 })
  await expect(createImage('test', [], 'gpt-image-1' as never, '1536x1024', 'medium')).rejects.toMatchObject({ exitCode: 64 })
  delete process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL']
  expect(() => assertRequiredImageModel('other', 'gemini')).not.toThrow()
})

test('reserved character-sketch policy requires explicit model if dispatched internally', () => {
  process.env['AUTOSHOW_REQUIRED_IMAGE_MODEL'] = 'gpt-image-2'
  expect(() => enforceImageCommandPolicy('comic character-sketch', {}, [])).toThrow()
})

test('policy error uses normal CLI JSON diagnostics with exit 64 before creating output', async () => {
  const { mkdtemp, rm, readdir } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'image-policy-'))
  try {
    const cli = new URL('../../../../src/cli/create-cli.ts', import.meta.url).pathname
    const child = Bun.spawn([process.execPath, '--no-env-file', cli, 'image', 'prompt --help --qa-only', '--output-dir', 'output', '--price', '--json'], { cwd: dir, env: { PATH: process.env['PATH'], HOME: dir, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', AUTOSHOW_REQUIRED_IMAGE_MODEL: 'gpt-image-2' }, stdout: 'pipe', stderr: 'pipe' })
    const [code, stdout] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code).toBe(64)
    expect(JSON.stringify(JSON.parse(stdout))).toContain('Image-model policy')
    expect(await readdir(dir)).toEqual([])
  } finally { await rm(dir, { recursive: true, force: true }) }
})
