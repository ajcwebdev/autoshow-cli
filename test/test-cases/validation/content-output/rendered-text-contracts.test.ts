import { expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Step3Metadata } from '~/types'
import {
  formatRenderedLlmLabel,
  resolveTextInputSongTitle,
  writeRenderedTextArtifacts
} from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { renderToPlainText } from '~/cli/commands/process-steps/step-3-write/structured-output/renderers'
import { buildStructuredValidationFailureEnvelope } from '~/cli/commands/process-steps/step-3-write/structured-output/validation-failure'
import { makeTempDir } from '../../../test-utils/temp-dirs'
import { buildStep3Metadata as buildSharedStep3Metadata } from './shared'

const LLM_FIXTURE = { llmService: 'gemini' as const, llmModel: 'gemini-3.1-pro-preview', structuredPresetNames: ['standardSongLyrics'] }

const buildStep3Metadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata =>
  buildSharedStep3Metadata(LLM_FIXTURE, overrides)

test('rendered text track headers use model display names', () => {
  expect(formatRenderedLlmLabel({
    llmService: 'gemini',
    llmModel: 'gemini-3.1-pro-preview'
  })).toBe('Gemini 3.1 Pro')

  expect(formatRenderedLlmLabel({
    llmService: 'grok',
    llmModel: 'grok-4.3'
  })).toBe('Grok 4.3')
})

