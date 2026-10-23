import { describe, expect, test } from 'bun:test'
import {
  assertHistoricalSourceBytes, assertSourceIdentity, deriveReference, HISTORICAL_NEWSPAPER_SOURCES,
  normalizeHistoricalReference, parseHistoricalPreparationMode, serializeImpactPage, serializeValidatedWikisource
} from '../../../../../src/tools/ocr-preparation/prepare-historical-newspapers'

const validated = (text: string) => `<noinclude><pagequality level="4" user="Reviewer" />{{rh|8|{{sc|History}}.|}}</noinclude>${text}`
const source = (id: string) => {
  const found = HISTORICAL_NEWSPAPER_SOURCES.find(spec => spec.id === id)
  if (!found) throw new Error('Missing expected source')
  return found
}
const region = (id: string, type: string, text: string) => `<TextRegion id="${id}" type="${type}"><Coords><Point x="5" y="10"/><Point x="50" y="30"/></Coords><TextEquiv><Unicode>${text}</Unicode></TextEquiv></TextRegion>`
const impact = (refs: string, regions: string) => `<PcGts pcGtsId="pc-00667895"><Page><ReadingOrder><OrderedGroup>${refs}</OrderedGroup></ReadingOrder>${regions}</Page></PcGts>`

describe('Historical and newspaper canonical-reference preparation, without OCR', () => {
  test('CLI exposes explicit local validation and preparation modes', () => {
    expect(parseHistoricalPreparationMode(['--validate'])).toBe('--validate')
    expect(parseHistoricalPreparationMode(['--prepare-local'])).toBe('--prepare-local')
  })
  test('CLI rejects run, provider and combined modes before loading any input', () => {
    for (const args of [['--run'], ['--all-providers'], ['--validate', '--run'], ['--prepare-local', '--provider', 'openai'], []]) {
      expect(() => parseHistoricalPreparationMode(args)).toThrow('no OCR, downloads or provider execution')
    }
  })
  test('includes publication headers, long-s, marginal number and a separate catchword', () => {
    const text = serializeValidatedWikisource(validated("{{ppoem|start=follow|end=follow|Fir{{ls}}t line {{pline|660|r}}\nNext line}}<noinclude>{{right|Catchword}}</noinclude>"))
    expect(text).toBe('8\nHISTORY.\n\n660 Firſt line\nNext line\nCatchword\n')
    expect(text).not.toContain('Next lineCatchword')
  })
  test('converts poem stanza syntax without introducing angle brackets or template controls', () => {
    const text = serializeValidatedWikisource(validated('{{ppoem|start=follow|end=follow|{{pline|3.|l}} <<< Long poem line\nAfter another}}'))
    expect(text).toContain('3. Long poem line\nAfter another')
    expect(text).not.toMatch(/<<<|start=|end=/)
  })
  test('preserves a source ligature in the main reference and folds it only in normalized text', () => {
    const text = serializeValidatedWikisource(validated('A conﬁned {{ls}}entence—“yes.”'))
    expect(text).toContain('conﬁned ſentence—“yes.”')
    expect(normalizeHistoricalReference(text)).toContain('confined sentence-"yes."')
    expect(normalizeHistoricalReference('value -12.5%')).toBe('value -12.5%\n')
  })
  test('strips link targets while retaining exact display text and meaningful punctuation', () => {
    expect(serializeValidatedWikisource(validated("The '[[w:Book title|Printed title]]', £150. &amp; 25 per cent.")))
      .toContain("The 'Printed title', £150. & 25 per cent.")
  })
  test('rejects pages lacking independent validated status', () => {
    expect(() => serializeValidatedWikisource('<pagequality level="3"/>Some text')).toThrow('validated level 4')
    expect(() => serializeValidatedWikisource('Some text')).toThrow('validated level 4')
  })
  test('rejects unknown templates and malformed markup instead of silently dropping text', () => {
    expect(() => serializeValidatedWikisource(validated('{{unreviewed|Visible word}}'))).toThrow('Unreviewed')
    expect(() => serializeValidatedWikisource(validated('{{larger|Unclosed'))).toThrow('Unbalanced')
    expect(() => serializeValidatedWikisource(validated('<ref>Footnote</ref>'))).toThrow('Unserialized')
  })
  test('keeps newspaper left-column text before the right column and retains the final notice', () => {
    const text = serializeValidatedWikisource(validated('{{hi|Left column start.}}\n{{hi|Left column end.}}\n<!-- column 2 -->\n{{center|BREVET.}}\n{{hi|Right column final notice.}}'))
    expect(text.indexOf('Left column end.')).toBeLessThan(text.indexOf('BREVET.'))
    expect(text.endsWith('Right column final notice.\n')).toBe(true)
  })
  test('PAGE XML retains otherwise unordered header/page number and joins drop capitals', () => {
    const xml = impact('<RegionRefIndexed regionRef="cap" index="0"/><RegionRefIndexed regionRef="body" index="1"/>',
      region('body', 'paragraph', 'HE House-Martin &amp; Æ.') + region('number', 'page-number', '35') + region('cap', 'drop-capital', 'T') + region('header', 'header', 'THE MARTIN'))
    const parsed = serializeImpactPage(xml)
    expect(parsed.text).toBe('THE MARTIN\n\n35\n\nTHE House-Martin & Æ.\n')
    expect(parsed.regions.map(r => r.id)).toEqual(['header', 'number', 'cap', 'body'])
  })
  test('rejects wrong XML leaves, duplicate sequence indexes and dangling layout pointers', () => {
    expect(() => serializeImpactPage(impact('', '').replace('pc-00667895', 'pc-OTHER'))).toThrow('identity')
    expect(() => serializeImpactPage(impact('<RegionRefIndexed regionRef="a" index="0"/><RegionRefIndexed regionRef="b" index="0"/>', region('a', 'paragraph', 'A') + region('b', 'paragraph', 'B')))).toThrow('reading order')
    expect(() => serializeImpactPage(impact('<RegionRefIndexed regionRef="missing" index="0"/>', ''))).toThrow('Missing')
  })
  test('rejects omitted body regions and orphaned drop capitals', () => {
    expect(() => serializeImpactPage(impact('', region('p', 'paragraph', 'Visible but omitted')))).toThrow('Unordered')
    expect(() => serializeImpactPage(impact('<RegionRefIndexed regionRef="cap" index="0"/>', region('cap', 'drop-capital', 'T')))).toThrow('Orphan')
  })
  test('fails closed on a known-bad full-page reference rather than producing gold', () => {
    expect(() => deriveReference(source('G1'), validated('Wakerley'))).toThrow('must remain blocked')
  })
  test('applies only the documented newspaper review errata and fails if their source anchor changes', () => {
    expect(deriveReference(source('G3'), 'glaring a non sequilur as could have been urged!')).toBe('glaring a non sequitur as could have been urged!\n')
    expect(deriveReference(source('G4'), 'hension of tho often arduous and intricate duties')).toBe('hension of the often arduous and intricate duties\n')
    expect(() => deriveReference(source('G3'), 'Changed source')).toThrow('anchor changed')
    expect(() => deriveReference(source('G4'), 'Changed source')).toThrow('anchor changed')
  })
  test('does not rewrite historical spelling or join published newspaper line-end hyphens', () => {
    expect(deriveReference(source('G6'), 'shew in pro-\nducing a lamb;')).toBe('shew in pro-\nducing a lamb;\n')
  })
  test('rejects a neighboring scan leaf even when the book and text revision match', () => {
    const spec = source('C2')
    const metadata = { revision: spec.revision, leaf: 11, sourceImageName: `${spec.file}/11` }
    expect(() => assertSourceIdentity(spec, metadata)).not.toThrow()
    expect(() => assertSourceIdentity(spec, { ...metadata, leaf: 12 })).toThrow('identity mismatch')
    expect(() => assertSourceIdentity(spec, { ...metadata, revision: 'CURRENT' })).toThrow('identity mismatch')
  })
  test('rejects a different region from the same newspaper page', () => {
    const spec = source('G6')
    const metadata = { revision: spec.revision, sourceImageName: spec.imageMember! }
    expect(() => assertSourceIdentity(spec, metadata)).not.toThrow()
    expect(() => assertSourceIdentity(spec, { ...metadata, sourceImageName: metadata.sourceImageName.replace('B0C1R2', 'B0C1R3') })).toThrow('identity mismatch')
  })
  test('source integrity rejects swapped, truncated and entirely unknown source pairs', () => {
    const bytes = new TextEncoder().encode('Wrong or truncated artifact')
    expect(() => assertHistoricalSourceBytes('C1', bytes, bytes)).toThrow('Pinned')
    expect(() => assertHistoricalSourceBytes('G6', bytes, bytes)).toThrow('Pinned')
    expect(() => assertHistoricalSourceBytes('UNKNOWN', bytes, bytes)).toThrow('Pinned')
  })
})
