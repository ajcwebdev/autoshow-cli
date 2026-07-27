import { expect, test } from 'bun:test'
import { buildEpubTextOutput, buildSplitChapterText, buildTestEpubChapter } from './shared'

test('EPUB chapter export uses two digit prefixes below 100 generated chapter files', () => {
  const chapters = Array.from({ length: 99 }, (_, index) => buildTestEpubChapter(index + 1))
  const output = buildEpubTextOutput('book', chapters, { chapterFiles: true })
  const relativePaths = output.exportPlan?.files.map((file) => file.relativePath) ?? []

  expect(relativePaths).toHaveLength(99)
  expect(relativePaths[0]).toBe('chapters/01-001-chapter-1.txt')
  expect(relativePaths[98]).toBe('chapters/99-099-chapter-99.txt')
  expect(relativePaths.some((path) => /^chapters\/0\d{2}-/.test(path))).toBe(false)
})

test('EPUB chapter export uses three digit prefixes at 100 generated chapter files', () => {
  const chapters = Array.from({ length: 100 }, (_, index) => buildTestEpubChapter(index + 1))
  const output = buildEpubTextOutput('book', chapters, { chapterFiles: true })
  const relativePaths = output.exportPlan?.files.map((file) => file.relativePath) ?? []

  expect(relativePaths).toHaveLength(100)
  expect(relativePaths[0]).toBe('chapters/001-001-chapter-1.txt')
  expect(relativePaths[98]).toBe('chapters/099-099-chapter-99.txt')
  expect(relativePaths[99]).toBe('chapters/100-100-chapter-100.txt')
})

test('EPUB chapter export applies dynamic prefix width to split chapter parts', () => {
  const underLimitOutput = buildEpubTextOutput('book', [
    buildTestEpubChapter(1, 'Mega Chapter', buildSplitChapterText(99))
  ], { chapterFiles: true, chunkLimitChars: 12 })
  const underLimitPaths = underLimitOutput.exportPlan?.files.map((file) => file.relativePath) ?? []

  expect(underLimitPaths).toHaveLength(99)
  expect(underLimitPaths[0]).toBe('chapters/01-001-mega-chapter-part-01.txt')
  expect(underLimitPaths[98]).toBe('chapters/01-001-mega-chapter-part-99.txt')
  expect([...underLimitPaths].sort()).toEqual(underLimitPaths)

  const atLimitOutput = buildEpubTextOutput('book', [
    buildTestEpubChapter(1, 'Mega Chapter', buildSplitChapterText(100))
  ], { chapterFiles: true, chunkLimitChars: 12 })
  const atLimitPaths = atLimitOutput.exportPlan?.files.map((file) => file.relativePath) ?? []

  expect(atLimitPaths).toHaveLength(100)
  expect(atLimitPaths[0]).toBe('chapters/001-001-mega-chapter-part-001.txt')
  expect(atLimitPaths[98]).toBe('chapters/001-001-mega-chapter-part-099.txt')
  expect(atLimitPaths[99]).toBe('chapters/001-001-mega-chapter-part-100.txt')
  expect([...atLimitPaths].sort()).toEqual(atLimitPaths)
})

test('EPUB chapter export keeps blank and duplicate slugs collision-free', () => {
  const output = buildEpubTextOutput('book', [
    {
      ...buildTestEpubChapter(1, '!!!', 'Blank title body.'),
      idref: '',
      href: '',
      path: 'OEBPS/Text/blank-title.xhtml'
    },
    buildTestEpubChapter(2, 'Repeated Title', 'First repeated title body.'),
    buildTestEpubChapter(3, 'Repeated Title', 'Second repeated title body.')
  ], { chapterFiles: true })
  const relativePaths = output.exportPlan?.files.map((file) => file.relativePath) ?? []

  expect(relativePaths).toEqual([
    'chapters/01-001-section-1.txt',
    'chapters/02-002-repeated-title.txt',
    'chapters/03-003-repeated-title.txt'
  ])
  expect(new Set(relativePaths).size).toBe(relativePaths.length)
})

test('EPUB chapter export derives ordinals from emitted chapter order after dropped spine entries', () => {
  const output = buildEpubTextOutput('book', [
    buildTestEpubChapter(1, 'Empty Prelude', ''),
    buildTestEpubChapter(2, 'First Kept Chapter', 'First kept body.'),
    buildTestEpubChapter(3, 'Second Kept Chapter', 'Second kept body.')
  ], { chapterFiles: true })
  const relativePaths = output.exportPlan?.files.map((file) => file.relativePath) ?? []

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('spine')
  expect(relativePaths).toEqual([
    'chapters/01-002-first-kept-chapter.txt',
    'chapters/02-003-second-kept-chapter.txt'
  ])
})
