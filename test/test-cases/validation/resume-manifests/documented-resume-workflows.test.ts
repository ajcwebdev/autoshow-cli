import { afterAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import { childEnv } from '~/utils/child-env'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import type { Step3Metadata } from '~/types'
import { createTempDirTracker } from '../../../test-utils/temp-dirs'

const tempDirs = createTempDirTracker('autoshow-documented-resume-')
afterAll(async () => await tempDirs.cleanup())
const guide = 'docs/commands/00-setup-and-utilities/resume.md'
type MockMode = 'partial' | 'complete' | 'freeform-partial'

const createWorkspace = async () => {
  const temporary = await tempDirs.make()
  const root = join(temporary, 'example')
  const preload = join(temporary, 'transport.ts')
  const callsPath = join(temporary, 'calls.jsonl')
  await Bun.write(preload, `import { appendFileSync } from 'node:fs'
globalThis.fetch = async (input, init) => {
  const url = String(input)
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {}
  appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify({ url, model: body.model }) + '\\n')
  const mode = process.env.AUTOSHOW_DOCUMENTED_RESUME_TRANSPORT
  if (!mode) throw new Error('Network forbidden in local resume documentation workflow')
  if (!(url === 'https://api.openai.com/v1/responses' || url === 'https://api.x.ai/v1/chat/completions')) throw new Error('Unexpected mocked endpoint: ' + url)
  if (url.startsWith('https://api.openai.com/') && mode.endsWith('partial')) return Response.json({ error: { message: 'Controlled unavailable OpenAI target for resume contract.' } }, { status: 404 })
  const payload = mode === 'freeform-partial' ? { content: 'Controlled custom freeform output.' } : { episodeDescription: 'Controlled transport summary of the Harborlight observations.' }
  if (url === 'https://api.openai.com/v1/responses') return Response.json({ model: body.model, output_text: JSON.stringify(payload), usage: { input_tokens: 80, output_tokens: 16 } })
  return Response.json({ model: body.model, choices: [{ message: { content: JSON.stringify(payload) } }], usage: { prompt_tokens: 80, completion_tokens: 16, total_tokens: 96 } })
}
`)
  const execute = async (args: string[], mode?: MockMode, withConfig = true) => {
    const child = Bun.spawn([
      process.execPath, '--no-env-file', '--preload', preload, ...args,
      ...(withConfig ? ['--config-path', join(root, 'empty-config.json')] : []), '--json'
    ], {
      env: childEnv({ set: { HOME: temporary, ...(mode ? { AUTOSHOW_DOCUMENTED_RESUME_TRANSPORT: mode, OPENAI_API_KEY: 'controlled-openai-key', XAI_API_KEY: 'controlled-grok-key' } : {}) } }),
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(25_000)
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { code, stdout, stderr }
  }
  const preparation = (await Bun.file(guide).text()).match(/bun --no-env-file - <<'JS'\n([\s\S]+?)\nJS\n/)
  if (!preparation?.[1]) throw new Error('Resume guide preparation command is missing')
  const program = join(temporary, 'prepare.ts')
  await Bun.write(program, preparation[1].replace("const root = 'output/resume-example'", `const root = ${JSON.stringify(root)}`))
  const prepare = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, program], { env: childEnv({ set: { HOME: temporary } }), stdout: 'pipe', stderr: 'pipe' })
  const prepareError = await new Response(prepare.stderr).text()
  expect({ code: await prepare.exited, prepareError }).toMatchObject({ code: 0 })
  const cli = async (args: string[], mode?: MockMode, withConfig = true) => await execute(['src/cli/create-cli.ts', ...args], mode, withConfig)
  const success = async (args: string[], mode?: MockMode, withConfig = true) => {
    const result = await cli(args, mode, withConfig)
    expect(result, result.stderr).toMatchObject({ code: 0 })
    return JSON.parse(result.stdout)
  }
  const calls = async (): Promise<Array<{ url: string; model: string }>> => (await Bun.file(callsPath).exists())
    ? (await Bun.file(callsPath).text()).trim().split('\n').map(line => JSON.parse(line))
    : []
  return { root, temporary, program, cli, success, calls }
}

test('documented local item, batch and PDF commands produce genuine manifests and compatible read-only resume plans', async () => {
  const w = await createWorkspace()
  const article = join(w.root, 'article'), batch = join(w.root, 'batch'), document = join(w.root, 'document')
  await w.success(['extract', 'input/examples/document/harborlight-article.html', '--output-dir', article])
  await w.success(['extract', join(w.root, 'batch-inputs'), '--batch-limit', 'all', '--output-dir', batch])
  await w.success(['extract', 'input/examples/document/harborlight-field-notes.pdf', '--provider', 'tesseract', '--no-chapters', '--output-dir', document])
  for (const [directory, scope] of [[article, 'single'], [batch, 'batch'], [document, 'single']] as const) {
    const manifest = await readManifest(directory)
    expect(manifest).toMatchObject({ command: 'extract', scope })
    expect(manifest!.items.length).toBeGreaterThan(0)
    expect(manifest!.items.every(item => item.status === 'full')).toBe(true)
  }
  expect((await readManifest(batch))!.items).toHaveLength(2)
  expect((await readManifest(batch))!.items.every(item => item.child?.route === 'article')).toBe(true)
  expect((await Bun.file(join(article, 'extraction.txt')).text()).length).toBeGreaterThan(100)
  expect(await Bun.file(join(document, 'extraction.txt')).text()).toContain('First light')
  const originalArticle = await Bun.file(join(article, 'manifest.json')).text()
  const originalDocument = await Bun.file(join(document, 'extraction.txt')).text()
  for (const args of [
    [article, '--price'], [batch, '--price'],
    [article, '--provider', 'defuddle', '--price'],
    [article, batch, '--provider', 'defuddle', '--price'],
    [document, '--provider', 'tesseract', '--price'],
    [document, '--all-local', '--price']
  ]) {
    const result = await w.success(['resume', ...args])
    expect(result.status).toBe('success')
    expect(result.data.estimate.totalEstimatedCostCents).toBe(0)
  }
  expect(await Bun.file(join(article, 'manifest.json')).text()).toBe(originalArticle)
  await w.success(['resume', article])
  await w.success(['resume', batch])
  expect(await Bun.file(join(article, 'manifest.json')).text()).toBe(originalArticle)
  expect(await Bun.file(join(document, 'extraction.txt')).text()).toBe(originalDocument)
  for (const selection of [['--provider', 'openai=gpt-6-luna'], ['--all-providers']]) {
    const result = await w.success(['resume', document, ...selection, '--price'])
    expect(result.data.estimate.steps.some((step: { provider: string }) => step.provider === 'openai')).toBe(true)
    expect(result.data.estimate.steps.some((step: { provider: string }) => step.provider === 'deepinfra')).toBe(false)
  }
  const retiredOcr = await w.cli(['resume', document, '--provider', 'deepinfra', '--price'])
  expect(retiredOcr.code).not.toBe(0)
  expect(await w.calls()).toEqual([])
  const incompatible = await w.cli(['resume', article, '--provider', 'deepinfra', '--price'])
  expect(incompatible.code).not.toBe(0)
  expect(await w.calls()).toEqual([])
}, 30_000)

test('normal write orchestration records a controlled failed provider and resume backfills only that selected slot', async () => {
  const w = await createWorkspace()
  const output = join(w.root, 'write')
  const selected = ['--provider', 'grok=grok-4.7', '--provider', 'openai=gpt-6-luna']
  const initial = await w.cli(['write', 'input/examples/document/harborlight-field-notes.md', ...selected, '--prompt', 'shortSummary', '--output-dir', output], 'partial')
  expect(initial.code).toBe(0)
  expect(initial.stderr).toContain('partial failures')
  const partial = await readManifest(output)
  expect(partial).toMatchObject({ command: 'write', scope: 'single' })
  expect(partial!.items[0]!.status).toBe('incomplete')
  expect(partial!.items[0]!.providers).toEqual(expect.arrayContaining([
    expect.objectContaining({ service: 'grok', model: 'grok-4.7', status: 'succeeded' }),
    expect.objectContaining({ service: 'openai', model: 'gpt-6-luna', status: 'failed' })
  ]))
  const steps = partial!.items[0]!.metadata['step3']
  const completed = (Array.isArray(steps) ? steps : [steps]) as Step3Metadata[]
  const grok = completed.find(step => step.llmService === 'grok')!
  expect(grok).toBeDefined()
  const savedOutput = await Bun.file(join(output, grok.outputFileName)).text()
  const prompt = await Bun.file(join(output, 'prompt.md')).text()
  expect(await Bun.file(join(output, 'source.txt')).exists()).toBe(true)
  const beforePrice = await Bun.file(join(output, 'manifest.json')).text()
  const firstCalls = await w.calls()
  expect(firstCalls).toHaveLength(2)
  const price = await w.success(['resume', output, ...selected, '--price'])
  expect(price.data.estimate.steps).toEqual([expect.objectContaining({ provider: 'openai', model: 'gpt-6-luna' })])
  expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(beforePrice)
  expect(await w.calls()).toEqual(firstCalls)
  const missingSelection = await w.cli(['resume', output])
  expect(missingSelection.code).toBe(0)
  expect((await readManifest(output))!.items[0]!.status).toBe('incomplete')
  await w.success(['resume', output, ...selected], 'complete')
  const recovered = await readManifest(output)
  expect(recovered!.items[0]!.status).toBe('full')
  expect(recovered!.items[0]!.providers.every(provider => provider.status === 'succeeded')).toBe(true)
  expect(await Bun.file(join(output, grok.outputFileName)).text()).toBe(savedOutput)
  expect(await Bun.file(join(output, 'prompt.md')).text()).toBe(prompt)
  expect(await w.calls()).toHaveLength(3)
  expect((await w.calls()).at(-1)).toMatchObject({ model: 'gpt-6-luna' })
  await w.success(['resume', output, ...selected])
  expect(await w.calls()).toHaveLength(3)
}, 30_000)

test('all failed write requests retain real failure states, prompt and source snapshot for selected recovery', async () => {
  const w = await createWorkspace()
  const output = join(w.root, 'all-failed')
  const initial = await w.cli(['write', 'input/examples/document/harborlight-field-notes.md', '--provider', 'openai=gpt-6-luna', '--prompt', 'shortSummary', '--output-dir', output], 'partial')
  expect(initial.code).not.toBe(0)
  const manifest = await readManifest(output)
  expect(manifest).toMatchObject({ command: 'write', scope: 'single' })
  expect(manifest!.items[0]).toMatchObject({ status: 'failed', providers: [expect.objectContaining({ service: 'openai', status: 'failed', error: expect.objectContaining({ message: expect.stringContaining('Controlled unavailable') }) })] })
  expect(manifest!.items[0]!.metadata['step3']).toEqual([])
  const prompt = await Bun.file(join(output, 'prompt.md')).text()
  expect(prompt.length).toBeGreaterThan(0)
  const source = await Bun.file(join(output, 'source.txt')).text()
  expect(source).toContain('Harborlight')
  const beforePrice = await Bun.file(join(output, 'manifest.json')).text()
  const price = await w.success(['resume', output, '--provider', 'openai=gpt-6-luna', '--price'])
  expect(price.data.estimate.steps).toEqual([expect.objectContaining({ provider: 'openai' })])
  expect(price.data.estimate.steps[0].estInputTokens).toBeGreaterThan(0)
  expect(price.data.estimate.steps[0].estOutputTokens).toBeGreaterThan(0)
  expect(price.data.estimate.steps[0].totalCostCents).toBeGreaterThan(0)
  expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(beforePrice)
  expect(await w.calls()).toHaveLength(1)
  await w.success(['resume', output, '--provider', 'openai=gpt-6-luna'], 'complete')
  expect((await readManifest(output))!.items[0]!.status).toBe('full')
  expect(await Bun.file(join(output, 'prompt.md')).text()).toBe(prompt)
  expect(await Bun.file(join(output, 'source.txt')).text()).toBe(source)
  expect(await w.calls()).toHaveLength(2)
}, 30_000)

test('all-failed custom prompt-file recovery refuses an unavailable saved schema before pricing or dispatch', async () => {
  const w = await createWorkspace()
  const output = join(w.root, 'custom-prompt-failed')
  const promptFile = join(w.root, 'custom-prompt.txt')
  await Bun.write(promptFile, 'Write a concise plain-language observation of this fictional harbor.\n')
  const initial = await w.cli(['write', 'input/examples/document/harborlight-field-notes.md', '--provider', 'openai=gpt-6-luna', '--prompt-file', promptFile, '--output-dir', output], 'partial')
  expect(initial.code).not.toBe(0)
  expect((await readManifest(output))!.items[0]!.status).toBe('failed')
  const before = await Bun.file(join(output, 'manifest.json')).text()
  const calls = await w.calls()
  for (const flags of [['--price'], []]) {
    const resume = await w.cli(['resume', output, '--provider', 'openai=gpt-6-luna', ...flags])
    expect(resume.code).not.toBe(0)
    expect(resume.stdout + resume.stderr).toContain('cannot restore the original custom prompt-file schema')
    expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(before)
    expect(await w.calls()).toEqual(calls)
  }
}, 30_000)

test('partial prompt-file-only recovery rejects schema substitution even with explicit preset overrides', async () => {
  const w = await createWorkspace()
  const output = join(w.root, 'partial-custom')
  const promptFile = join(w.root, 'freeform.txt')
  await Bun.write(promptFile, 'Write a concise observation in the custom content envelope.\n')
  await w.success(['write', 'input/examples/document/harborlight-field-notes.md', '--provider', 'grok=grok-4.7', '--provider', 'openai=gpt-6-luna', '--prompt-file', promptFile, '--output-dir', output], 'freeform-partial')
  expect((await readManifest(output))!.items[0]!.status).toBe('incomplete')
  const before = await Bun.file(join(output, 'manifest.json')).text(), calls = await w.calls()
  await w.success(['resume', output, '--provider', 'grok=grok-4.7', '--price'])
  await w.success(['resume', output, '--provider', 'grok=grok-4.7'])
  expect(await w.calls()).toEqual(calls)
  for (const flags of [['--price'], [], ['--prompt', 'shortSummary', '--price'], ['--prompt', 'shortSummary']]) {
    const result = await w.cli(['resume', output, '--provider', 'openai=gpt-6-luna', ...flags])
    expect(result.code).not.toBe(0)
    expect(result.stdout + result.stderr).toContain('cannot restore the original custom prompt-file schema')
    expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(before)
    expect(await w.calls()).toEqual(calls)
  }
}, 30_000)

test('ordinary named presets plus a recorded plaintext prompt retain supported partial recovery', async () => {
  const w = await createWorkspace()
  const output = join(w.root, 'named-plus-text')
  const promptFile = join(w.root, 'extra-instructions.txt')
  await Bun.write(promptFile, 'Mention the distinction between observation and inference.\n')
  await w.success(['write', 'input/examples/document/harborlight-field-notes.md', '--provider', 'grok=grok-4.7', '--provider', 'openai=gpt-6-luna', '--prompt', 'shortSummary', '--prompt-file', promptFile, '--output-dir', output], 'partial')
  expect((await readManifest(output))!.items[0]!.status).toBe('incomplete')
  const prompt = await Bun.file(join(output, 'prompt.md')).text()
  expect(prompt).toContain('observation and inference')
  await w.success(['resume', output, '--provider', 'openai=gpt-6-luna', '--price'])
  expect(await w.calls()).toHaveLength(2)
  await w.success(['resume', output, '--provider', 'openai=gpt-6-luna'], 'complete')
  expect((await readManifest(output))!.items[0]!.status).toBe('full')
  expect(await Bun.file(join(output, 'prompt.md')).text()).toBe(prompt)
  expect(await w.calls()).toHaveLength(3)
}, 30_000)

test('partial JSON leaf prompt-file recovery rejects replacing its custom schema with a named preset', async () => {
  const w = await createWorkspace()
  const output = join(w.root, 'partial-json-leaf')
  const promptFile = join(w.root, 'custom-leaf.json')
  await Bun.write(promptFile, JSON.stringify({ description: 'Custom harbor observation.', expectedInputTokens: 100, expectedOutputTokens: 50, instruction: 'Describe one observation using the content field.', examples: { json: '{"content":"A beacon lights the harbor."}', markdown: 'A beacon lights the harbor.' } }))
  await w.success(['write', 'input/examples/document/harborlight-field-notes.md', '--provider', 'grok=grok-4.7', '--provider', 'openai=gpt-6-luna', '--prompt-file', promptFile, '--output-dir', output], 'freeform-partial')
  const manifest = await readManifest(output)
  expect(manifest!.items[0]!.status).toBe('incomplete')
  expect(manifest!.items[0]!.providers.every(provider => provider.settings?.local?.['promptFileKind'] === 'leaf')).toBe(true)
  const before = await Bun.file(join(output, 'manifest.json')).text(), calls = await w.calls()
  for (const flags of [['--price'], [], ['--prompt', 'shortSummary', '--price'], ['--prompt', 'shortSummary']]) {
    const result = await w.cli(['resume', output, '--provider', 'openai=gpt-6-luna', ...flags])
    expect(result.code).not.toBe(0)
    expect(result.stdout + result.stderr).toContain('cannot restore the original custom prompt-file schema')
    expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(before)
    expect(await w.calls()).toEqual(calls)
  }
}, 30_000)

test('the guide creates a local structure-only comic manifest whose unrequested stages remain a byte-identical no-op', async () => {
  const w = await createWorkspace()
  const output = join(w.root, 'comic')
  await w.success(['comic', 'draft-scenes', join(w.root, 'comic-inputs/scene.md'), '--only', 'structure', '--characters-root', join(w.root, 'comic-inputs/characters'), '--output-dir', output])
  const manifest = await readManifest(output)
  expect(manifest).toMatchObject({ command: 'comic', scope: 'single' })
  expect(manifest!.items).toHaveLength(1)
  const structured = await Bun.file(join(output, 'metadata/structured-script.json')).json()
  expect(structured.sourceSegments.length).toBeGreaterThan(0)
  const before = await Bun.file(join(output, 'manifest.json')).text()
  const source = await Bun.file(join(output, 'metadata/structured-script.json')).text()
  const result = await w.success(['resume', output, '--price'], undefined, false)
  expect(result.data.comicPlans).toEqual([expect.objectContaining({ ready: true })])
  expect(result.data.comicPlans[0].stages.map((stage: { action: string }) => stage.action)).toEqual(['not-requested', 'not-requested', 'not-requested'])
  expect(result.data.totalEstimatedCost).toBe(0)
  expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(before)
  await w.success(['resume', output], undefined, false)
  expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(before)
  expect(await Bun.file(join(output, 'metadata/structured-script.json')).text()).toBe(source)
  const override = await w.cli(['resume', output, '--provider', 'openai=gpt-6.1-sol'], undefined, false)
  expect(override.code).not.toBe(0)
  expect(override.stdout + override.stderr).toContain('restores recorded options')
  expect(await w.calls()).toEqual([])
  // Re-running preparation refuses the occupied workspace instead of replacing inputs.
  const retry = Bun.spawn([process.execPath, '--no-env-file', w.program], { env: childEnv({ set: { HOME: w.temporary } }), stdout: 'pipe', stderr: 'pipe' })
  const error = await new Response(retry.stderr).text()
  expect(await retry.exited).not.toBe(0)
  expect(error).toContain('EEXIST')
  expect(await Bun.file(join(output, 'manifest.json')).text()).toBe(before)
}, 30_000)
