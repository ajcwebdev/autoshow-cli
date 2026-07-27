import { expect, test } from 'bun:test'
import type { DocumentMetadata } from '~/types'
import {
  buildEpubTextOutput,
  buildExtractionOptions,
  createReader,
  inspectEpubWithReader,
  join,
  mkdtemp,
  rm,
  runOcr,
  tmpdir,
  writeStoredZip
} from './shared'

const buildMinimalEpubFiles = (chapterHtml: string): Record<string, string> => ({
  mimetype: 'application/epub+zip',
  'META-INF/container.xml': `
    <container>
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>
  `,
  'OEBPS/content.opf': `
    <package>
      <metadata><title>Self Closing Book</title></metadata>
      <manifest>
        <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine><itemref idref="chapter1"/></spine>
    </package>
  `,
  'OEBPS/Text/chapter1.xhtml': chapterHtml
})

test('EPUB native text extraction handles XHTML self-closing title tags in chapter HTML', async () => {
  const inspected = await inspectEpubWithReader(createReader(buildMinimalEpubFiles(
    '<html><head><title/></head><body><p>Visible chapter text.</p></body></html>'
  )), 'bun')
  const chapter = inspected.payload.chapters[0]

  expect(chapter?.text).toBe('Visible chapter text.')
  expect(chapter?.wordCount).toBeGreaterThan(0)

  const output = buildEpubTextOutput('self-closing-book', inspected.payload.chapters, { chapterFiles: true })
  const chapterFile = output.exportPlan?.files[0]

  expect(output.text).toBe('Visible chapter text.')
  expect(output.pages[0]?.text).toBe('Visible chapter text.')
  expect(output.exportPlan?.summary.sectionsKept).toBe(1)
  expect(output.exportPlan?.summary.chapterFilesWritten).toBe(1)
  expect(chapterFile?.relativePath).toBe('chapters/01-001-chapter1.txt')
  expect(chapterFile?.text).toBe('Visible chapter text.')
})

test('EPUB native text extraction rejects all-empty inspected chapters', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-empty-epub-'))
  const epubPath = join(root, 'empty.epub')
  try {
    await writeStoredZip(epubPath, buildMinimalEpubFiles(
      '<html><head><title>Empty</title></head><body><script>hidden()</script></body></html>'
    ))
    const fileSize = (await Bun.file(epubPath).arrayBuffer()).byteLength
    const metadata: DocumentMetadata = {
      slug: 'empty-epub',
      pageCount: 0,
      format: 'epub',
      fileSize
    }

    await expect(runOcr(
      epubPath,
      metadata,
      buildExtractionOptions(epubPath, join(root, 'output'))
    )).rejects.toThrow('Native EPUB text extraction returned no text for any inspected chapter')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
