import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { isLikelyInputListFile } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-collection'
import { planProcessTargetBatchExecution, resolveProcessTargetPlan } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-process-target-plan'
import { classifyInputFamily, classifyUrlInput } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { resolveInputRoutingForCommand } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-routing'
import {
  resolveSingleTargetRouteDecision,
  type SingleTargetInputCategory,
  type SingleTargetRoute
} from '~/cli/commands/process-steps/step-1-download/download-targets/single/single-target-routing'
import { withTemporaryDirectDocument } from '~/cli/commands/process-steps/step-1-download/download-targets/single/temporary-direct-document'
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
  test('single-target routing covers the command-by-input matrix at one boundary', () => {
    const cases: Array<{
      category: SingleTargetInputCategory
      expected: {
        metadata: SingleTargetRoute['action'] | 'error'
        download: SingleTargetRoute['action'] | 'error'
        extract: SingleTargetRoute['action'] | 'error'
        write: SingleTargetRoute['action'] | 'error'
      }
    }> = [
      { category: 'url_streaming', expected: { metadata: 'media', download: 'media', extract: 'media', write: 'media' } },
      { category: 'url_direct_media', expected: { metadata: 'media', download: 'media', extract: 'media', write: 'media' } },
      { category: 'url_direct_document', expected: { metadata: 'temporary-document', download: 'temporary-document', extract: 'temporary-document', write: 'temporary-document' } },
      { category: 'url_html_article', expected: { metadata: 'article', download: 'article', extract: 'article', write: 'article' } },
      { category: 'url_x_space', expected: { metadata: 'x-space', download: 'x-space', extract: 'x-space', write: 'x-space' } },
      { category: 'local_html_article', expected: { metadata: 'article', download: 'article', extract: 'article', write: 'article' } },
      { category: 'local_document', expected: { metadata: 'document', download: 'document', extract: 'document', write: 'document' } },
      { category: 'local_media', expected: { metadata: 'media', download: 'media', extract: 'media', write: 'media' } },
      { category: 'local_unsupported', expected: { metadata: 'media', download: 'media', extract: 'error', write: 'media' } },
      { category: 'x_space_identifier', expected: { metadata: 'x-space', download: 'x-space', extract: 'x-space', write: 'x-space' } },
      { category: 'missing', expected: { metadata: 'error', download: 'error', extract: 'error', write: 'error' } }
    ]

    for (const { category, expected } of cases) {
      for (const command of ['metadata', 'download', 'extract', 'write'] as const) {
        const expectedAction = expected[command]
        if (expectedAction === 'error') {
          const expectedMessage = category === 'local_unsupported'
            ? 'Could not classify extract input "fixture"'
            : `Input does not exist: fixture. Run: bun autoshow help ${command}`
          expect(() => resolveSingleTargetRouteDecision(command, category, 'fixture'))
            .toThrow(expectedMessage)
          continue
        }

        const route = resolveSingleTargetRouteDecision(command, category, 'fixture')
        expect(route.command).toBe(command)
        expect(route.action).toBe(expectedAction)
      }
    }
  })

  test('single-target routing preserves text-input and passthrough usage failures', () => {
    expect(() => resolveSingleTargetRouteDecision(
      'write',
      'url_html_article',
      'https://example.com/article.html',
      { textInput: true }
    )).toThrow('write --text-input only accepts local .md or .txt files or directories')

    expect(() => resolveSingleTargetRouteDecision(
      'write',
      'local_media',
      'clip.mp3',
      { textInput: true }
    )).toThrow('write --text-input only accepts .md or .txt files. Got: clip.mp3')

    expect(() => resolveSingleTargetRouteDecision(
      'download',
      'url_direct_document',
      'https://example.com/report.pdf',
      { downloadPassthrough: true }
    )).toThrow('yt-dlp passthrough args (--) are only supported for media URL downloads. Got: https://example.com/report.pdf')

    expect(resolveSingleTargetRouteDecision(
      'download',
      'x_space_identifier',
      '1DXxyRYNejbKM',
      { downloadPassthrough: true }
    )).toEqual({ command: 'download', action: 'x-space' })
  })

  test('temporary direct-document cleanup runs after successful handling', async () => {
    const events: string[] = []
    const result = await withTemporaryDirectDocument(
      'https://example.com/report.pdf',
      async (filePath) => {
        events.push(`handle:${filePath}`)
        return 'complete'
      },
      async () => ({
        filePath: 'document.pdf',
        cleanup: async () => {
          events.push('cleanup')
        }
      })
    )

    expect(result).toBe('complete')
    expect(events).toEqual(['handle:document.pdf', 'cleanup'])
  })

  test('temporary direct-document cleanup runs after handler failure', async () => {
    const events: string[] = []
    const run = withTemporaryDirectDocument(
      'https://example.com/report.pdf',
      async () => {
        events.push('handle')
        throw new Error('handler failed')
      },
      async () => ({
        filePath: 'document.pdf',
        cleanup: async () => {
          events.push('cleanup')
        }
      })
    )

    await expect(run).rejects.toThrow('handler failed')
    expect(events).toEqual(['handle', 'cleanup'])
  })

  test('single-target coordinator and cleanup boundary remain explicit in the AST', () => {
    const declarations = (path: string): Map<string, ts.Expression> => {
      const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      const found = new Map<string, ts.Expression>()
      const visit = (node: ts.Node): void => {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
          found.set(node.name.text, node.initializer)
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
      return found
    }

    const runner = declarations(resolve(
      process.cwd(),
      'src/cli/commands/process-steps/step-1-download/download-targets/single/single-target-runner.ts'
    ))
    const coordinator = runner.get('processSingleTarget')
    expect(coordinator).toBeDefined()
    const coordinatorText = coordinator?.getText() ?? ''
    expect(coordinatorText.match(/normalizeSingleTargetIntent\(/g)).toHaveLength(1)
    expect(coordinatorText.match(/classifySingleTargetInput\(/g)).toHaveLength(1)
    for (const handler of ['handleMetadataRoute', 'handleDownloadRoute', 'handleExtractRoute', 'handleWriteRoute']) {
      expect(coordinatorText).toContain(`${handler}(`)
    }

    const cleanupDeclarations = declarations(resolve(
      process.cwd(),
      'src/cli/commands/process-steps/step-1-download/download-targets/single/temporary-direct-document.ts'
    ))
    const cleanupBoundary = cleanupDeclarations.get('withTemporaryDirectDocument')
    expect(cleanupBoundary).toBeDefined()
    let tryStatements = 0
    let finallyBlocks = 0
    if (cleanupBoundary) {
      const visit = (node: ts.Node): void => {
        if (ts.isTryStatement(node)) {
          tryStatements += 1
          if (node.finallyBlock) finallyBlocks += 1
        }
        ts.forEachChild(node, visit)
      }
      visit(cleanupBoundary)
    }
    expect(tryStatements).toBe(1)
    expect(finallyBlocks).toBe(1)
  })

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

  test('input list detection separates batch manifests from prose content', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-list-detect-'))
    tempDirs.push(dir)

    const localMedia = join(dir, 'clip.mp3')
    await writeFile(localMedia, '')

    const urlListPath = join(dir, 'urls.md')
    await writeFile(urlListPath, [
      '# batch inputs',
      '- https://example.com/audio.mp3',
      '[Episode](https://example.com/episode.mp4)',
      'clip.mp3'
    ].join('\n'))

    const mostlyValidListPath = join(dir, 'mostly-valid.txt')
    await writeFile(mostlyValidListPath, [
      'https://example.com/audio.mp3',
      'https://example.com/episode.mp4',
      'missing-file.mp3'
    ].join('\n'))

    const xSpaceListPath = join(dir, 'spaces.txt')
    await writeFile(xSpaceListPath, '1DXxyRYNejbKM\n1lPJqBXQNvoxb\n')

    const prosePath = join(dir, 'chapter.txt')
    await writeFile(prosePath, [
      'The warden crossed the yard before the morning bell.',
      'Nobody spoke while the ledger changed hands.',
      'See https://example.com/context for the archived report.',
      'By nightfall the account had already been rewritten.'
    ].join('\n'))

    const poemPath = join(dir, 'poem.txt')
    await writeFile(poemPath, 'fire\nash\nledger\nstone\n')

    const emptyPath = join(dir, 'empty.txt')
    await writeFile(emptyPath, '\n\n')

    await expect(isLikelyInputListFile(urlListPath)).resolves.toBe(true)
    await expect(isLikelyInputListFile(mostlyValidListPath)).resolves.toBe(true)
    await expect(isLikelyInputListFile(xSpaceListPath)).resolves.toBe(true)
    await expect(isLikelyInputListFile(prosePath)).resolves.toBe(false)
    await expect(isLikelyInputListFile(poemPath)).resolves.toBe(false)
    await expect(isLikelyInputListFile(emptyPath)).resolves.toBe(true)
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
