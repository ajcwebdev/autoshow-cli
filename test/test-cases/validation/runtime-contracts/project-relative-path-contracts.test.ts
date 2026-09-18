import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as v from 'valibot'
import { isProjectRelativeSourceRef, PROJECT_ROOT, stripProjectRoot, toLocalSourceRef, toProjectRelativeArg, toProjectRelativePath } from '~/utils/project-root'
import { VideoMetadataSchema } from '~/types'
import { serializeDiagnosticError } from '~/utils/error-handler'
import { toProviderResumeSource } from '~/cli/commands/setup-and-utilities/resume/provider-batch-resume'
import { buildTextInputPrompt } from '~/cli/commands/text/write/text-input-utils'
import { buildPipelineItemRecord } from '~/cli/commands/sources/metadata/metadata-batch/pipeline-item-record-builder'
import { extractLocalFileMetadata } from '~/cli/commands/sources/download/download-audio/metadata-utils'
import { findMachineSpecificPaths, findRepositoryStructureViolations } from '~/tools/repository-structure-check'
import { toPortableText, writePortableFileSync } from '../../../../.codex/skills/consensus/scripts/shared/portable_paths'
import { withLocalTestDir, withTempDir } from '../../../test-utils/temp-dirs'

const OUTSIDE_PATH = '/var/autoshow-outside-project/audio.mp3'
// Built at runtime so this file never contains a literal checkout path that the structure check rejects.
const checkoutPath = (...segments: string[]): string => ['', ...segments].join('/')
const insideProject = (path: string): string => join(PROJECT_ROOT, path)

test('project paths persist relative to the project root and outside paths stay absolute', () => {
  expect(toProjectRelativePath(insideProject('docs/benchmarks/run/audio.mp3'))).toBe('docs/benchmarks/run/audio.mp3')
  expect(toProjectRelativePath(PROJECT_ROOT)).toBe('.')
  expect(toProjectRelativePath(OUTSIDE_PATH)).toBe(OUTSIDE_PATH)
  expect(toProjectRelativeArg(insideProject('runtime/bin/whisperfile/whisper-tiny.llamafile'))).toBe('runtime/bin/whisperfile/whisper-tiny.llamafile')
  expect(toProjectRelativeArg('-of')).toBe('-of')
  expect(toProjectRelativeArg(OUTSIDE_PATH)).toBe(OUTSIDE_PATH)
})

test('local source refs are project-relative inside the project and file URLs outside it', () => {
  expect(toLocalSourceRef(insideProject('input/audio/sample.mp3'))).toBe('input/audio/sample.mp3')
  expect(toLocalSourceRef(OUTSIDE_PATH)).toBe(`file://${OUTSIDE_PATH}`)
  expect(isProjectRelativeSourceRef('input/audio/sample.mp3')).toBe(true)
  for (const rejected of ['', '  ', '/abs/audio.mp3', 'file:///abs/audio.mp3', 'https://example.com/a.mp3']) {
    expect(isProjectRelativeSourceRef(rejected)).toBe(false)
  }
})

test('step1 metadata accepts URLs and project-relative sources and rejects absolute bare paths', () => {
  const metadata = (url: string) => ({ title: 't', duration: 'Unknown', channel: 'Local', description: '', url })
  expect(v.safeParse(VideoMetadataSchema, metadata('docs/benchmarks/run/audio.mp3')).success).toBe(true)
  expect(v.safeParse(VideoMetadataSchema, metadata('https://example.com/watch?v=1')).success).toBe(true)
  expect(v.safeParse(VideoMetadataSchema, metadata(`file://${OUTSIDE_PATH}`)).success).toBe(true)
  expect(v.safeParse(VideoMetadataSchema, metadata('/abs/audio.mp3')).success).toBe(false)
  expect(v.safeParse(VideoMetadataSchema, metadata('')).success).toBe(false)
})

test('resume resolves project-relative, legacy file URL, and remote sources', () => {
  expect(toProviderResumeSource('docs/benchmarks/run/audio.mp3')).toEqual({ filePath: insideProject('docs/benchmarks/run/audio.mp3') })
  expect(toProviderResumeSource(`file://${OUTSIDE_PATH}`)).toEqual({ filePath: OUTSIDE_PATH })
  expect(toProviderResumeSource('https://example.com/a.mp3')).toEqual({ url: 'https://example.com/a.mp3' })
})

