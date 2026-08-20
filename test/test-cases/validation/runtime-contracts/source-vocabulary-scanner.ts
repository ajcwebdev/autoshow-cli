import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Glob } from 'bun'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

export const SOURCE_VOCABULARY_SRC_ROOT = join(PROJECT_ROOT, 'src')
export const SOURCE_VOCABULARY_TEST_ROOT = join(PROJECT_ROOT, 'test')

export const toSourceVocabularyRepoPath = (file: string): string => relative(PROJECT_ROOT, file)

export type SourceVocabularyViolation = { file: string, line: number, text: string }

export const listSourceVocabularyFiles = async (root: string): Promise<string[]> => {
  const files: string[] = []
  for await (const file of new Glob('**/*.ts').scan({ cwd: root, absolute: true })) files.push(file)
  return files.sort()
}

export const stripSourceComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n')

export const scanSourceVocabulary = async (
  pattern: RegExp,
  allowlist: ReadonlySet<string>,
  root: string = SOURCE_VOCABULARY_SRC_ROOT
): Promise<SourceVocabularyViolation[]> => {
  const violations: SourceVocabularyViolation[] = []
  for (const absolute of await listSourceVocabularyFiles(root)) {
    const repoPath = relative(PROJECT_ROOT, absolute)
    if (allowlist.has(repoPath)) continue
    const lines = stripSourceComments(await readFile(absolute, 'utf8')).split('\n')
    lines.forEach((text, index) => {
      if (pattern.test(text)) violations.push({ file: repoPath, line: index + 1, text: text.trim() })
    })
  }
  return violations
}

export const scanWholeSourceFiles = async (
  pattern: RegExp,
  allowlist: ReadonlySet<string>,
  root: string = SOURCE_VOCABULARY_SRC_ROOT
): Promise<SourceVocabularyViolation[]> => {
  const violations: SourceVocabularyViolation[] = []
  for (const absolute of await listSourceVocabularyFiles(root)) {
    const repoPath = relative(PROJECT_ROOT, absolute)
    if (allowlist.has(repoPath)) continue
    const source = stripSourceComments(await readFile(absolute, 'utf8'))
    const flags = `${pattern.flags.replaceAll('g', '').replaceAll('y', '')}g`
    for (const match of source.matchAll(new RegExp(pattern.source, flags))) {
      const line = source.slice(0, match.index).split('\n').length
      violations.push({ file: repoPath, line, text: match[0].replace(/\s+/g, ' ') })
    }
  }
  return violations
}

export const describeSourceVocabularyViolations = (violations: readonly SourceVocabularyViolation[]): string[] =>
  violations.map(({ file, line, text }) => `${file}:${line}  ${text}`)
