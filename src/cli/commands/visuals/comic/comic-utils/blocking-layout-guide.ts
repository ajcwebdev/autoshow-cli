import { deflateSync } from 'node:zlib'
import type { CompiledBlockingLedgerEntry, CompiledPanelBlocking } from '~/types'

export const DENSE_BLOCKING_LAYOUT_GUIDE_MIN_CHARACTERS = 6

const WIDTH = 1536
const HEIGHT = 1024
const BYTES_PER_PIXEL = 4
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MARKER_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [215, 72, 72],
  [55, 126, 184],
  [76, 153, 92],
  [229, 159, 54],
  [133, 91, 176],
  [48, 160, 160],
  [206, 93, 145],
  [118, 121, 126],
  [156, 119, 65],
  [92, 111, 192],
  [169, 79, 65],
  [66, 142, 119],
]

const DIGITS: Readonly<Record<string, readonly string[]>> = {
  '0': ['111', '101', '101', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '010', '010', '111'],
  '2': ['111', '001', '001', '111', '100', '100', '111'],
  '3': ['111', '001', '001', '111', '001', '001', '111'],
  '4': ['101', '101', '101', '111', '001', '001', '001'],
  '5': ['111', '100', '100', '111', '001', '001', '111'],
  '6': ['111', '100', '100', '111', '101', '101', '111'],
  '7': ['111', '001', '001', '010', '010', '010', '010'],
  '8': ['111', '101', '101', '111', '101', '101', '111'],
  '9': ['111', '101', '101', '111', '001', '001', '111'],
}

type Color = readonly [number, number, number]
type Point = { x: number; y: number }

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let value = n
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[n] = value >>> 0
  }
  return table
})()

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const pngChunk = (type: string, data: Uint8Array): Buffer => {
  const typeBytes = Buffer.from(type, 'ascii')
  const body = Buffer.from(data)
  const chunk = Buffer.allocUnsafe(12 + body.length)
  chunk.writeUInt32BE(body.length, 0)
  typeBytes.copy(chunk, 4)
  body.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, body])), 8 + body.length)
  return chunk
}

const encodePng = (pixels: Uint8Array): Uint8Array => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(WIDTH, 0)
  header.writeUInt32BE(HEIGHT, 4)
  header[8] = 8
  header[9] = 6
  const stride = WIDTH * BYTES_PER_PIXEL
  const scanlines = Buffer.allocUnsafe((stride + 1) * HEIGHT)
  for (let y = 0; y < HEIGHT; y++) {
    const rowStart = y * (stride + 1)
    scanlines[rowStart] = 0
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(scanlines, rowStart + 1)
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const setPixel = (pixels: Uint8Array, x: number, y: number, color: Color, alpha = 255): void => {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) return
  const offset = (py * WIDTH + px) * BYTES_PER_PIXEL
  pixels[offset] = color[0]
  pixels[offset + 1] = color[1]
  pixels[offset + 2] = color[2]
  pixels[offset + 3] = alpha
}

const fillRect = (pixels: Uint8Array, x: number, y: number, width: number, height: number, color: Color): void => {
  const startX = Math.max(0, Math.floor(x))
  const startY = Math.max(0, Math.floor(y))
  const endX = Math.min(WIDTH, Math.ceil(x + width))
  const endY = Math.min(HEIGHT, Math.ceil(y + height))
  for (let py = startY; py < endY; py++) for (let px = startX; px < endX; px++) setPixel(pixels, px, py, color)
}

const drawLine = (pixels: Uint8Array, from: Point, to: Point, color: Color, width = 5): void => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))
  const radius = Math.floor(width / 2)
  for (let step = 0; step <= steps; step++) {
    const x = from.x + dx * step / steps
    const y = from.y + dy * step / steps
    fillRect(pixels, x - radius, y - radius, width, width, color)
  }
}

const fillCircle = (pixels: Uint8Array, center: Point, radius: number, color: Color): void => {
  const radiusSquared = radius * radius
  for (let y = -radius; y <= radius; y++) {
    const span = Math.floor(Math.sqrt(radiusSquared - y * y))
    fillRect(pixels, center.x - span, center.y + y, span * 2 + 1, 1, color)
  }
}

