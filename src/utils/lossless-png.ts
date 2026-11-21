import { AppValidationError } from '~/utils/error-handler'
import { constants, deflateSync, inflateSync } from 'node:zlib'

const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)
const sha256 = (bytes: Uint8Array): string => new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
const equal = (left: Uint8Array, right: Uint8Array): boolean => left.length === right.length && left.every((byte, i) => byte === right[i])
const maximumPixels = 64 * 1024 * 1024
const paeth = (left: number, above: number, corner: number): number => {
  const estimate = left + above - corner, a = Math.abs(estimate - left), b = Math.abs(estimate - above), c = Math.abs(estimate - corner)
  return a <= b && a <= c ? left : b <= c ? above : corner
}
interface Chunk { type: string, data: Uint8Array }
interface ScanlineGeometry { width: number, height: number, channels: number, stride: number }
interface PngColorModel { color: number, palette: Uint8Array | undefined, transparency: Uint8Array | undefined, transparent: DataView | undefined }

const assertSupportedChunkType = (type: string): void => {
  if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') throw new AppValidationError('Animated PNG lossless normalization is unsupported')
  if (type[0] === type[0]!.toUpperCase() && !['IHDR', 'PLTE', 'IDAT', 'IEND'].includes(type)) throw new AppValidationError('Unsupported critical PNG chunk')
}
export const readPngChunks = (bytes: Uint8Array, validateType?: (type: string) => void): Chunk[] => {
  if (!equal(bytes.subarray(0, 8), signature)) throw new AppValidationError('Invalid PNG signature')
  const result: Chunk[] = []
  let offset = 8, ended = false
  while (offset + 12 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset), length = view.getUint32(0)
    if (offset + length + 12 > bytes.length) throw new AppValidationError('Truncated PNG chunk')
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString('ascii')
    if (!/^[A-Za-z]{4}$/.test(type) || Bun.hash.crc32(bytes.subarray(offset + 4, offset + length + 8)) !== view.getUint32(length + 8)) throw new AppValidationError('Invalid PNG chunk checksum/type')
    validateType?.(type)
    result.push({ type, data: bytes.subarray(offset + 8, offset + length + 8) })
    offset += length + 12
    if (type === 'IEND') { ended = true; break }
  }
  if (!ended || offset !== bytes.length || result[0]?.type !== 'IHDR' || result.filter(c => c.type === 'IHDR').length !== 1
    || result.at(-1)?.data.length !== 0) throw new AppValidationError('Invalid PNG chunk framing')
  return result
}

const readPngHeader = (header: Uint8Array): ScanlineGeometry & { color: number } => {
  if (header.length !== 13) throw new AppValidationError('Invalid PNG header')
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength), width = view.getUint32(0), height = view.getUint32(4), color = header[9]!
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color]
  if (!width || !height || width * height > maximumPixels || header[8] !== 8 || !channels || header[10] !== 0 || header[11] !== 0 || header[12] !== 0) throw new AppValidationError('Lossless normalization supports only bounded noninterlaced 8-bit PNGs')
  return { width, height, channels, stride: width * channels, color }
}

const inflateScanlines = (records: readonly Chunk[], geometry: ScanlineGeometry): Uint8Array => {
  const idat = records.filter(c => c.type === 'IDAT')
  if (!idat.length || records.filter(c => c.type === 'PLTE').length > 1 || records.filter(c => c.type === 'tRNS').length > 1) throw new AppValidationError('Missing/duplicate PNG image data')
  const size = geometry.height * (geometry.stride + 1)
  const inflated = inflateSync(Buffer.concat(idat.map(c => c.data)), { maxOutputLength: size })
  if (inflated.length !== size) throw new AppValidationError('PNG scanline size mismatch')
  return inflated
}

const unfilterScanlines = (inflated: Uint8Array, geometry: ScanlineGeometry): Uint8Array => {
  const { height, stride, channels } = geometry
  const samples = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)]!
    if (filter > 4) throw new AppValidationError('Invalid PNG row filter')
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, left = x >= channels ? samples[index - channels]! : 0, above = y ? samples[index - stride]! : 0,
        corner = y && x >= channels ? samples[index - stride - channels]! : 0
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, corner)
      samples[index] = (inflated[y * (stride + 1) + x + 1]! + predictor) & 255
    }
  }
  return samples
}

