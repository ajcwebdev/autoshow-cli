import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  Step3Metadata,
  StructuredRunResult
} from '~/types'
import { writeShowNoteArtifacts } from '~/cli/commands/process-steps/step-3-write/show-note-artifacts'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { buildExpectedFilesList } from '~/cli/commands/process-steps/step-1-download/download-targets/expected-output'
import { renderToPlainText } from '~/cli/commands/process-steps/step-3-write/structured-output/renderers'
import { buildStructuredValidationFailureEnvelope } from '~/cli/commands/process-steps/step-3-write/structured-output/validation-failure'

const buildStep3Metadata = (overrides: Partial<Step3Metadata> = {}): Step3Metadata => ({
  llmService: 'openai',
  llmModel: 'gpt-5.5',
  processingTime: 1,
  inputTokenCount: 1,
  outputTokenCount: 1,
  outputFileName: 'text.json',
  outputFormat: 'json',
  structuredMode: 'native',
  structuredPresetNames: ['shortSummary'],
  ...overrides
})

const buildResult = (overrides: Partial<Step3Metadata> = {}, renderedText = '## Summary\n\nRendered JSON markdown'): StructuredRunResult => ({
  metadata: buildStep3Metadata(overrides),
  renderedText,
  parsedJson: {}
})

const writePrompt = async (outputDir: string): Promise<void> => {
  await writeFile(join(outputDir, 'prompt.md'), [
    '---',
    'title: "Show Note Source"',
    'slug: "show-note-source"',
    '---',
    '',
    'Prompt instructions must not leak into show notes.',
    '',
    'Transcript:',
    '[00:00:00] Prompt transcript copy'
  ].join('\n'))
}