test('text input song titles use tracks.md before falling back to the filename stem', async () => {
  const tempDir = await makeTempDir('autoshow-title-')
  try {
    const tracksPath = join(tempDir, 'tracks.md')
    const alphaPath = join(tempDir, 'chapter-alpha.txt')
    const betaPath = join(tempDir, 'chapter-beta.txt')
    await writeFile(tracksPath, '1. Track One\n2. Track Two\n')
    await writeFile(alphaPath, 'alpha source\n')
    await writeFile(betaPath, 'beta source\n')

    expect(await resolveTextInputSongTitle(join(tempDir, '01-track-one.md'), tracksPath)).toBe('Track One')
    expect(await resolveTextInputSongTitle(alphaPath, tracksPath)).toBe('Track One')
    expect(await resolveTextInputSongTitle(betaPath, tracksPath)).toBe('Track Two')
    expect(await resolveTextInputSongTitle(join(tempDir, '03-bonus-track.md'), tracksPath)).toBe('03-bonus-track')
    expect(await resolveTextInputSongTitle(join(tempDir, '04-fallback.md'), undefined)).toBe('04-fallback')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('song lyric renderer assembles sections with headers', () => {
  const rendered = renderToPlainText({
    title: 'Track One',
    verse1: 'Line one',
    chorus: 'Hook line',
    verse2: 'Line two',
    bridge: 'Bridge line',
    finalChorus: 'Final hook'
  }, ['rockSong'])

  expect(rendered).toBe(
    '# Track One\n\n' +
    'Verse 1\n\nLine one\n\n' +
    'Chorus\n\nHook line\n\n' +
    'Verse 2\n\nLine two\n\n' +
    'Bridge\n\nBridge line\n\n' +
    'Chorus\n\nFinal hook'
  )
})

test('song lyric renderer assembles extended rap sections from intro through final chorus', () => {
  const rendered = renderToPlainText({
    title: 'Track One',
    intro: ['Intro line one', 'Intro line two'],
    verse1: ['Verse one line'],
    chorus1: ['Hook line'],
    verse2: ['Verse two line'],
    chorus2: ['Hook line again'],
    verse3: ['Verse three line'],
    bridge: ['Bridge line'],
    chorus3: ['Final hook']
  }, ['rapSongChapter'])

  expect(rendered).toBe(
    '# Track One\n\n' +
    'Intro\n\nIntro line one\nIntro line two\n\n' +
    'Verse 1\n\nVerse one line\n\n' +
    'Chorus\n\nHook line\n\n' +
    'Verse 2\n\nVerse two line\n\n' +
    'Chorus\n\nHook line again\n\n' +
    'Verse 3\n\nVerse three line\n\n' +
    'Bridge\n\nBridge line\n\n' +
    'Chorus\n\nFinal hook'
  )
})

test('structured validation failures render as marked diagnostics with fenced raw output', () => {
  const rendered = renderToPlainText(buildStructuredValidationFailureEnvelope(
    'not json\n```\nstill raw',
    'Response was not valid JSON'
  ), ['content'])

  expect(rendered).toBe([
    '## Structured Validation Error',
    '',
    'Response was not valid JSON',
    '',
    '## Raw Output',
    '',
    '````text',
    'not json',
    '```',
    'still raw',
    '````'
  ].join('\n'))
})

test('rendered text track headers replace duplicate song title headings', async () => {
  const tempDir = await makeTempDir('autoshow-render-')
  try {
    const outputDir = join(tempDir, 'out')
    const tracksPath = join(tempDir, 'tracks.md')
    const sourcePath = join(tempDir, '01-track-one.md')
    await mkdir(outputDir, { recursive: true })
    await writeFile(tracksPath, '1. Track One\n')
    await writeFile(sourcePath, 'source text\n')

    const songData = {
      title: 'Track One',
      verse1: 'Line one',
      chorus: 'Hook line',
      verse2: 'Line two',
      bridge: 'Bridge line',
      finalChorus: 'Final hook'
    }
    const renderedText = renderToPlainText(songData, ['rockSong'])
    const artifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata(),
        renderedText,
        parsedJson: songData
      }],
      writeInternal: true,
      sourcePath,
      trackListPath: tracksPath
    })

    const renderedFileName = artifacts.internalArtifacts['rendered']
    expect(renderedFileName).toBe('text.md')
    if (renderedFileName) {
      const rendered = await Bun.file(join(outputDir, renderedFileName)).text()
      expect(rendered).toContain('01. Track One (Gemini 3.1 Pro)')
      expect(rendered).toContain('Verse 1\n\nLine one')
      expect(rendered).toContain('Chorus\n\nHook line')
      expect(rendered).not.toContain('# Track One')
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('rendered text track headers use sorted sibling order for unnumbered inputs', async () => {
  const tempDir = await makeTempDir('autoshow-render-sequential-')
  try {
    const outputDir = join(tempDir, 'out')
    const tracksPath = join(tempDir, 'tracks.md')
    const alphaPath = join(tempDir, 'chapter-alpha.txt')
    const betaPath = join(tempDir, 'chapter-beta.txt')
    await mkdir(outputDir, { recursive: true })
    await writeFile(tracksPath, '1. Track One\n2. Track Two\n')
    await writeFile(alphaPath, 'alpha source\n')
    await writeFile(betaPath, 'beta source\n')

    const songData = {
      title: 'Track Two',
      verse1: 'Line one',
      chorus: 'Hook line',
      verse2: 'Line two',
      bridge: 'Bridge line',
      finalChorus: 'Final hook'
    }
    const renderedText = renderToPlainText(songData, ['rockSong'])
    const artifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata(),
        renderedText,
        parsedJson: songData
      }],
      writeInternal: true,
      sourcePath: betaPath,
      trackListPath: tracksPath
    })

    const renderedFileName = artifacts.internalArtifacts['rendered']
    expect(renderedFileName).toBe('text.md')
    if (renderedFileName) {
      const rendered = await Bun.file(join(outputDir, renderedFileName)).text()
      expect(rendered).toContain('02. Track Two (Gemini 3.1 Pro)')
      expect(rendered).toContain('Verse 1\n\nLine one')
      expect(rendered).not.toContain('# Track Two')
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('external rendered text filenames use provider aliases only for single-target writes', async () => {
  const tempDir = await makeTempDir('autoshow-render-names-')
  try {
    const outputDir = join(tempDir, 'out')
    const externalDir = join(tempDir, 'lyrics')
    await mkdir(outputDir, { recursive: true })

    const openaiMetadata = buildStep3Metadata({
      llmService: 'openai',
      llmModel: 'gpt-5.5'
    })
    const qwenMetadata = buildStep3Metadata({
      llmService: 'gemini',
      llmModel: 'gemini-3.5-flash'
    })

    const singleArtifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [{
        metadata: openaiMetadata,
        renderedText: 'single',
        parsedJson: {}
      }],
      writeInternal: false,
      externalDir,
      externalBaseName: '01-track-one'
    })

    expect(singleArtifacts.externalFiles.map((file) => file.split('/').pop())).toEqual([
      '01-track-one-chatgpt.md'
    ])

    const multiArtifacts = await writeRenderedTextArtifacts({
      outputDir,
      results: [
        {
          metadata: openaiMetadata,
          renderedText: 'gemma',
          parsedJson: {}
        },
        {
          metadata: qwenMetadata,
          renderedText: 'qwen',
          parsedJson: {}
        }
      ],
      writeInternal: false,
      externalDir,
      externalBaseName: '01-track-one'
    })

    expect(multiArtifacts.externalFiles.map((file) => file.split('/').pop()).sort()).toEqual([
      '01-track-one-gemini-3.5-flash.md',
      '01-track-one-gpt-5.5.md'
    ])
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
