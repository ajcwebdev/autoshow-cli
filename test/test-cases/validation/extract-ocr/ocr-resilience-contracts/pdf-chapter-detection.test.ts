import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendChapterExportArtifacts } from '~/cli/commands/process-steps/step-1-download/download-targets/single/document-write'
import { writeProviderArtifacts } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/process-ocr'
import { resolveLocalPdfChapterDetection } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/detection'
import { buildPdfChapterFiles } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/ocr-chapter-artifacts'
import { buildChapterSlug, cleanDetectedChapterTitle } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/text'
import { parseTocEntriesFromPage } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/pdf/ocr-chapters/toc'
import type { ExtractionMetadata, ExtractionResult, PageResult } from '~/types'

const page = (pageNumber: number, text: string): PageResult => ({
  pageNumber,
  method: 'ocr',
  text
})

describe('OCR PDF chapter detection contracts', () => {
  const jonestownTocTitles = [
    'Introduction',
    'The Story Begins',
    'The Movement',
    'Political Protest',
    'Mark Lane',
    'The Final Days',
    'Persecution and Reprisals',
    'The Press',
    'The Families',
    'Our Visit to the Commune',
    'The Journey Home',
    'In Lieu of an Epilogue',
    'Notes',
    'Afterword'
  ]

  const jonestownTocPage = (): PageResult => page(3, [
    'THE PEOPLE TEMPLE CASE FILE',
    'Copyright 1979',
    'University of California Library',
    '',
    'CONTENTS',
    ...jonestownTocTitles.map((title, index) => `${title} . . . . ${index + 5}`),
    '',
    'Digitized by the Internet Archive',
    'University of California Library',
    'https://archive.org/details/example'
  ].join('\n'))

  test('TOC parser scans from CONTENTS, strips spaced dot leaders, and ignores library noise', () => {
    const tocEntries = parseTocEntriesFromPage(jonestownTocPage())

    expect(tocEntries).toHaveLength(14)
    expect(tocEntries.map((entry) => entry.title)).toEqual(jonestownTocTitles)
    expect(tocEntries.some((entry) => entry.title.includes('. .'))).toBe(false)
    expect(tocEntries.some((entry) => /library|archive/i.test(entry.title))).toBe(false)
  })

  test('Jonestown-style TOC wins over noisy heading fallback', () => {
    const chapterPages = jonestownTocTitles.map((title, index) =>
      page(index + 4, [
        String(index + 5),
        title.toUpperCase(),
        `Body text for ${title}.`
      ].join('\n'))
    )
    const pages = [
      page(1, 'THE PEOPLE TEMPLE CASE FILE\nTitle page\nPublished by Example Press'),
      page(2, 'Copyright page\nAll rights reserved\nLibrary of Congress Cataloging'),
      jonestownTocPage(),
      ...chapterPages,
      page(18, '18\nClosing text.'),
      page(19, 'i>VV L\nBack cover\nISBN 9780000000000'),
      page(20, '20\nIndex\nLane, Mark, 22')
    ]

    const detection = resolveLocalPdfChapterDetection({
      pages,
      labelEntries: [{ pageIndex: 3, style: 'arabic', startAt: 5 }]
    })
    const titles = detection.chapters.map((chapter) => chapter.title)

    expect(detection.strategyUsed).toMatch(/^toc/)
    expect(titles).toEqual(expect.arrayContaining([
      'Political Protest',
      'Mark Lane',
      'Persecution and Reprisals',
      'Our Visit to the Commune',
      'In Lieu of an Epilogue',
      'Afterword'
    ]))
    expect(titles.some((title) => /^introduction\s+5$/i.test(title))).toBe(false)
    expect(titles).not.toContain('i>VV L')
  })

  test('TOC page-map candidates are not retargeted to distant body-text title mentions', () => {
    const detection = resolveLocalPdfChapterDetection({
      labelEntries: [{ pageIndex: 0, style: 'arabic', startAt: 1 }],
      pages: [
        page(2, 'Contents\nThe Strange Visit .... 20\nThe Next Case .... 40'),
        page(20, '20\nOpening body without a clean OCR heading.'),
        page(40, 'The Next Case\nA real heading.'),
        page(80, 'The Strange Visit\nThis phrase appears later in running body text.')
      ]
    })

    expect(detection.chapters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'The Strange Visit',
        pdfStartPage: 20,
        source: 'toc-page-map'
      }),
      expect.objectContaining({
        title: 'The Next Case',
        pdfStartPage: 40,
        source: 'toc-page-map+anchor'
      })
    ]))
  })

  test('TOC numeric printed pages are used as guarded PDF-page fallback without page-map spans', () => {
    const detection = resolveLocalPdfChapterDetection({
      pages: [
        page(2, 'Contents\nChapter 1 Opening .... 10\nChapter 2 Middle .... 20\nChapter 3 Ending .... 30'),
        page(10, '10\nOpening body without a clean OCR heading.'),
        page(20, '20\nMiddle body without a clean OCR heading.'),
        page(30, '30\nEnding body without a clean OCR heading.'),
        page(80, 'Chapter 1 Opening\nA distant body mention that must not retarget the TOC entry.')
      ]
    })

    expect(detection.pageMapSpans).toHaveLength(0)
    expect(detection.chapters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'Chapter 1 Opening',
        pdfStartPage: 10,
        source: expect.stringMatching(/^toc-printed-page/)
      }),
      expect.objectContaining({
        title: 'Chapter 2 Middle',
        pdfStartPage: 20,
        source: expect.stringMatching(/^toc-printed-page/)
      }),
      expect.objectContaining({
        title: 'Chapter 3 Ending',
        pdfStartPage: 30,
        source: expect.stringMatching(/^toc-printed-page/)
      })
    ]))
  })

  test('TOC-derived sparse numbered sequences warn and lower confidence', () => {
    const detection = resolveLocalPdfChapterDetection({
      labelEntries: [{ pageIndex: 0, style: 'arabic', startAt: 1 }],
      pages: [
        page(2, 'Contents\nChapter 1 Opening .... 10\nChapter 2 Middle .... 20\nChapter 8 Later .... 80\nChapter 12 End .... 120'),
        page(10, 'Chapter 1 Opening\nBody.'),
        page(20, 'Chapter 2 Middle\nBody.'),
        page(80, 'Chapter 8 Later\nBody.'),
        page(120, 'Chapter 12 End\nBody.')
      ]
    })

    expect(detection.strategyUsed).toMatch(/^toc/)
    expect(detection.warnings.some((warning) => warning.includes('chapter numbering appears incomplete'))).toBe(true)
    expect(Math.max(...detection.chapters.map((chapter) => chapter.confidence))).toBeLessThan(0.84)
  })

  test('combined CHAPTER PAGE TOC headers are not retained in detected titles', () => {
    const pages = [
      page(1, [
        'CONTENTS',
        'CHAPTER PAGE',
        "PUBLISHER'S STATEMENT iii",
        'VII THE LONG SHADOW OF ROME 115',
        'CHAPTER PAGE XIX AFTERWORD 116'
      ].join('\n')),
      page(2, 'front matter'),
      page(3, 'more front matter'),
      page(4, '114\nprevious chapter'),
      page(5, [
        '115',
        'CHAPTER',
        'VII',
        'THE LONG SHADOW OF ROME',
        'Body text begins here.'
      ].join('\n')),
      page(6, '116\nMore body text.')
    ]

    const tocEntries = parseTocEntriesFromPage(pages[0]!)
    expect(tocEntries.map((entry) => entry.title)).toContain("PUBLISHER'S STATEMENT")
    expect(tocEntries.map((entry) => entry.title)).toContain('VII THE LONG SHADOW OF ROME')
    expect(tocEntries.map((entry) => entry.title)).toContain('XIX AFTERWORD')
    expect(tocEntries.some((entry) => entry.title.startsWith('CHAPTER PAGE'))).toBe(false)

    const detection = resolveLocalPdfChapterDetection({ pages })
    expect(detection.chapters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: 'VII THE LONG SHADOW OF ROME',
        pdfStartPage: 5
      })
    ]))
    expect(detection.chapters.some((chapter) => chapter.title.startsWith('CHAPTER PAGE'))).toBe(false)
  })

  test('running header prefixes are removed from numbered PDF chapter titles and slugs', () => {
    const pages = [
      page(1, [
        'CONTENTS',
        '10 / OKBomb! 29. Terms of the Agreement 5',
        '10 / OKBomb! 30. Follow-Up Terms 25'
      ].join('\n')),
      page(2, 'front matter'),
      page(3, 'front matter'),
      page(4, 'front matter'),
      page(5, [
        '10 / OKBomb!',
        '29. Terms of the Agreement',
        'Body text begins here.'
      ].join('\n')),
      ...Array.from({ length: 19 }, (_, index) => page(index + 6, 'continued body')),
      page(25, [
        '10 / OKBomb!',
        '30. Follow-Up Terms',
        'Next body text begins here.'
      ].join('\n'))
    ]

    const detection = resolveLocalPdfChapterDetection({
      pages,
      labelEntries: [{ pageIndex: 0, style: 'arabic', startAt: 1 }]
    })
    const chapter = detection.chapters.find((candidate) => candidate.pdfStartPage === 5)

    expect(chapter?.title).toBe('29. Terms of the Agreement')
    expect(buildChapterSlug(chapter?.title ?? '', 5)).toBe('29-terms-of-the-agreement')
    expect(detection.chapters.some((candidate) => candidate.title.includes('OKBomb'))).toBe(false)
  })

  test('hierarchical numbered chapter prefixes are preserved in detected titles and slugs', () => {
    expect(cleanDetectedChapterTitle('Book 1 - Chapter 2: The Return')).toBe('Book 1 - Chapter 2: The Return')
    expect(buildChapterSlug('Book 1 - Chapter 2: The Return', 10)).toBe('book-1-chapter-2-the-return')
    expect(cleanDetectedChapterTitle('Part 1 - Section 2: Methods')).toBe('Part 1 - Section 2: Methods')
    expect(buildChapterSlug('Part 1 - Section 2: Methods', 20)).toBe('part-1-section-2-methods')
  })

  test('PDF chapter artifacts use ordinal-first source-page filenames', () => {
    const files = buildPdfChapterFiles([
      page(11, 'Introduction\nOpening body.'),
      page(12, 'Continuation body.'),
      page(25, 'Second Chapter\nMore body.')
    ], [
      {
        title: 'Introduction',
        pdfStartPage: 11,
        source: 'toc',
        confidence: 0.9
      },
      {
        title: 'Second Chapter',
        pdfStartPage: 25,
        source: 'toc',
        confidence: 0.9
      }
    ])

    expect(files.map((file) => file.relativePath)).toEqual([
      'chapters/01-011-introduction.txt',
      'chapters/02-025-second-chapter.txt'
    ])
    expect(files.map((file) => file.relativePath)).not.toContain('chapters/011-introduction.txt')
  })

  test('provider chapter artifact metadata agrees with filesystem output', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-pdf-provider-chapters-'))
    const files = buildPdfChapterFiles([
      page(11, 'Introduction\nOpening body.')
    ], [{
      title: 'Introduction',
      pdfStartPage: 11,
      source: 'toc',
      confidence: 0.9
    }])
    const result: ExtractionResult = {
      text: 'Opening body.',
      pages: [page(11, 'Introduction\nOpening body.')],
      totalPages: 11,
      ocrPages: 1,
      textPages: 0
    }
    const metadata: ExtractionMetadata = {
      extractionMethod: 'pdf+gemini-ocr',
      totalPages: 11,
      ocrPages: 1,
      textPages: 0,
      processingTime: 100,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 2,
      ocrService: 'gemini',
      ocrModel: 'gemini-3.5-flash',
      chapterExport: {
        sourceFormat: 'pdf',
        mode: 'chapters',
        sectionsKept: 1,
        sectionsDropped: 0,
        dividerSectionsMerged: 0,
        filesWritten: files.length,
        chapterFilesWritten: files.length,
        directories: ['chapters']
      },
      pdfChapterDetection: {
        mode: 'local',
        strategyUsed: 'toc',
        overallConfidence: 0.9,
        warnings: [],
        tocPages: [3],
        pageMapSpans: [],
        chapters: [{
          title: 'Introduction',
          pdfStartPage: 11,
          source: 'toc',
          confidence: 0.9
        }]
      }
    }

    try {
      await writeProviderArtifacts(
        tempDir,
        { service: 'gemini', model: 'gemini-3.5-flash' },
        result,
        metadata,
        'json',
        files
      )

      const providerResult = JSON.parse(await readFile(join(tempDir, 'result.json'), 'utf-8')) as {
        metadata: ExtractionMetadata
      }
      const chapterText = await readFile(join(tempDir, files[0]?.relativePath ?? ''), 'utf-8')

      expect(providerResult.metadata.chapterExport?.chapterFilesWritten).toBe(files.length)
      expect(providerResult.metadata.chapterExport?.directories).toEqual(['chapters'])
      expect(chapterText).toContain('Opening body.')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('root chapter artifacts are only advertised when root directories exist', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-root-chapter-artifacts-'))
    const artifactFiles: Record<string, string> = { run: 'run.json' }
    const metadata: ExtractionMetadata = {
      extractionMethod: 'pdf+gemini-ocr',
      totalPages: 11,
      ocrPages: 11,
      textPages: 0,
      processingTime: 100,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 2,
      ocrService: 'gemini',
      ocrModel: 'gemini-3.5-flash',
      chapterExport: {
        sourceFormat: 'pdf',
        mode: 'chapters',
        sectionsKept: 1,
        sectionsDropped: 0,
        dividerSectionsMerged: 0,
        filesWritten: 1,
        chapterFilesWritten: 1,
        directories: ['chapters', 'chunks']
      }
    }

    try {
      await appendChapterExportArtifacts(artifactFiles, metadata, tempDir)
      expect(artifactFiles).toEqual({ run: 'run.json' })

      await mkdir(join(tempDir, 'chapters'))
      await appendChapterExportArtifacts(artifactFiles, metadata, tempDir)
      expect(artifactFiles).toMatchObject({
        run: 'run.json',
        chapters: 'chapters/'
      })
      expect(artifactFiles['chunks']).toBeUndefined()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('PDF split chapter parts keep ordinal-first source-page base names', () => {
    const files = buildPdfChapterFiles([
      page(11, 'A\n\nPart 1.\n\nPart 2.\n\nPart 3.')
    ], [
      {
        title: 'A',
        pdfStartPage: 11,
        source: 'heading',
        confidence: 0.8
      }
    ], 8)
    const relativePaths = files.map((file) => file.relativePath)

    expect(relativePaths[0]).toBe('chapters/01-011-a-part-01.txt')
    expect(relativePaths.at(-1)).toMatch(/^chapters\/01-011-a-part-\d{2}\.txt$/)
    expect([...relativePaths].sort()).toEqual(relativePaths)
  })
})