const invalidPalette = (color: number, palette: Uint8Array | undefined): boolean | number =>
  color === 3 && (!palette?.length || palette.length % 3 || palette.length > 768)

const invalidTransparency = (color: number, palette: Uint8Array | undefined, transparency: Uint8Array | undefined): boolean | undefined =>
  transparency && (color === 0 && transparency.length !== 2 || color === 2 && transparency.length !== 6 || color === 3 && transparency.length > (palette?.length ?? 0) / 3 || color === 4 || color === 6)

const readPngColorModel = (records: readonly Chunk[], color: number): PngColorModel => {
  const palette = records.find(c => c.type === 'PLTE')?.data, transparency = records.find(c => c.type === 'tRNS')?.data
  if (invalidPalette(color, palette) || invalidTransparency(color, palette, transparency)) throw new AppValidationError('Invalid PNG palette/transparency')
  const transparent = transparency ? new DataView(transparency.buffer, transparency.byteOffset, transparency.byteLength) : undefined
  return { color, palette, transparency, transparent }
}

// Adam7 passes in transmission order (starting column, starting row, horizontal and vertical step).
const adam7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] as const

const stillImageData = (chunks: Chunk[], color: number, depth: number): Buffer => {
  const idat = chunks.filter(chunk => chunk.type === 'IDAT')
  const first = chunks.findIndex(chunk => chunk.type === 'IDAT')
  const last = chunks.findLastIndex(chunk => chunk.type === 'IDAT')
  if (!idat.length || last - first + 1 !== idat.length) throw new AppValidationError('Missing or nonconsecutive PNG image data')
  const palette = chunks.findIndex(chunk => chunk.type === 'PLTE')
  const transparency = chunks.findIndex(chunk => chunk.type === 'tRNS')
  if (palette !== chunks.findLastIndex(chunk => chunk.type === 'PLTE') || transparency !== chunks.findLastIndex(chunk => chunk.type === 'tRNS')
    || palette > first || transparency > first || (transparency >= 0 && palette > transparency)) throw new AppValidationError('Invalid PNG palette/transparency order')
  if (palette >= 0) {
    const size = chunks[palette]!.data.length
    if (color === 0 || color === 4 || !size || size > 768 || size % 3 || (color === 3 && size / 3 > 2 ** depth)) throw new AppValidationError('Invalid PNG palette')
  }
  return Buffer.concat(idat.map(chunk => chunk.data))
}

/** Decode packed sample rows for all legal still PNG color/depth combinations without allocating an RGBA canvas. */
export const verifyPngSamples = (bytes: Uint8Array): { width: number, height: number } => {
  const chunks = readPngChunks(bytes, assertSupportedChunkType)
  const header = chunks[0]!.data
  if (header.length !== 13) throw new AppValidationError('Invalid PNG header')
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  const width = view.getUint32(0), height = view.getUint32(4), depth = header[8]!, color = header[9]!
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color]
  const depths = color === 0 ? [1, 2, 4, 8, 16] : color === 3 ? [1, 2, 4, 8] : [8, 16]
  if (!width || !height || width * height > maximumPixels || !channels || !depths.includes(depth)
    || header[10] !== 0 || header[11] !== 0 || header[12]! > 1) throw new AppValidationError('Invalid or oversized PNG header')
  const model = readPngColorModel(chunks, color)
  const compressed = stillImageData(chunks, color, depth)
  const bits = channels * depth
  const passes = header[12] ? adam7 : [[0, 0, 1, 1] as const]
  const geometries = passes.map(([x, y, dx, dy]) => {
    const columns = Math.max(0, Math.ceil((width - x) / dx))
    return { width: columns, height: Math.max(0, Math.ceil((height - y) / dy)), channels: Math.ceil(bits / 8), stride: Math.ceil(columns * bits / 8) }
  }).filter(pass => pass.width && pass.height)
  const size = geometries.reduce((sum, pass) => sum + pass.height * (pass.stride + 1), 0)
  const inflated = inflateSync(compressed, { maxOutputLength: size })
  if (inflated.length !== size) throw new AppValidationError('PNG scanline size mismatch')
  let offset = 0
  for (const pass of geometries) {
    const samples = unfilterScanlines(inflated.subarray(offset), pass)
    offset += pass.height * (pass.stride + 1)
    if (color !== 3) continue
    const entries = model.palette!.length / 3
    for (let y = 0; y < pass.height; y++) {
      for (let x = 0; x < pass.width; x++) {
        const bit = x * depth
        const packed = samples[y * pass.stride + Math.floor(bit / 8)]!
        const index = (packed >> (8 - depth - bit % 8)) & ((1 << depth) - 1)
        if (index >= entries) throw new AppValidationError('PNG palette index outside palette')
      }
    }
  }
  return { width, height }
}

