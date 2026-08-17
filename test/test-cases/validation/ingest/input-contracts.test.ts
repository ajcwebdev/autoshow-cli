import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planProcessTargetBatchExecution, resolveProcessTargetPlan } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-process-target-plan'
import { classifyInputFamily, classifyUrlInput } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import { resolveXSpaceDownloadTarget } from '~/cli/commands/process-steps/step-1-download/download-targets/single/x-space-runner'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { LOCAL_EXAMPLE_AUDIO_PATH, runCommand } from '../../../test-utils/test-helpers'

const tempDirs: string[] = []

const createUnsupportedInput = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-input-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'unknown.payload')
  await writeFile(filePath, 'plain text without a supported extension')
  return filePath
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('input classification contracts', () => {
  test('media URLs are classified as media input', async () => {
    await expect(classifyUrlInput('https://example.com/audio.mp3?token=redacted')).resolves.toBe('url_direct_media')
    await expect(classifyInputFamily('https://example.com/audio.mp3?token=redacted')).resolves.toBe('media')
  })

  test('document and HTML URLs are classified as document-family inputs', async () => {
    await expect(classifyUrlInput('https://example.com/files/report.pdf')).resolves.toBe('url_direct_document')
    await expect(classifyInputFamily('https://example.com/files/report.pdf')).resolves.toBe('document')
    await expect(classifyInputFamily('https://example.com/articles/post.html')).resolves.toBe('html_article')
  })

  test('X Space and post URLs are classified as X Space inputs', async () => {
    await expect(classifyUrlInput('https://x.com/i/spaces/1DXxyRYNejbKM')).resolves.toBe('url_x_space')
    await expect(classifyInputFamily('https://x.com/i/spaces/1DXxyRYNejbKM')).resolves.toBe('x_space')
    await expect(classifyUrlInput('https://x.com/example/status/1234567890123456789')).resolves.toBe('url_x_space')
    await expect(classifyInputFamily('https://x.com/example/status/1234567890123456789')).resolves.toBe('x_space')
    await expect(classifyInputFamily('1DXxyRYNejbKM')).resolves.toBe('x_space')
  })

  test('write input routing accepts the extract-routed source families', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-write-routing-'))
    tempDirs.push(dir)
    const mediaPath = join(dir, 'clip.mp3')
    const imagePath = join(dir, 'page.png')
    const htmlPath = join(dir, 'article.html')
    await writeFile(mediaPath, '')
    await writeFile(imagePath, '')
    await writeFile(htmlPath, '<article><h1>Local article</h1><p>Body</p></article>')

    const cases = [
      { input: mediaPath, family: 'media', extractRoute: 'media' },
      { input: imagePath, family: 'document', extractRoute: 'document' },
      { input: 'https://example.com/files/report.pdf', family: 'document', extractRoute: 'document' },
      { input: htmlPath, family: 'html_article', extractRoute: 'article' },
      { input: 'https://example.com/articles/post.html', family: 'html_article', extractRoute: 'article' },
      { input: 'https://x.com/i/spaces/1DXxyRYNejbKM', family: 'x_space', extractRoute: 'x-space' },
      { input: 'https://x.com/example/status/1234567890123456789', family: 'x_space', extractRoute: 'x-space' },
      { input: '1DXxyRYNejbKM', family: 'x_space', extractRoute: 'x-space' }
    ] as const

    for (const item of cases) {
      const routing = await resolveInputRoutingForCommand('write', item.input)
      expect(routing.supported).toBe(true)
      expect(routing.family).toBe(item.family)
      expect(routing.extractRoute).toBe(item.extractRoute)
    }
  })

  test('write directory planning preserves input families and extract routes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-write-dir-'))
    tempDirs.push(dir)
    await writeFile(join(dir, 'clip.mp3'), '')
    await writeFile(join(dir, 'scan.png'), '')
    await writeFile(join(dir, 'article.html'), '<article><p>Body</p></article>')

    const opts = buildOptsFromFlags(false, {})
    const plan = await resolveProcessTargetPlan('write', dir, opts)
    const batchPlan = await planProcessTargetBatchExecution(plan, 'write', opts, dir)

    expect(batchPlan?.plannedInputs.map((item) => item.inputFamily).sort()).toEqual([
      'document',
      'html_article',
      'media'
    ])
    expect(batchPlan?.plannedInputs.map((item) => item.extractRoute).sort()).toEqual([
      'article',
      'document',
      'media'
    ])
  })

  test('X Space download resolver canonicalizes direct Space targets locally', async () => {
    await expect(resolveXSpaceDownloadTarget('https://x.com/i/spaces/1DXxyRYNejbKM')).resolves.toBe('https://x.com/i/spaces/1DXxyRYNejbKM')
    await expect(resolveXSpaceDownloadTarget('1DXxyRYNejbKM')).resolves.toBe('https://x.com/i/spaces/1DXxyRYNejbKM')
  })

  test('X Space metadata uses the X lookup path instead of unsupported input rejection', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'metadata',
      'https://x.com/i/spaces/1DXxyRYNejbKM'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('X_BEARER_TOKEN environment variable is required for X/Twitter Space metadata')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('unsupported')
  })

  test('X post downloads use the X lookup path instead of unsupported input rejection', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'download',
      'https://x.com/example/status/1234567890123456789'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('X_BEARER_TOKEN environment variable is required for X/Twitter Space download')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('unsupported')
  })

  test('X Space write uses the X extraction path instead of unsupported input rejection', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      'https://x.com/i/spaces/1DXxyRYNejbKM'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('X_BEARER_TOKEN environment variable is required for X/Twitter Space extraction')
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('unsupported')
  })

  test('write URL-list pricing plans article and X Space entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-write-list-'))
    tempDirs.push(dir)
    const listPath = join(dir, 'inputs.md')
    await writeFile(listPath, [
      'https://example.com/articles/story.html',
      '1DXxyRYNejbKM'
    ].join('\n'))

    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      listPath,
      '--batch-limit',
      'all',
      '--price'
    ], { env: { X_BEARER_TOKEN: '' } })

    expect(result.exitCode).toBe(0)
    const output = `${result.stdout}\n${result.stderr}`
    expect(output).toContain('Suite Price Estimate')
    expect(output).toContain('Suite Cost Summary')
    expect(output).not.toContain('unsupported')
  })

  test('unsupported input types produce a usage error message', async () => {
    const inputPath = await createUnsupportedInput()
    const result = await runCommand(['src/cli/create-cli.ts', 'extract', inputPath, '--price'])

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain(`Could not classify extract input "${inputPath}"`)
  })

  test('local ACSM files are classified and routed as unsupported', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-acsm-'))
    tempDirs.push(dir)
    const inputPath = join(dir, 'retired.acsm')
    await writeFile(inputPath, '<adept:fulfillmentToken />')

    await expect(classifyInputFamily(inputPath)).resolves.toBe('unsupported')
    await expect(resolveInputRoutingForCommand('extract', inputPath)).resolves.toMatchObject({
      family: 'unsupported',
      step2Route: 'unsupported',
      supported: false
    })
  })

  test('write rejects multiple step-2 providers for one routed media input', async () => {
    const result = await runCommand([
      'src/cli/create-cli.ts',
      'write',
      LOCAL_EXAMPLE_AUDIO_PATH,
      '--stt',
      'whisper=tiny',
      '--stt',
      'assemblyai=universal-3-5-pro',
      '--price'
    ])

    expect(result.exitCode).toBe(2)
    expect(`${result.stdout}\n${result.stderr}`).toContain('write accepts at most one STT provider')
  })
})
