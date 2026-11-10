import { extname } from 'node:path'
import type { DetectResult } from '~/types'
import { resolveConvertibleEbookFormatFromExtension } from './metadata-convertible-ebooks'

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const JPG_MAGIC = [0xff, 0xd8, 0xff]
const RTF_MAGIC = [0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31]

const hasMagic = (bytes: Uint8Array, magic: number[]): boolean => {
  if (bytes.length < magic.length) return false
  return magic.every((value, idx) => bytes[idx] === value)
}

const isTiff = (bytes: Uint8Array): boolean => {
  if (bytes.length < 4) return false
  const le = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00
  const be = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a
  return le || be
}

const isWebp = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) return false
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
}

const isBmp = (bytes: Uint8Array): boolean => {
  if (bytes.length < 2) return false
  return bytes[0] === 0x42 && bytes[1] === 0x4d
}

const isGif = (bytes: Uint8Array): boolean => {
  if (bytes.length < 6) return false
  const sig = String.fromCharCode(...Array.from(bytes.slice(0, 6)))
  return sig === 'GIF87a' || sig === 'GIF89a'
}

const isLit = (bytes: Uint8Array): boolean => {
  if (bytes.length < 8) return false
  const sig = String.fromCharCode(...Array.from(bytes.slice(0, 8)))
  return sig === 'ITOLITLS'
}

const isMobiOrAzw3 = (bytes: Uint8Array): 'mobi' | 'azw3' | null => {
  if (bytes.length < 68) return null
  const sig = String.fromCharCode(...Array.from(bytes.slice(60, 68)))
  if (sig !== 'BOOKMOBI') return null

  if (bytes.length >= 100) {
    const mobi_type = (bytes[96]! << 24) | (bytes[97]! << 16) | (bytes[98]! << 8) | bytes[99]!
    if (mobi_type === 0x00000101) return 'azw3'
  }
  return 'mobi'
}

const isFb2 = (bytes: Uint8Array): boolean => {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 512))
  return text.includes('<FictionBook')
}

const probeZipForFormat = (bytes: Uint8Array): DetectResult => {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  if (text.includes('application/epub+zip')) return 'epub'

  if (text.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')) return 'docx'
  if (text.includes('application/vnd.openxmlformats-officedocument.presentationml')) return 'pptx'
  if (text.includes('application/vnd.openxmlformats-officedocument.spreadsheetml')) return 'xlsx'
  if (text.includes('application/vnd.oasis.opendocument')) return 'odf'

  if (text.includes('mimetype') && text.includes('epub')) return 'epub'

  const hasOPF = text.includes('.opf') || text.includes('content.xml') || text.includes('META-INF')
  if (!hasOPF) {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff']
    const hasImages = imageExts.some(ext => text.toLowerCase().includes(ext))
    if (hasImages) return 'cbz'
  }

  return null
}

const isTextContent = (bytes: Uint8Array): boolean => {
  let nonText = 0
  const limit = Math.min(bytes.length, 4096)
  for (let i = 0; i < limit; i++) {
    const b = bytes[i]!
    if (b < 0x09 || (b > 0x0d && b < 0x20) || b === 0x7f) {
      nonText++
    }
  }
  return nonText / limit < 0.05
}

const EXTENSION_FALLBACK_FORMATS = new Map<string, DetectResult>([
  ['.pdf', 'pdf'],
  ['.epub', 'epub'],
  ['.docx', 'docx'],
  ['.pptx', 'pptx'],
  ['.xlsx', 'xlsx'],
  ['.odt', 'odf'],
  ['.ods', 'odf'],
  ['.odp', 'odf'],
  ['.cbz', 'cbz'],
  ['.png', 'png'],
  ['.jpg', 'jpg'],
  ['.jpeg', 'jpg'],
  ['.tif', 'tif'],
  ['.tiff', 'tif'],
  ['.webp', 'webp'],
  ['.bmp', 'bmp'],
  ['.gif', 'gif']
])

const detectImageFormatFromBytes = (bytes: Uint8Array): DetectResult => {
  if (hasMagic(bytes, PNG_MAGIC)) return 'png'
  if (hasMagic(bytes, JPG_MAGIC)) return 'jpg'
  if (isTiff(bytes)) return 'tif'
  if (isWebp(bytes)) return 'webp'
  if (isBmp(bytes)) return 'bmp'
  if (isGif(bytes)) return 'gif'
  return null
}

const detectFormatFromBytes = (bytes: Uint8Array): DetectResult => {
  if (hasMagic(bytes, PDF_MAGIC)) return 'pdf'

  if (hasMagic(bytes, RTF_MAGIC)) return 'rtf'

  if (isLit(bytes)) return 'lit'

  const mobiKind = isMobiOrAzw3(bytes)
  if (mobiKind) return mobiKind

  const imageFormat = detectImageFormatFromBytes(bytes)
  if (imageFormat) return imageFormat

  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  if (isZip) {
    const result = probeZipForFormat(bytes)
    if (result) return result
  }

  if (isFb2(bytes)) return 'fb2'

  return null
}

export const detectDocumentFormat = async (filePath: string): Promise<DetectResult> => {
  const ext = extname(filePath).toLowerCase()

  const ebookFormat = resolveConvertibleEbookFormatFromExtension(filePath)
  if (ebookFormat) return ebookFormat
  if (ext === '.rtf') return 'rtf'

  if (ext === '.csv') {
    const bytes = new Uint8Array(await Bun.file(filePath).slice(0, 4096).arrayBuffer())
    if (!isTextContent(bytes)) return null
    return 'csv'
  }

  const bytes = new Uint8Array(await Bun.file(filePath).slice(0, 4096).arrayBuffer())

  return detectFormatFromBytes(bytes) ?? EXTENSION_FALLBACK_FORMATS.get(ext) ?? null
}
