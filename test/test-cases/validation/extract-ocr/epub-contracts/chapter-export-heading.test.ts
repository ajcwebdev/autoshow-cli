import { expect, test } from 'bun:test'
import {
  buildEpubTextOutput,
  createStandardEpubReader,
  encodeLegacyPuaText,
  inspectEpubWithReader
} from './shared'

test('EPUB chapter export ignores page-list TOCs and groups decoded heading sections', async () => {
  const inspected = await inspectEpubWithReader(createStandardEpubReader({
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="page1" href="Text/page1.xhtml" media-type="application/xhtml+xml"/>
          <item id="page2" href="Text/page2.xhtml" media-type="application/xhtml+xml"/>
          <item id="page3" href="Text/page3.xhtml" media-type="application/xhtml+xml"/>
          <item id="page4" href="Text/page4.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="page1"/>
          <itemref idref="page2"/>
          <itemref idref="page3"/>
          <itemref idref="page4"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="page1" playOrder="1">
            <navLabel><text>page1</text></navLabel>
            <content src="Text/page1.xhtml"/>
          </navPoint>
          <navPoint id="page2" playOrder="2">
            <navLabel><text>page2</text></navLabel>
            <content src="Text/page2.xhtml"/>
          </navPoint>
          <navPoint id="page3" playOrder="3">
            <navLabel><text>page3</text></navLabel>
            <content src="Text/page3.xhtml"/>
          </navPoint>
          <navPoint id="page4" playOrder="4">
            <navLabel><text>page4</text></navLabel>
            <content src="Text/page4.xhtml"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/page1.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('Introduction:')}</p>
        <p>${encodeLegacyPuaText('Opening “decoded” text.')}</p>
      </body></html>
    `,
    'OEBPS/Text/page2.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('This page continues the introduction — without a new heading.')}</p>
      </body></html>
    `,
    'OEBPS/Text/page3.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('Chapter 1:')}</p>
        <p>${encodeLegacyPuaText('First chapter starts here.')}</p>
      </body></html>
    `,
    'OEBPS/Text/page4.xhtml': `
      <html><body>
        <p>${encodeLegacyPuaText('Finality')}</p>
        <p>${encodeLegacyPuaText('Closing thought…')}</p>
      </body></html>
    `
  }), 'bun')

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })
  const files = output.exportPlan?.files ?? []

  expect(output.text).toContain('Opening “decoded” text.')
  expect(output.text).not.toMatch(/[-]/)
  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.tocStartSections).toBe(4)
  expect(output.exportPlan?.summary.pageLikeTocStartsIgnored).toBe(4)
  expect(files.map((file) => file.relativePath)).toEqual([
    'chapters/01-001-introduction.txt',
    'chapters/02-003-chapter-1.txt',
    'chapters/03-004-finality.txt'
  ])
  expect(files[0]?.text).toContain('This page continues the introduction — without a new heading.')
  expect(files[0]?.relativePath).not.toContain('page')
})

test('EPUB chapter export ignores sparse generic page TOCs and splits headings inside spine text', async () => {
  const inspected = await inspectEpubWithReader(createStandardEpubReader({
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="part0001" href="Text/part0001.html" media-type="application/xhtml+xml"/>
          <item id="part0002" href="Text/part0002.html" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="part0001"/>
          <itemref idref="part0002"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="pages" playOrder="1">
            <navLabel><text>Pages</text></navLabel>
            <content src="Text/part0001.html"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/part0001.html': `
      <html>
        <head><title>Generic Page Book</title></head>
        <body>
          <h1>Contents</h1>
          <p>Foreword</p>
          <p>Introduction</p>
          <p>Chapter I</p>
          <p>Appendix A</p>

          <h1>Foreword</h1>
          <p>Foreword body opens with enough real prose to distinguish the book text from the printed contents list, so the heading fallback keeps this as the first exported structural section.</p>

          <p>CHAPTER I</p>
          <p>Chapter one starts here.</p>
          <p>Chapter I</p>
          <p>Running header copy stays with chapter one.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/part0002.html': `
      <html>
        <head><title>Generic Page Book</title></head>
        <body>
          <p>Chapter II</p>
          <p>Second chapter starts in another spine file.</p>

          <p>Appendix A</p>
          <p>Appendix body.</p>

          <p>About the Author</p>
          <p>Author note.</p>
        </body>
      </html>
    `
  }), 'bun')

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })
  const files = output.exportPlan?.files ?? []
  const relativePaths = files.map((file) => file.relativePath)

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.tocStartSections).toBe(1)
  expect(output.exportPlan?.summary.genericTocStartsIgnored).toBe(1)
  expect(output.exportPlan?.summary.logicalChapterCount).toBeGreaterThan(1)
  expect(relativePaths).not.toContain('chapters/01-001-pages.txt')
  expect(relativePaths).toEqual([
    'chapters/01-001-foreword.txt',
    'chapters/02-001-chapter-i.txt',
    'chapters/03-002-chapter-ii.txt',
    'chapters/04-002-appendix-a.txt',
    'chapters/05-002-about-the-author.txt'
  ])
  expect(files[0]?.text).toStartWith('Foreword')
  expect(files[0]?.text).not.toContain('Introduction')
  expect(files[1]?.text).toStartWith('CHAPTER I')
  expect(files[1]?.text).toContain('Chapter one starts here.')
  expect(files[1]?.text).toContain('Running header copy stays with chapter one.')
  expect(files[1]?.text).not.toContain('Second chapter starts in another spine file.')
  expect(files[4]?.text).toContain('Author note.')
})

test('EPUB chapter export ignores one empty-label NCX entry and splits the single spine file by headings', async () => {
  const inspected = await inspectEpubWithReader(createStandardEpubReader({
    'OEBPS/content.opf': `
      <package>
        <metadata>
          <dc:title>Synthetic Systems Handbook</dc:title>
        </metadata>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="body" href="Text/body.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="body"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="only" playOrder="1">
            <navLabel><text></text></navLabel>
            <content src="Text/body.xhtml"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/nav.xhtml': `
      <html>
        <body>
          <nav epub:type="toc">
            <ol></ol>
          </nav>
        </body>
      </html>
    `,
    'OEBPS/Text/body.xhtml': `
      <html>
        <head><title>Synthetic Systems Handbook</title></head>
        <body>
          <h1>Contents</h1>
          <p>Chapter 1</p>
          <p>Input Mapping 7</p>
          <p>Chapter 2</p>
          <p>Open Processing 19</p>
          <p>Chapter 3</p>
          <p>Output Review 31</p>
          <p>Afterword 47</p>

          <h1>Chapter 1</h1>
          <h2>Input Mapping</h2>
          <p>The first chapter opens with enough ordinary prose and punctuation to mark the true body start after the printed contents list has finished.</p>
          <p>Chapter 1</p>
          <p>A running header with only the chapter number should stay attached to the subtitle-based chapter.</p>
          <h2>Notes:</h2>
          <p>1. First chapter note stays with chapter one instead of hiding the next real chapter.</p>

          <h1>Chapter 2</h1>
          <h2>Open Processing</h2>
          <p>The second chapter continues the argument with regular body prose.</p>

          <h1>Chapter 3</h1>
          <h2>Output Review</h2>
          <p>The third chapter body is short but still belongs in its own exported artifact.</p>
          <h2>Notes:</h2>
          <p>1. Final chapter note stays before the afterword.</p>

          <h1>Afterword</h1>
          <p>Afterword-level material should remain after the numbered chapters.</p>
        </body>
      </html>
    `
  }), 'bun')

  const output = buildEpubTextOutput('synthetic-systems-handbook', inspected.payload.chapters, {
    chapterFiles: true,
    ...(inspected.payload.metadata.title ? { documentTitle: inspected.payload.metadata.title } : {})
  })
  const files = output.exportPlan?.files ?? []
  const relativePaths = files.map((file) => file.relativePath)

  expect(inspected.payload.chapters).toHaveLength(1)
  expect(inspected.payload.chapters[0]?.title).toBe('Untitled')
  expect(output.exportPlan?.summary.sectionsKept).toBe(1)
  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.genericTocStartsIgnored).toBe(1)
  expect(output.exportPlan?.summary.logicalChapterCount).toBe(4)
  expect(relativePaths).toEqual([
    'chapters/01-001-chapter-1-input-mapping.txt',
    'chapters/02-001-chapter-2-open-processing.txt',
    'chapters/03-001-chapter-3-output-review.txt',
    'chapters/04-001-afterword.txt'
  ])
  expect(relativePaths).not.toContain('chapters/01-001-untitled.txt')
  expect(files[0]?.text).toStartWith('Chapter 1\n\nInput Mapping')
  expect(files[0]?.text).toContain('A running header with only the chapter number should stay attached')
  expect(files[0]?.text).toContain('First chapter note stays with chapter one')
  expect(files[1]?.text).toStartWith('Chapter 2\n\nOpen Processing')
  expect(files[2]?.text).toContain('Final chapter note stays before the afterword')
  expect(files[3]?.text).toStartWith('Afterword')
})

test('EPUB chapter export prefers multiple real headings over a single whole-file TOC entry', async () => {
  const inspected = await inspectEpubWithReader(createStandardEpubReader({
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="body" href="Text/body.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="body"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="whole-book" playOrder="1">
            <navLabel><text>Start Reading</text></navLabel>
            <content src="Text/body.xhtml"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/body.xhtml': `
      <html>
        <body>
          <h1>Chapter 1</h1>
          <h2>First Signal</h2>
          <p>First body.</p>
          <h1>Chapter 2</h1>
          <h2>Second Signal</h2>
          <p>Second body.</p>
        </body>
      </html>
    `
  }), 'bun')

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.tocStartSections).toBe(1)
  expect(output.exportPlan?.summary.genericTocStartsIgnored).toBeUndefined()
  expect(output.exportPlan?.files.map((file) => file.relativePath)).toEqual([
    'chapters/01-001-chapter-1-first-signal.txt',
    'chapters/02-001-chapter-2-second-signal.txt'
  ])
})

test('EPUB chapter export ignores body-prefix TOCs and groups numbered headings with backmatter', async () => {
  const inspected = await inspectEpubWithReader(createStandardEpubReader({
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="part1" href="Text/part1.xhtml" media-type="application/xhtml+xml"/>
          <item id="part2" href="Text/part2.xhtml" media-type="application/xhtml+xml"/>
          <item id="backmatter" href="Text/backmatter.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="part1"/>
          <itemref idref="part2"/>
          <itemref idref="backmatter"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="toc-one" playOrder="1">
            <navLabel><text>The opening argument climbed high</text></navLabel>
            <content src="Text/part1.xhtml#body-one"/>
          </navPoint>
          <navPoint id="toc-four" playOrder="2">
            <navLabel><text>The middle work began with a catalog of fail</text></navLabel>
            <content src="Text/part2.xhtml#body-four"/>
          </navPoint>
          <navPoint id="toc-six" playOrder="3">
            <navLabel><text>The conclusion gathers the numbered arg</text></navLabel>
            <content src="Text/part2.xhtml#body-six"/>
          </navPoint>
          <navPoint id="toc-notes" playOrder="4">
            <navLabel><text>The notes begin with explanatory text for read</text></navLabel>
            <content src="Text/backmatter.xhtml#body-notes"/>
          </navPoint>
          <navPoint id="toc-bibliography" playOrder="5">
            <navLabel><text>Bibliography entries gather the sources in gro</text></navLabel>
            <content src="Text/backmatter.xhtml#body-bibliography"/>
          </navPoint>
          <navPoint id="toc-index" playOrder="6">
            <navLabel><text>Index entries begin with archive terms and nam</text></navLabel>
            <content src="Text/backmatter.xhtml#body-index"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/part1.xhtml': `
      <html>
        <head><title>Body Prefix Book</title></head>
        <body>
          <h1>1 Origins</h1>
          <p id="body-one">The opening argument climbed higher into the archive while still making room for ordinary readers, so the opening chapter starts with a long body paragraph instead of a clean title anchor.</p>
          <p>The first argument continues across a normal spine boundary.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/part2.xhtml': `
      <html>
        <head><title>Body Prefix Book</title></head>
        <body>
          <p>The first argument has a final continuation before the next numbered heading.</p>
          <h1>4 'Middle Work'</h1>
          <p id="body-four">The middle work began with a catalog of failures that made the earlier system impossible to defend, and this long paragraph is what the broken NCX copied as a label.</p>
          <p>Middle chapter continuation.</p>
          <h1>6 Conclusion</h1>
          <p id="body-six">The conclusion gathers the numbered argument into a compact final claim, with enough prose and punctuation to look like body text rather than a heading.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/backmatter.xhtml': `
      <html>
        <head><title>Body Prefix Book</title></head>
        <body>
          <h1>Notes</h1>
          <p id="body-notes">The notes begin with explanatory text for readers who want chapter-level citations, and the following labels should remain inside the notes artifact.</p>
          <p>Chapter 1</p>
          <p>First note detail stays in Notes.</p>
          <p>Chapter 4</p>
          <p>Fourth note detail also stays in Notes.</p>
          <h1>Select Bibliography</h1>
          <p id="body-bibliography">Bibliography entries gather the sources in groups rather than chapters, and the exported artifact should use the real backmatter heading.</p>
          <h1>Index</h1>
          <p id="body-index">Index entries begin with archive terms and names, followed by compact references that should not become body-fragment filenames.</p>
        </body>
      </html>
    `
  }), 'bun')

  const output = buildEpubTextOutput('book', inspected.payload.chapters, { chapterFiles: true })
  const files = output.exportPlan?.files ?? []
  const relativePaths = files.map((file) => file.relativePath)

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.tocStartSections).toBe(6)
  expect(output.exportPlan?.summary.bodyTextTocStartsIgnored).toBe(6)
  expect(relativePaths).toEqual([
    'chapters/01-001-1-origins.txt',
    'chapters/02-002-4-middle-work.txt',
    'chapters/03-002-6-conclusion.txt',
    'chapters/04-003-notes.txt',
    'chapters/05-003-select-bibliography.txt',
    'chapters/06-003-index.txt'
  ])
  expect(relativePaths.some((path) => path.includes('opening-argument') || path.includes('the-notes-begin'))).toBe(false)
  expect(files[0]?.text).toContain('The first argument has a final continuation before the next numbered heading.')
  expect(files[1]?.text).toStartWith("4 'Middle Work'")
  expect(files[3]?.text).toContain('Chapter 1')
  expect(files[3]?.text).toContain('Fourth note detail also stays in Notes.')
  expect(files[4]?.text).toStartWith('Select Bibliography')
  expect(files[5]?.text).toStartWith('Index')
})

test('EPUB chapter export ignores numbered running headers that repeat the book title', async () => {
  const inspected = await inspectEpubWithReader(createStandardEpubReader({
    'OEBPS/content.opf': `
      <package>
        <metadata>
          <dc:title>Running Header Book</dc:title>
        </metadata>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="page1" href="Text/page1.xhtml" media-type="application/xhtml+xml"/>
          <item id="page2" href="Text/page2.xhtml" media-type="application/xhtml+xml"/>
          <item id="page3" href="Text/page3.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="page1"/>
          <itemref idref="page2"/>
          <itemref idref="page3"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="page1" playOrder="1">
            <navLabel><text>page1</text></navLabel>
            <content src="Text/page1.xhtml"/>
          </navPoint>
          <navPoint id="page2" playOrder="2">
            <navLabel><text>page2</text></navLabel>
            <content src="Text/page2.xhtml"/>
          </navPoint>
          <navPoint id="page3" playOrder="3">
            <navLabel><text>page3</text></navLabel>
            <content src="Text/page3.xhtml"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/page1.xhtml': `
      <html>
        <head><title>Running Header Book</title></head>
        <body>
          <h1>1 Opening Signal</h1>
          <p>Opening chapter body starts here.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/page2.xhtml': `
      <html>
        <head><title>Running Header Book</title></head>
        <body>
          <p>150 Running Header Book</p>
          <p>Opening chapter continuation after a page header.</p>
          <h1>2 Second Signal</h1>
          <p>Second chapter body starts here.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/page3.xhtml': `
      <html>
        <head><title>Running Header Book</title></head>
        <body>
          <p>3 Closing Signal</p>
          <p>Closing chapter body starts here.</p>
        </body>
      </html>
    `
  }), 'bun')

  const output = buildEpubTextOutput('running-header-book', inspected.payload.chapters, {
    chapterFiles: true,
    ...(inspected.payload.metadata.title ? { documentTitle: inspected.payload.metadata.title } : {})
  })
  const files = output.exportPlan?.files ?? []
  const relativePaths = files.map((file) => file.relativePath)

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.pageLikeTocStartsIgnored).toBe(3)
  expect(relativePaths).toEqual([
    'chapters/01-001-1-opening-signal.txt',
    'chapters/02-002-2-second-signal.txt',
    'chapters/03-003-3-closing-signal.txt'
  ])
  expect(relativePaths.some((path) => path.includes('150-running-header-book'))).toBe(false)
  expect(files[0]?.text).toContain('150 Running Header Book')
  expect(files[0]?.text).toContain('Opening chapter continuation after a page header.')
  expect(files[1]?.text).toStartWith('2 Second Signal')
})

test('EPUB chapter export ignores synthetic mid-word body-fragment TOC labels', async () => {
  const inspected = await inspectEpubWithReader(createStandardEpubReader({
    'OEBPS/content.opf': `
      <package>
        <metadata>
          <dc:title>Synthetic Archive Handbook</dc:title>
        </metadata>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="part1" href="Text/part1.xhtml" media-type="application/xhtml+xml"/>
          <item id="part2" href="Text/part2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc">
          <itemref idref="part1"/>
          <itemref idref="part2"/>
        </spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="fragment-one" playOrder="1">
            <navLabel><text>This opening paragraph continues past the cop</text></navLabel>
            <content src="Text/part1.xhtml#fragment-one"/>
          </navPoint>
          <navPoint id="fragment-two" playOrder="2">
            <navLabel><text>The second section explains a repeatable wor</text></navLabel>
            <content src="Text/part2.xhtml#fragment-two"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/part1.xhtml': `
      <html>
        <head><title>Synthetic Archive Handbook</title></head>
        <body>
          <h1>4 Data on the Installment Plan</h1>
          <p id="fragment-one">This opening paragraph continues past the copied label and contains enough ordinary prose for the NCX entry to be classified as a body-text fragment.</p>
          <p>150 Synthetic Archive Handbook</p>
          <p>Developed validation techniques remain attached to chapter four.</p>
        </body>
      </html>
    `,
    'OEBPS/Text/part2.xhtml': `
      <html>
        <head><title>Synthetic Archive Handbook</title></head>
        <body>
          <h1>5 The Report on the Marble Table</h1>
          <p id="fragment-two">The second section explains a repeatable workflow with enough punctuation and prose to remain body text rather than becoming a filename.</p>
        </body>
      </html>
    `
  }), 'bun')
  const output = buildEpubTextOutput('synthetic-archive-handbook', inspected.payload.chapters, {
    chapterFiles: true,
    ...(inspected.payload.metadata.title ? { documentTitle: inspected.payload.metadata.title } : {})
  })
  const files = output.exportPlan?.files ?? []
  const relativePaths = files.map((file) => file.relativePath)
  const chapterFour = files.find((file) => file.relativePath.endsWith('-4-data-on-the-installment-plan.txt'))
  const chapterFive = files.find((file) => file.relativePath.endsWith('-5-the-report-on-the-marble-table.txt'))

  expect(output.exportPlan?.summary.logicalChapterSource).toBe('heading')
  expect(output.exportPlan?.summary.bodyTextTocStartsIgnored).toBe(2)
  expect(relativePaths.some((path) => path.includes('150-synthetic-archive-handbook'))).toBe(false)
  expect(relativePaths.some((path) =>
    path.includes('this-opening-paragraph')
    || path.includes('the-second-section')
  )).toBe(false)
  expect(chapterFour).toBeDefined()
  expect(chapterFive).toBeDefined()
  expect(chapterFour?.text).toContain('150 Synthetic Archive Handbook\n\nDeveloped validation techniques remain attached to chapter four.')
})
