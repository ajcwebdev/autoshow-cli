import { afterEach, describe, expect, test } from 'bun:test'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveSingleTargetRouteDecision } from '~/cli/commands/sources/download/download-targets/single/single-target-routing'
import { resolveXSpaceDownloadTarget } from '~/cli/commands/sources/download/download-targets/single/x-space-runner'
import { classifyInputFamily, classifyUrlInput } from '~/cli/commands/sources/metadata/metadata-targets/metadata-input-classifier'
import { isLikelyInputListFile } from '~/cli/commands/sources/metadata/metadata-targets/metadata-input-collection'
import { resolveInputRoutingForCommand } from '~/cli/commands/sources/metadata/metadata-targets/metadata-input-routing'
import { planProcessTargetBatchExecution, resolveProcessTargetPlan } from '~/cli/commands/sources/metadata/metadata-targets/metadata-process-target-plan'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { SingleTargetInputCategory, SingleTargetRoute } from '~/types'
import { makeTempDir } from '../../../test-utils/temp-dirs'

const tempDirs: string[] = []

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
      }
    }> = [
      { category: 'url_streaming', expected: { metadata: 'media', download: 'media', extract: 'media' } },
      { category: 'url_direct_media', expected: { metadata: 'media', download: 'media', extract: 'media' } },
      { category: 'url_direct_document', expected: { metadata: 'temporary-document', download: 'temporary-document', extract: 'temporary-document' } },
      { category: 'url_html_article', expected: { metadata: 'article', download: 'article', extract: 'article' } },
      { category: 'url_x_space', expected: { metadata: 'x-space', download: 'x-space', extract: 'x-space' } },
      { category: 'local_html_article', expected: { metadata: 'article', download: 'article', extract: 'article' } },
      { category: 'local_document', expected: { metadata: 'document', download: 'document', extract: 'document' } },
      { category: 'local_media', expected: { metadata: 'media', download: 'media', extract: 'media' } },
      { category: 'local_unsupported', expected: { metadata: 'media', download: 'media', extract: 'error' } },
      { category: 'x_space_identifier', expected: { metadata: 'x-space', download: 'x-space', extract: 'x-space' } },
      { category: 'missing', expected: { metadata: 'error', download: 'error', extract: 'error' } }
    ]

    for (const { category, expected } of cases) {
      for (const command of ['metadata', 'download', 'extract'] as const) {
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

  test('single-target routing preserves passthrough usage failures', () => {
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

  test('extract input routing accepts the extract-routed source families', async () => {
    const dir = await makeTempDir('autoshow-validation-extract-routing-')
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
      const routing = await resolveInputRoutingForCommand('extract', item.input)
      expect(routing.supported).toBe(true)
      expect(routing.family).toBe(item.family)
      expect(routing.extractRoute).toBe(item.extractRoute)
    }
  })

  test('extract directory planning preserves input families and extract routes', async () => {
    const dir = await makeTempDir('autoshow-validation-extract-dir-')
    tempDirs.push(dir)
    await writeFile(join(dir, 'clip.mp3'), '')
    await writeFile(join(dir, 'scan.png'), '')
    await writeFile(join(dir, 'article.html'), '<article><p>Body</p></article>')

    const opts = buildOptsFromFlags({})
    const plan = await resolveProcessTargetPlan('extract', dir, opts)
    const batchPlan = await planProcessTargetBatchExecution(plan, 'extract', opts, dir)

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
    const dir = await makeTempDir('autoshow-validation-list-detect-')
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

  test('local ACSM files are classified and routed as unsupported', async () => {
    const dir = await makeTempDir('autoshow-validation-acsm-')
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
})
