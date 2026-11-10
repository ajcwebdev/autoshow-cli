import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { detectDocumentFormat } from '~/cli/commands/sources/metadata/formats/metadata-detect-format'
import { withTempDir } from '../../../../test-utils/temp-dirs'

const ascii = (value: string): number[] => [...value].map(character => character.charCodeAt(0))

const mobiHeader = (mobiType: number): number[] => {
  const bytes = new Array<number>(100).fill(0)
  ascii('BOOKMOBI').forEach((value, index) => { bytes[60 + index] = value })
  bytes[98] = (mobiType >> 8) & 0xff
  bytes[99] = mobiType & 0xff
  return bytes
}

const detect = async (name: string, bytes: number[]): Promise<string | null> =>
  await withTempDir('autoshow-detect-format-', async (dir) => {
    const filePath = join(dir, name)
    await Bun.write(filePath, new Uint8Array(bytes))
    return await detectDocumentFormat(filePath)
  })

describe('document format detection contracts', () => {
  test('convertible ebook, RTF, and CSV extensions resolve before content sniffing', async () => {
    expect(await detect('book.mobi', ascii('%PDF-1.7'))).toBe('mobi')
    expect(await detect('book.PRC', ascii('%PDF-1.7'))).toBe('mobi')
    expect(await detect('book.azw', [])).toBe('azw3')
    expect(await detect('notes.rtf', ascii('%PDF-1.7'))).toBe('rtf')
    expect(await detect('table.csv', ascii('a,b\n1,2\n'))).toBe('csv')
    expect(await detect('table.csv', [0, 1, 2, 3, 4, 5, 6, 7])).toBeNull()
  })

  test('magic bytes take precedence over the file extension', async () => {
    expect(await detect('scan.png', ascii('%PDF-1.7'))).toBe('pdf')
    expect(await detect('doc.pdf', ascii('{\\rtf1\\ansi'))).toBe('rtf')
    expect(await detect('doc.pdf', ascii('ITOLITLS-rest'))).toBe('lit')
    expect(await detect('doc.pdf', mobiHeader(2))).toBe('mobi')
    expect(await detect('doc.pdf', mobiHeader(0x101))).toBe('azw3')
    expect(await detect('doc.pdf', [0x89, 0x50, 0x4e, 0x47, 0x0d])).toBe('png')
    expect(await detect('doc.pdf', [0xff, 0xd8, 0xff, 0xe0])).toBe('jpg')
    expect(await detect('doc.pdf', [0x49, 0x49, 0x2a, 0x00])).toBe('tif')
    expect(await detect('doc.pdf', [0x4d, 0x4d, 0x00, 0x2a])).toBe('tif')
    expect(await detect('doc.pdf', [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')])).toBe('webp')
    expect(await detect('doc.pdf', ascii('BM-bitmap'))).toBe('bmp')
    expect(await detect('doc.pdf', ascii('GIF89a-data'))).toBe('gif')
    expect(await detect('doc.pdf', ascii('<?xml version="1.0"?><FictionBook>'))).toBe('fb2')
  })

  test('ZIP containers are probed for their document family', async () => {
    expect(await detect('a.bin', ascii('PK..mimetypeapplication/epub+zip'))).toBe('epub')
    expect(await detect('a.bin', ascii('PK..application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe('docx')
    expect(await detect('a.bin', ascii('PK..application/vnd.openxmlformats-officedocument.presentationml.x'))).toBe('pptx')
    expect(await detect('a.bin', ascii('PK..application/vnd.openxmlformats-officedocument.spreadsheetml.x'))).toBe('xlsx')
    expect(await detect('a.bin', ascii('PK..application/vnd.oasis.opendocument.text'))).toBe('odf')
    expect(await detect('a.bin', ascii('PK..page-001.JPG'))).toBe('cbz')
    expect(await detect('a.bin', ascii('PK..META-INF/page-001.jpg'))).toBeNull()
    expect(await detect('a.docx', ascii('PK..unrecognised'))).toBe('docx')
  })

  test('unrecognised content falls back to the extension', async () => {
    const plain = ascii('plain text body')
    const expected: Record<string, string | null> = {
      '.pdf': 'pdf', '.epub': 'epub', '.docx': 'docx', '.pptx': 'pptx', '.xlsx': 'xlsx',
      '.odt': 'odf', '.ods': 'odf', '.odp': 'odf', '.cbz': 'cbz',
      '.png': 'png', '.jpg': 'jpg', '.JPEG': 'jpg', '.tif': 'tif', '.tiff': 'tif',
      '.webp': 'webp', '.bmp': 'bmp', '.gif': 'gif', '.txt': null, '': null
    }
    for (const [extension, format] of Object.entries(expected)) {
      expect(await detect(`file${extension}`, plain)).toBe(format)
    }
  })
})
