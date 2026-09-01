import { describe, expect, test } from 'bun:test'
import { parsePodcastFeedXml } from '~/cli/commands/process-steps/step-0-metadata/metadata-sources/metadata-podcast-rss'
import { findOrderedXmlElements, orderedXmlText, parseOrderedXml } from '~/utils/bun-xml-adapter'
import { firstTagAttr, firstTagText, scanTagBlocks } from '~/utils/xml-scan'

describe('Bun.XML parity adapter evaluation', () => {
  test('preserves namespaces, attributes, CDATA, comments, processing instructions, entities, and mixed order', () => {
    const xml = '<?xml version="1.0"?><rss xmlns:itunes="urn:itunes"><item id="one"><title>A &amp; B &#x1F642;</title><![CDATA[ tail ]]><!-- note --><?autoshow keep?><itunes:duration>01:02</itunes:duration></item></rss>'
    const root = parseOrderedXml(xml)
    const item = findOrderedXmlElements(root, 'item')[0]
    const title = findOrderedXmlElements(root, 'title')[0]
    const duration = findOrderedXmlElements(root, 'itunes:duration')[0]

    expect(root).toMatchObject({ name: 'rss', attributes: { 'xmlns:itunes': 'urn:itunes' } })
    expect(item?.attributes).toEqual({ id: 'one' })
    expect(title && orderedXmlText(title)).toBe('A & B 🙂')
    expect(duration && orderedXmlText(duration)).toBe('01:02')
    expect(item?.children).toContain(' tail ')
    expect(item?.children).toContainEqual({ comment: ' note ' })
    expect(item?.children).toContainEqual({ target: 'autoshow', data: 'keep' })
  })

  test('matches scanner results for stable RSS and Atom call-site fields', () => {
    const rss = '<rss><channel><title>Feed</title><link>https://example.test</link><item><guid>ep-1</guid><title>Episode</title><description><![CDATA[Summary]]></description><enclosure url="https://example.test/ep.mp3" type="audio/mpeg"/></item></channel></rss>'
    const parsedFeed = parsePodcastFeedXml(rss)
    const root = parseOrderedXml(rss)
    const item = findOrderedXmlElements(root, 'item')[0]
    const title = item && findOrderedXmlElements(item, 'title')[0]
    const enclosure = item && findOrderedXmlElements(item, 'enclosure')[0]
    expect(parsedFeed?.episodes[0]).toMatchObject({ id: 'ep-1', title: title && orderedXmlText(title) })
    expect(parsedFeed?.episodes[0]?.enclosureUrl).toBe(enclosure?.attributes['url'])
    expect(firstTagText(rss, 'title')).toBe(orderedXmlText(findOrderedXmlElements(root, 'title')[0]!))
    expect(firstTagAttr(rss, 'enclosure', 'url')).toBe(enclosure?.attributes['url'])

    const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><entry><id>a-1</id><title>Entry</title><link rel="enclosure" href="https://example.test/a.mp3" type="audio/mpeg"/></entry></feed>'
    expect(parsePodcastFeedXml(atom)?.episodes[0]).toMatchObject({ id: 'a-1', enclosureUrl: 'https://example.test/a.mp3' })
    expect(findOrderedXmlElements(parseOrderedXml(atom), 'link')[0]?.attributes['rel']).toBe('enclosure')
  })

  test('covers repeated, self-closing, Office, ODF, EPUB, and namespace shapes', () => {
    const corpus = [
      { xml: '<root><value/><value>two</value></root>', counts: { value: 2 } },
      { xml: '<w:document xmlns:w="urn:w"><w:p><w:r><w:t>DOCX</w:t></w:r></w:p></w:document>', counts: { 'w:p': 1, 'w:r': 1, 'w:t': 1 } },
      { xml: '<p:presentation xmlns:p="urn:p" xmlns:a="urn:a"><p:sld><a:p><a:r><a:t>PPTX</a:t></a:r></a:p></p:sld></p:presentation>', counts: { 'p:sld': 1, 'a:p': 1, 'a:r': 1, 'a:t': 1 } },
      { xml: '<worksheet><sheetData><row><c t="s"><v>0</v></c></row></sheetData></worksheet>', counts: { sheetData: 1, row: 1, c: 1, v: 1 } },
      { xml: '<office:document-content xmlns:office="urn:o" xmlns:text="urn:t"><office:body><text:p>ODF</text:p></office:body></office:document-content>', counts: { 'office:body': 1, 'text:p': 1 } },
      { xml: '<package xmlns:dc="urn:dc"><metadata><dc:title>EPUB</dc:title></metadata><manifest><item id="chapter" href="one.xhtml" media-type="application/xhtml+xml"/></manifest></package>', counts: { metadata: 1, 'dc:title': 1, manifest: 1, item: 1 } }
    ]
    for (const entry of corpus) {
      const root = parseOrderedXml(entry.xml)
      expect(Object.fromEntries(Object.keys(entry.counts).map((name) => [name, findOrderedXmlElements(root, name).length]))).toEqual(entry.counts)
    }
  })

  test('bounds input size, node count, and depth before exposing native results', () => {
    expect(() => parseOrderedXml(`<root>${'x'.repeat(100)}</root>`, { maxBytes: 32 })).toThrow('byte limit')
    expect(() => parseOrderedXml('<root><a/><b/></root>', { maxNodes: 2 })).toThrow('node limit')
    expect(() => parseOrderedXml('<root><a><b/></a></root>', { maxDepth: 2 })).toThrow('depth limit')
  })

  test('retains the scanner because native strictness and mixed-content text are not parity-compatible', () => {
    const malformed = '<root><item>kept</item><unclosed></root>'
    expect(scanTagBlocks(malformed, 'item')).toEqual(['<item>kept</item>'])
    expect(() => parseOrderedXml(malformed)).toThrow('malformed or unsupported')

    const mixed = '<p>Hi <b>you</b>!</p>'
    expect(firstTagText(mixed, 'p')).toBe('Hi <b>you</b>!')
    expect(orderedXmlText(parseOrderedXml(mixed))).toBe('Hi you!')
  })
})
