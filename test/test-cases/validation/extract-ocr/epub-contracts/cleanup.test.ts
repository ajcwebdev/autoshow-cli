import { expect, test } from 'bun:test'
import {
  cleanEpubHtmlToText,
  encodeLegacyPuaText,
  encodeReversedLegacyPuaText
} from './shared'

test('EPUB cleanup prefers body output and falls back to document text without body', async () => {
  await expect(cleanEpubHtmlToText('<section><p>Document fallback text.</p></section>'))
    .resolves.toBe('Document fallback text.')

  await expect(cleanEpubHtmlToText(`
    <html>
      <p>Document-level text before body.</p>
      <body><p>Body text only.</p></body>
      <p>Document-level text after body.</p>
    </html>
  `)).resolves.toBe('Body text only.')
})

test('EPUB cleanup normalizes XHTML self-closing non-void tags before parsing', async () => {
  await expect(cleanEpubHtmlToText('<html><head><title/></head><body><p>X</p></body></html>'))
    .resolves.toBe('X')
})

test('EPUB cleanup skips metadata, scripts, styles, noscript, and footnote subtrees', async () => {
  const text = await cleanEpubHtmlToText(`
    <html>
      <head><title>Hidden Title</title></head>
      <body>
        <style>.hidden { display: none }</style>
        <script>hiddenScript()</script>
        <noscript>Hidden noscript text.</noscript>
        <p>Visible<sup>1</sup><a href="#fn1">note ref</a><span epub:type="noteref">label</span> text.</p>
        <section epub:type="endnotes"><p>Hidden child endnote text.</p></section>
      </body>
    </html>
  `)

  expect(text).toBe('Visible text.')
})

test('EPUB cleanup preserves block spacing, line breaks, and table cell tabs', async () => {
  const text = await cleanEpubHtmlToText(`
    <html>
      <body>
        <p>First paragraph.</p>
        <div>Second <em>paragraph</em>.</div>
        <p>Line one<br/>Line two<br>Line three.</p>
        <table>
          <tr><th>A</th><th>B</th></tr>
          <tr><td>C</td><td>D</td></tr>
        </table>
      </body>
    </html>
  `)

  expect(text).toBe([
    'First paragraph.',
    '',
    'Second paragraph.',
    '',
    'Line one',
    'Line two',
    'Line three.',
    '',
    'A\tB',
    '',
    'C\tD'
  ].join('\n'))
})

test('EPUB cleanup decodes numeric, XML, and common EPUB named entities', async () => {
  const text = await cleanEpubHtmlToText(`
    <html><body>
      <p>A&nbsp;B &amp; C &ndash; D &mdash; E &lsquo;F&rsquo; &ldquo;G&rdquo; &hellip; &copy; &reg; &trade; &#169; &#x2014; &unknown;</p>
    </body></html>
  `)

  expect(text).toBe('A B & C – D — E ‘F’ “G” … © ® ™ © — &unknown;')
})

test('EPUB cleanup decodes dense legacy PUA Windows-1252 text content', async () => {
  const encodedText = encodeLegacyPuaText('He said “Hello” — then left...')
  const text = await cleanEpubHtmlToText(`
    <html><body>
      <p data-title="${encodedText}">${encodedText}</p>
    </body></html>
  `)

  expect(text).toBe('He said “Hello” — then left...')
})

test('EPUB cleanup decodes reversed legacy PUA byte mapping', async () => {
  const encodedText = encodeReversedLegacyPuaText('Top: H.G. Wells. “Only”')
  const text = await cleanEpubHtmlToText(`
    <html><body>
      <p>${encodedText}</p>
      <p>Chapter <span>${encodeReversedLegacyPuaText('28')}</span>:</p>
    </body></html>
  `)

  expect(text).toBe('Top: H.G. Wells. “Only”\n\nChapter 28:')
})