const drawNumber = (pixels: Uint8Array, value: number, center: Point, markerRadius: number): void => {
  const digits = String(value).split('')
  const scale = Math.max(4, Math.floor(markerRadius / 7))
  const glyphWidth = 3 * scale
  const gap = scale
  const totalWidth = digits.length * glyphWidth + (digits.length - 1) * gap
  const startX = Math.round(center.x - totalWidth / 2)
  const startY = Math.round(center.y - 7 * scale / 2)
  digits.forEach((digit, digitIndex) => {
    const rows = DIGITS[digit]!
    rows.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length; column++) {
        if (row[column] === '1') fillRect(pixels, startX + digitIndex * (glyphWidth + gap) + column * scale, startY + rowIndex * scale, scale, scale, [255, 255, 255])
      }
    })
  })
}

const facingVector = (entry: CompiledBlockingLedgerEntry): Point => {
  if (entry.facing === 'toward-camera') return { x: 0, y: 1 }
  if (entry.facing === 'away-from-camera') return { x: 0, y: -1 }
  if (entry.facing === 'profile-screen-left') return { x: -1, y: 0 }
  return { x: 1, y: 0 }
}

const markerRadius = (entry: CompiledBlockingLedgerEntry): number => entry.depthBand === 'foreground' ? 46 : entry.depthBand === 'midground' ? 38 : 30

const markerY = (entry: CompiledBlockingLedgerEntry): number => entry.depthBand === 'foreground' ? 794 : entry.depthBand === 'midground' ? 512 : 230

const positionsForLedger = (ledger: readonly CompiledBlockingLedgerEntry[]): Map<string, Point> => {
  const positions = new Map<string, Point>()
  for (const depthBand of ['foreground', 'midground', 'background'] as const) {
    for (const screenSide of ['left', 'center', 'right'] as const) {
      const group = ledger.filter(entry => entry.depthBand === depthBand && entry.screenSide === screenSide).sort((left, right) => left.lateral - right.lateral || left.characterKey.localeCompare(right.characterKey))
      if (group.length === 0) continue
      const range = screenSide === 'left' ? [100, 460] : screenSide === 'center' ? [580, 956] : [1076, 1436]
      group.forEach((entry, index) => {
        const twoRows = group.length > 4
        const columns = twoRows ? Math.ceil(group.length / 2) : group.length
        const row = twoRows ? Math.floor(index / columns) : 0
        const column = twoRows ? index % columns : index
        const rowSize = twoRows && row === 1 ? group.length - columns : columns
        const x = rowSize === 1 ? (range[0]! + range[1]!) / 2 : range[0]! + (range[1]! - range[0]!) * column / (rowSize - 1)
        const y = markerY(entry) + (twoRows ? row === 0 ? -52 : 52 : 0)
        positions.set(entry.characterKey, { x, y })
      })
    }
  }
  return positions
}