test('local media metadata and batch records store project-relative source refs', async () => {
  await withLocalTestDir('project-relative-metadata', async (dir) => {
    const filePath = join(dir, 'not-really-audio.mp3')
    await Bun.write(filePath, 'not audio')
    const metadata = await extractLocalFileMetadata(filePath)
    expect(metadata.url).toBe(toProjectRelativePath(filePath))
    expect(metadata.url).not.toContain(PROJECT_ROOT)
    expect(buildPipelineItemRecord(filePath)['url']).toBe(toProjectRelativePath(filePath))
  })
  expect(buildPipelineItemRecord(OUTSIDE_PATH)['url']).toBe(`file://${OUTSIDE_PATH}`)
})

test('write prompt front matter records a project-relative sourcePath', () => {
  const prompt = buildTextInputPrompt('body', { title: 'Episode', sourcePath: insideProject('input/text/episode.md'), instruction: 'Summarize.' })
  expect(prompt).toContain('sourcePath: "input/text/episode.md"')
  expect(prompt).not.toContain(PROJECT_ROOT)
})

test('serialized diagnostic stacks drop the project root', () => {
  const error = new Error('timed out')
  error.stack = `Error: timed out\n    at fetch (${insideProject('src/utils/rest-client.ts')}:87:28)\n    at run (file://${insideProject('src/cli/run.ts')}:1:1)`
  const serialized = serializeDiagnosticError(error)
  expect(serialized['stack']).toBe('Error: timed out\n    at fetch (src/utils/rest-client.ts:87:28)\n    at run (src/cli/run.ts:1:1)')
  expect(stripProjectRoot(`${OUTSIDE_PATH}:1:1`)).toBe(`${OUTSIDE_PATH}:1:1`)
})

test('consensus report text rewrites checkout paths but keeps sibling and outside paths', async () => {
  const markdown = [
    `- Run directory: \`${insideProject('docs/benchmarks/ocr/01-book')}\``,
    `- Root directory: \`${PROJECT_ROOT}\``,
    `url: "file://${insideProject('docs/a.mp3')}"`,
    `sibling: ${PROJECT_ROOT}-fork/docs`,
    `outside: ${OUTSIDE_PATH}`,
  ].join('\n')
  expect(toPortableText(markdown)).toBe([
    '- Run directory: `docs/benchmarks/ocr/01-book`',
    '- Root directory: `.`',
    'url: "docs/a.mp3"',
    `sibling: ${PROJECT_ROOT}-fork/docs`,
    `outside: ${OUTSIDE_PATH}`,
  ].join('\n'))
  const json = JSON.stringify({ runDir: insideProject('docs/benchmarks/url/run'), rootDir: PROJECT_ROOT })
  expect(JSON.parse(toPortableText(json))).toEqual({ runDir: 'docs/benchmarks/url/run', rootDir: '.' })
  await withTempDir('autoshow-portable-report-', async (dir) => {
    const reportPath = join(dir, 'provider-comparison-report.md')
    writePortableFileSync(reportPath, markdown)
    expect(readFileSync(reportPath, 'utf8')).not.toContain(`${PROJECT_ROOT}/`)
  })
})

test('structure check rejects committed checkout paths and accepts portable artifacts', () => {
  const checkoutRoots = [checkoutPath('Users', 'someone', 'c', 'autoshow-cli'), checkoutPath('home', 'runner', 'work', 'autoshow-cli', 'autoshow-cli')]
  for (const root of checkoutRoots) {
    expect(findMachineSpecificPaths('report.md', `- Run directory: \`${root}/docs/benchmarks/x\``)).toHaveLength(1)
    expect(findMachineSpecificPaths('error.json', `"stack": "at f (${root}/src/a.ts:1:2)"`)).toHaveLength(1)
    expect(findMachineSpecificPaths('prompt.md', `url: "file://${root}/docs/a.mp3"`)).toHaveLength(1)
    expect(findMachineSpecificPaths('report.md', `Root: \`${root}\``)).toHaveLength(1)
  }
  const portable = [
    '- Run directory: `docs/benchmarks/x`',
    '"stack": "at f (src/a.ts:1:2)"',
    "inputPath: '/Users/editor/show/input'",
    'fork: /Users/someone/c/autoshow-cli-fork/docs',
  ].join('\n')
  expect(findMachineSpecificPaths('report.md', portable)).toEqual([])
  const violations = findRepositoryStructureViolations(['src'], ['src/a.ts'], new Map([['docs/report.md', `line one\nsee ${checkoutPath('Users', 'someone', 'autoshow-cli')}/docs/x`]]))
  expect(violations).toEqual([`Machine-specific checkout path in docs/report.md:2: ${checkoutPath('Users', 'someone', 'autoshow-cli')}. Store project paths relative to the repository root.`])
})