test('show notes preserve prompt frontmatter and include rendered output plus source text', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    const artifacts = await writeShowNoteArtifacts({
      outputDir,
      results: [buildResult()],
      sourceText: 'Full source text\nwith all details.'
    })

    expect(artifacts.internalArtifacts).toEqual({ showNote: 'show-note.md' })
    const showNote = await Bun.file(join(outputDir, 'show-note.md')).text()

    expect(showNote.startsWith('---\ntitle: "Show Note Source"\nslug: "show-note-source"\n---\n\n')).toBe(true)
    expect(showNote).toContain('## Summary\n\nRendered JSON markdown')
    expect(showNote).toContain('## Source\n\n```text\nFull source text\nwith all details.\n```')
    expect(showNote).not.toContain('Prompt instructions must not leak into show notes.')
    expect(showNote).not.toContain('[00:00:00] Prompt transcript copy')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('show notes preserve marked structured validation failures', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-validation-failure-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)
    const failure = buildStructuredValidationFailureEnvelope('unparseable provider output', 'Response was not valid JSON')

    await writeShowNoteArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata({ validationFailed: true }),
        renderedText: renderToPlainText(failure, ['content']),
        parsedJson: failure
      }],
      sourceText: 'source'
    })

    const showNote = await Bun.file(join(outputDir, 'show-note.md')).text()
    expect(showNote).toContain('## Structured Validation Error\n\nResponse was not valid JSON')
    expect(showNote).toContain('## Raw Output\n\n```text\nunparseable provider output\n```')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('show notes preserve rendered song lyric text instead of generic JSON fields', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-song-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    await writeShowNoteArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata({
          structuredPresetNames: ['rapSongLongLyrics']
        }),
        renderedText: '01. Track One (ChatGPT)\n\nVerse 1\n\nLine one\nLine two\n\nChorus\n\nHook line',
        parsedJson: {
          title: 'Track One',
          verse1: ['Line one', 'Line two'],
          chorus1: ['Hook line']
        }
      }],
      sourceText: 'source'
    })

    const showNote = await Bun.file(join(outputDir, 'show-note.md')).text()
    expect(showNote).toContain('01. Track One (ChatGPT)\n\nVerse 1\n\nLine one\nLine two')
    expect(showNote).not.toContain('## Verse1')
    expect(showNote).not.toContain('- Line one')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('show notes flatten default summary JSON into publication markdown', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-default-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    await writeShowNoteArtifacts({
      outputDir,
      results: [{
        metadata: buildStep3Metadata(),
        renderedText: '## Short Summary\n\n## Episode Description\n\nBad wrapper',
        parsedJson: {
          shortSummary: {
            episodeDescription: 'A concise episode description.'
          },
          longSummary: {
            episodeSummary: 'A focused summary paragraph.'
          },
          longChapters: {
            chapters: [{
              timestamp: '00:00:00',
              title: 'Introduction and Overview',
              description: 'A first paragraph.\n\nA second paragraph.'
            }]
          }
        }
      }],
      sourceText: 'source'
    })

    const showNote = await Bun.file(join(outputDir, 'show-note.md')).text()
    expect(showNote).toContain([
      '## Episode Description',
      '',
      'A concise episode description.',
      '',
      '## Episode Summary',
      '',
      'A focused summary paragraph.',
      '',
      '## Chapters',
      '',
      '### 00:00:00 - Introduction and Overview',
      '',
      'A first paragraph.',
      '',
      'A second paragraph.'
    ].join('\n'))
    expect(showNote).not.toContain('## Short Summary')
    expect(showNote).not.toContain('## Long Summary')
    expect(showNote).not.toContain('#### Item 1')
    expect(showNote).not.toContain('### Timestamp')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('show notes mirror single and multi-output JSON naming', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-show-note-names-'))
  try {
    const outputDir = join(tempDir, 'out')
    await mkdir(outputDir, { recursive: true })
    await writePrompt(outputDir)

    const single = await writeShowNoteArtifacts({
      outputDir,
      results: [buildResult({ outputFileName: 'text.json' })],
      sourceText: 'source'
    })
    expect(single.internalArtifacts).toEqual({ showNote: 'show-note.md' })

    const partialMulti = await writeShowNoteArtifacts({
      outputDir,
      results: [buildResult({ outputFileName: 'text-gpt-5.5.json' })],
      sourceText: 'source'
    })
    expect(partialMulti.internalArtifacts).toEqual({ 'showNote-gpt-5.5': 'show-note-gpt-5.5.md' })

    const multi = await writeShowNoteArtifacts({
      outputDir,
      results: [
        buildResult({ llmModel: 'gpt-5.5', outputFileName: 'text-gpt-5.5.json' }, 'first'),
        buildResult({ llmService: 'gemini', llmModel: 'gemini-3.5-flash', outputFileName: 'text-gemini-3.5-flash.json' }, 'second')
      ],
      sourceText: 'source'
    })

    expect(Object.values(multi.internalArtifacts).sort()).toEqual([
      'show-note-gemini-3.5-flash.md',
      'show-note-gpt-5.5.md'
    ])
    expect(await Bun.file(join(outputDir, 'show-note-gpt-5.5.md')).text()).toContain('first')
    expect(await Bun.file(join(outputDir, 'show-note-gemini-3.5-flash.md')).text()).toContain('second')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('expected output planning reports show-note artifacts only when LLM output is expected', async () => {
  const singleTextInput = await buildExpectedFilesList(
    'write',
    buildOptsFromFlags(false, { 'text-input': true, openai: 'gpt-5.4-mini' })
  )
  expect(singleTextInput).toContain('text.json')
  expect(singleTextInput).toContain('show-note.md')

  const multiTextInput = await buildExpectedFilesList(
    'write',
    buildOptsFromFlags(false, { 'text-input': true, 'all-llm': true })
  )
  expect(multiTextInput).toContain('text-<model>.json')
  expect(multiTextInput).toContain('show-note-<model>.md')
  expect(multiTextInput).not.toContain('show-note.md')

  const skipLlmMediaWrite = await buildExpectedFilesList(
    'write',
    buildOptsFromFlags(true, {})
  )
  expect(skipLlmMediaWrite).not.toContain('text.json')
  expect(skipLlmMediaWrite).not.toContain('show-note.md')
})
