import { expect, test } from 'bun:test'
import { createReader, inspectEpubWithReader } from './shared'

const EPUB_UNREADABLE_ERROR = 'AutoShow does not remove DRM'

const readableEpubFiles = (overrides: Record<string, string> = {}): Record<string, string> => ({
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
        <item id="chapter" href="Text/chapter.xhtml" media-type="application/xhtml+xml"/>
        <item id="font" href="Fonts/book.otf" media-type="font/otf"/>
        <item id="cover" href="Images/cover.jpg" media-type="image/jpeg"/>
      </manifest>
      <spine><itemref idref="chapter"/></spine>
    </package>
  `,
  'OEBPS/Text/chapter.xhtml': `
    <html>
      <body>
        <h1>Readable Chapter</h1>
        <p>Readable body text.</p>
      </body>
    </html>
  `,
  'OEBPS/Fonts/book.otf': 'fake font payload',
  'OEBPS/Images/cover.jpg': 'fake image payload',
  ...overrides
})

test('EPUB inspection rejects encrypted spine XHTML entries', async () => {
  await expect(inspectEpubWithReader(createReader(readableEpubFiles({
    'META-INF/encryption.xml': `
      <encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
        <enc:EncryptedData>
          <enc:CipherData>
            <enc:CipherReference URI="./OEBPS/Text/chapter.xhtml"/>
          </enc:CipherData>
        </enc:EncryptedData>
      </encryption>
    `
  })), 'bun')).rejects.toThrow(EPUB_UNREADABLE_ERROR)
})

test('EPUB inspection allows encrypted non-content assets', async () => {
  const inspected = await inspectEpubWithReader(createReader(readableEpubFiles({
    'META-INF/encryption.xml': `
      <encryption xmlns:enc="http://www.w3.org/2001/04/xmlenc#">
        <enc:EncryptedData>
          <enc:CipherData>
            <enc:CipherReference URI="OEBPS/Fonts/book.otf"/>
          </enc:CipherData>
        </enc:EncryptedData>
        <enc:EncryptedData>
          <enc:CipherData>
            <enc:CipherReference URI="OEBPS/Images/cover.jpg"/>
          </enc:CipherData>
        </enc:EncryptedData>
      </encryption>
    `
  })), 'bun')

  expect(inspected.payload.chapters).toHaveLength(1)
  expect(inspected.text).toContain('Readable body text.')
})

test('EPUB inspection rejects garbled spine content without encryption metadata', async () => {
  const garbledText = `\u0000\u0001\u0002${'\uFFFD'.repeat(20)}not html content`

  await expect(inspectEpubWithReader(createReader(readableEpubFiles({
    'OEBPS/Text/chapter.xhtml': garbledText
  })), 'bun')).rejects.toThrow(EPUB_UNREADABLE_ERROR)
})
