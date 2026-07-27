import { expect, test } from 'bun:test'
import {
  buildChapterArtifactRelativePaths,
  formatChapterArtifactSourceLocator
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/chapter-artifact-filenames'

test('chapter artifact source locators are padded but not truncated', () => {
  expect(formatChapterArtifactSourceLocator(3)).toBe('003')
  expect(formatChapterArtifactSourceLocator(1234)).toBe('1234')
})

test('chapter artifact filenames avoid exact path collisions', () => {
  expect(buildChapterArtifactRelativePaths([
    { ordinal: 1, sourceLocator: 11, slug: 'introduction' },
    { ordinal: 1, sourceLocator: 11, slug: 'introduction' },
    { ordinal: 2, sourceLocator: 11, slug: '' }
  ])).toEqual([
    'chapters/01-011-introduction.txt',
    'chapters/01-011-introduction-02.txt',
    'chapters/02-011-chapter.txt'
  ])
})
