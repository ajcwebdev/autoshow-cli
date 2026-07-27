import { expect, test } from 'bun:test'
import { createReader, inspectEpubWithReader, runEpubCalibreInspect } from './shared'

test('EPUB TOC heading matching uses cleaned HTML fragments', async () => {
  const inspected = await inspectEpubWithReader(createReader({
    'META-INF/container.xml': `
      <container>
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>
    `,
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine toc="toc"><itemref idref="chapter1"/></spine>
      </package>
    `,
    'OEBPS/toc.ncx': `
      <ncx>
        <navMap>
          <navPoint id="toc-ch1" playOrder="1">
            <navLabel><text>Chapter One</text></navLabel>
            <content src="Text/chapter1.xhtml#chapter-one-page"/>
          </navPoint>
        </navMap>
      </ncx>
    `,
    'OEBPS/Text/chapter1.xhtml': `
      <html>
        <head><title>Fragment Cleanup Book</title></head>
        <body>
          <a id="chapter-one-page"></a>
          <p>Page 1</p>
          <h1><span>Chapter&nbsp;One</span><sup>1</sup></h1>
          <p>Body text.</p>
        </body>
      </html>
    `
  }), 'bun')

  expect(inspected.payload.chapters[0]?.text).toBe('Chapter One\n\nBody text.')
})

test('EPUB nav TOC titles use cleaned HTML fragments', async () => {
  const inspected = await inspectEpubWithReader(createReader({
    'META-INF/container.xml': `
      <container>
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>
    `,
    'OEBPS/content.opf': `
      <package>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="chapter1" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine><itemref idref="chapter1"/></spine>
      </package>
    `,
    'OEBPS/nav.xhtml': `
      <html>
        <body>
          <nav epub:type="toc">
            <ol>
              <li><a href="Text/chapter1.xhtml"><span>Chapter&nbsp;One</span><sup>1</sup></a></li>
            </ol>
          </nav>
        </body>
      </html>
    `,
    'OEBPS/Text/chapter1.xhtml': `
      <html>
        <body>
          <h1>Chapter One</h1>
          <p>Body text.</p>
        </body>
      </html>
    `
  }), 'bun')

  expect(inspected.payload.toc.source).toBe('nav')
  expect(inspected.payload.toc.items[0]?.title).toBe('Chapter One')
  expect(inspected.payload.chapters[0]?.title).toBe('Chapter One')
})

test('--epub-calibre compatibility path uses the native Bun EPUB reader', async () => {
  const inspected = await runEpubCalibreInspect('input/examples/document/1-epub.epub')

  expect(inspected.payload.engine).toBe('calibre')
  expect(inspected.payload.diagnostics.adapter).toBe('bun-zip')
  expect(inspected.payload.chapters.length).toBeGreaterThan(0)
})