const drawMarker = (pixels: Uint8Array, entry: CompiledBlockingLedgerEntry, index: number, center: Point): void => {
  const radius = markerRadius(entry)
  const color = MARKER_COLORS[index % MARKER_COLORS.length]!
  if (entry.posture === 'standing') {
    fillRect(pixels, center.x - radius * 0.45, center.y + radius * 0.55, radius * 0.9, radius * 1.25, color)
  } else if (entry.posture === 'seated') {
    drawLine(pixels, { x: center.x, y: center.y + radius * 0.55 }, { x: center.x, y: center.y + radius * 1.2 }, color, 14)
    drawLine(pixels, { x: center.x, y: center.y + radius * 1.2 }, { x: center.x + radius * 0.7, y: center.y + radius * 1.2 }, color, 14)
    drawLine(pixels, { x: center.x + radius * 0.7, y: center.y + radius * 1.2 }, { x: center.x + radius * 0.7, y: center.y + radius * 1.75 }, color, 14)
  } else if (entry.posture === 'kneeling') {
    drawLine(pixels, { x: center.x, y: center.y + radius * 0.55 }, { x: center.x, y: center.y + radius * 1.15 }, color, 14)
    drawLine(pixels, { x: center.x, y: center.y + radius * 1.15 }, { x: center.x + radius * 0.65, y: center.y + radius * 1.5 }, color, 14)
  } else if (entry.posture === 'crouching') {
    drawLine(pixels, { x: center.x, y: center.y + radius * 0.55 }, { x: center.x + radius * 0.5, y: center.y + radius * 1.05 }, color, 14)
    drawLine(pixels, { x: center.x + radius * 0.5, y: center.y + radius * 1.05 }, { x: center.x - radius * 0.25, y: center.y + radius * 1.4 }, color, 14)
  } else if (entry.posture === 'lying') {
    drawLine(pixels, { x: center.x - radius * 0.9, y: center.y + radius * 0.85 }, { x: center.x + radius * 1.6, y: center.y + radius * 0.85 }, color, 16)
  } else if (entry.posture === 'leaning') {
    drawLine(pixels, { x: center.x, y: center.y + radius * 0.55 }, { x: center.x + radius * 0.75, y: center.y + radius * 1.55 }, color, 16)
  }
  fillCircle(pixels, center, radius + 7, [32, 32, 32])
  fillCircle(pixels, center, radius, color)
  drawNumber(pixels, index + 1, center, radius)
  const vector = facingVector(entry)
  const arrowStart = { x: center.x + vector.x * (radius + 12), y: center.y + vector.y * (radius + 12) }
  const arrowEnd = { x: center.x + vector.x * (radius + 42), y: center.y + vector.y * (radius + 42) }
  drawLine(pixels, arrowStart, arrowEnd, [25, 25, 25], 9)
  const perpendicular = { x: -vector.y, y: vector.x }
  drawLine(pixels, arrowEnd, { x: arrowEnd.x - vector.x * 16 + perpendicular.x * 12, y: arrowEnd.y - vector.y * 16 + perpendicular.y * 12 }, [25, 25, 25], 7)
  drawLine(pixels, arrowEnd, { x: arrowEnd.x - vector.x * 16 - perpendicular.x * 12, y: arrowEnd.y - vector.y * 16 - perpendicular.y * 12 }, [25, 25, 25], 7)
}

export const shouldUseBlockingLayoutGuide = (blocking: CompiledPanelBlocking | undefined): boolean =>
  (blocking?.ledger.length ?? 0) >= DENSE_BLOCKING_LAYOUT_GUIDE_MIN_CHARACTERS

export const describeBlockingLayoutGuideMarkers = (blocking: CompiledPanelBlocking): string => blocking.ledger.map((entry, index) =>
  `${index + 1}=${entry.characterKey} (${entry.screenSide}, ${entry.depthBand}, ${entry.posture}, ${entry.facing}${entry.frame === 'edge' ? ', frame edge' : ''})`
).join('; ')

export const renderBlockingLayoutGuidePng = (blocking: CompiledPanelBlocking): Uint8Array => {
  const pixels = new Uint8Array(WIDTH * HEIGHT * BYTES_PER_PIXEL)
  fillRect(pixels, 0, 0, WIDTH, HEIGHT, [247, 244, 238])
  fillRect(pixels, 64, 92, WIDTH - 128, 242, [229, 234, 240])
  fillRect(pixels, 64, 390, WIDTH - 128, 242, [235, 239, 226])
  fillRect(pixels, 64, 688, WIDTH - 128, 242, [243, 231, 219])
  drawLine(pixels, { x: 64, y: 362 }, { x: WIDTH - 64, y: 362 }, [92, 92, 92], 4)
  drawLine(pixels, { x: 64, y: 660 }, { x: WIDTH - 64, y: 660 }, [92, 92, 92], 4)
  drawLine(pixels, { x: WIDTH / 3, y: 64 }, { x: WIDTH / 3, y: HEIGHT - 64 }, [178, 178, 178], 3)
  drawLine(pixels, { x: WIDTH * 2 / 3, y: 64 }, { x: WIDTH * 2 / 3, y: HEIGHT - 64 }, [178, 178, 178], 3)
  const positions = positionsForLedger(blocking.ledger)
  blocking.ledger.forEach((entry, index) => drawMarker(pixels, entry, index, positions.get(entry.characterKey)!))
  return encodePng(pixels)
}