const grayRgba = (samples: Uint8Array, source: number, { color, transparent }: PngColorModel): number[] => {
  const gray = samples[source]!
  return [gray, gray, gray, color === 4 ? samples[source + 1]! : transparent?.getUint16(0) === gray ? 0 : 255]
}

const rgbRgba = (samples: Uint8Array, source: number, { color, transparent }: PngColorModel): number[] => {
  const r = samples[source]!, g = samples[source + 1]!, b = samples[source + 2]!
  return [r, g, b, color === 6 ? samples[source + 3]! : transparent && transparent.getUint16(0) === r && transparent.getUint16(2) === g && transparent.getUint16(4) === b ? 0 : 255]
}

const paletteRgba = (samples: Uint8Array, source: number, { palette, transparency }: PngColorModel): number[] => {
  const index = samples[source]!
  if (index * 3 + 2 >= palette!.length) throw new AppValidationError('PNG palette index outside palette')
  return [palette![index * 3]!, palette![index * 3 + 1]!, palette![index * 3 + 2]!, transparency?.[index] ?? 255]
}

const expandToRgba8 = (samples: Uint8Array, geometry: ScanlineGeometry, model: PngColorModel): Uint8Array => {
  const { width, height, channels } = geometry, { color } = model
  const toRgba = color === 0 || color === 4 ? grayRgba : color === 2 || color === 6 ? rgbRgba : paletteRgba
  const pixels = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i++) pixels.set(toRgba(samples, i * channels, model), i * 4)
  return pixels
}

/** Exact RGBA8 samples, row-major, with no color transform or premultiplication. Unsupported PNG encodings fail closed. */
export const decodePngRgba8 = (bytes: Uint8Array) => {
  const records = readPngChunks(bytes, assertSupportedChunkType), geometry = readPngHeader(records[0]!.data)
  const samples = unfilterScanlines(inflateScanlines(records, geometry), geometry)
  const pixels = expandToRgba8(samples, geometry, readPngColorModel(records, geometry.color))
  const { width, height } = geometry
  return { width, height, pixels, pixelSha256: sha256(pixels) }
}

const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const output = new Uint8Array(data.length + 12), view = new DataView(output.buffer)
  view.setUint32(0, data.length); output.set(Buffer.from(type), 4); output.set(data, 8)
  view.setUint32(data.length + 8, Bun.hash.crc32(output.subarray(4, data.length + 8)))
  return output
}

export const assertPngPixelIdentity = (original: Uint8Array, transport: Uint8Array): void => {
  const expected = decodePngRgba8(original), actual = decodePngRgba8(transport)
  if (expected.width !== actual.width || expected.height !== actual.height || !equal(expected.pixels, actual.pixels)) throw new AppValidationError('PNG transport changed decoded pixels')
}

const detectRedundantChannels = (pixels: Uint8Array): { gray: boolean, opaque: boolean } => {
  let gray = true, opaque = true
  for (let i = 0; i < pixels.length; i += 4) { if (pixels[i] !== pixels[i + 1] || pixels[i] !== pixels[i + 2]) gray = false; if (pixels[i + 3] !== 255) opaque = false }
  return { gray, opaque }
}

const transportColorType = (gray: boolean, opaque: boolean): { color: number, channels: number } =>
  ({ color: gray ? opaque ? 0 : 4 : opaque ? 2 : 6, channels: gray ? opaque ? 1 : 2 : opaque ? 3 : 4 })

const reduceRedundantChannels = (pixels: Uint8Array, width: number, height: number): { color: number, channels: number, samples: Uint8Array } => {
  const { gray, opaque } = detectRedundantChannels(pixels), { color, channels } = transportColorType(gray, opaque)
  const samples = new Uint8Array(width * height * channels)
  for (let i = 0; i < width * height; i++) {
    const source = i * 4, target = i * channels
    if (gray) { samples[target] = pixels[source]!; if (!opaque) samples[target + 1] = pixels[source + 3]! }
    else { samples.set(pixels.subarray(source, source + channels), target) }
  }
  return { color, channels, samples }
}

const filterScanline = (samples: Uint8Array, geometry: ScanlineGeometry, y: number, filter: number): { row: Uint8Array<ArrayBuffer>, score: number } => {
  const { stride, channels } = geometry, row = new Uint8Array(stride)
  let score = 0
  for (let x = 0; x < stride; x++) {
    const index = y * stride + x, left = x >= channels ? samples[index - channels]! : 0, above = y ? samples[index - stride]! : 0,
      corner = y && x >= channels ? samples[index - stride - channels]! : 0
    const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, corner)
    const value = (samples[index]! - predictor) & 255
    row[x] = value; score += Math.min(value, 256 - value)
  }
  return { row, score }
}

const filterScanlines = (samples: Uint8Array, geometry: ScanlineGeometry): Uint8Array => {
  const { height, stride } = geometry, filtered = new Uint8Array(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    let best = new Uint8Array(stride), bestScore = Infinity, bestFilter = 0
    for (let filter = 0; filter <= 4; filter++) {
      const { row, score } = filterScanline(samples, geometry, y, filter)
      if (score < bestScore) { bestScore = score; best = row; bestFilter = filter }
    }
    filtered[y * (stride + 1)] = bestFilter; filtered.set(best, y * (stride + 1) + 1)
  }
  return filtered
}

/** Deterministic PNG-only transport encoding. Removes only provably redundant gray/RGB/alpha channels, never quantizes, resizes or changes pixels. */
export const losslesslyCompressPng = async (original: Uint8Array) => {
  // Native header probing and bounded full sample decoding must agree before
  // any transport encoding is attempted.
  const native = await new Bun.Image(original, { autoOrient: false, maxPixels: maximumPixels }).metadata()
  const decoded = decodePngRgba8(original)
  if (native.format !== 'png' || native.width !== decoded.width || native.height !== decoded.height) throw new AppValidationError('Native PNG dimensions disagree with decoded samples')
  const { width, height, pixels } = decoded
  const { color, channels, samples } = reduceRedundantChannels(pixels, width, height)
  const filtered = filterScanlines(samples, { width, height, channels, stride: width * channels })
  const header = new Uint8Array(13), headerView = new DataView(header.buffer)
  headerView.setUint32(0, width); headerView.setUint32(4, height); header[8] = 8; header[9] = color
  // Preserve color/physical interpretation; channel-specific bKGD and incidental
  // timestamps/text are not part of the image's RGBA samples.
  const preserved = readPngChunks(original, assertSupportedChunkType).filter(c => ['cHRM', 'gAMA', 'iCCP', 'sRGB', 'pHYs'].includes(c.type)).map(c => pngChunk(c.type, c.data))
  const bytes = Buffer.concat([signature, pngChunk('IHDR', header), ...preserved,
    pngChunk('IDAT', deflateSync(filtered, { level: 9, strategy: constants.Z_FILTERED })), pngChunk('IEND', new Uint8Array())])
  const verified = decodePngRgba8(bytes)
  if (verified.width !== width || verified.height !== height || !equal(pixels, verified.pixels)) throw new AppValidationError('PNG transport changed decoded pixels')
  return { bytes: new Uint8Array(bytes), width, height, pixelSha256: decoded.pixelSha256, originalSha256: sha256(original), transportSha256: sha256(bytes) }
}

/** Small/non-PNG inputs keep their original bytes. Callers still enforce their provider's unchanged byte ceiling. */
export const normalizeOversizedPng = async (bytes: Uint8Array, format: string, maximumBytes: number): Promise<Uint8Array> =>
  bytes.length > maximumBytes && format === 'png' ? (await losslesslyCompressPng(bytes)).bytes : bytes
