import { deflateSync } from 'node:zlib'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const pngChunk = (type: string, data: Uint8Array): Buffer => {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])
  const chunk = Buffer.alloc(data.length + 12)
  chunk.writeUInt32BE(data.length, 0)
  typeAndData.copy(chunk, 4)
  chunk.writeUInt32BE(Bun.hash.crc32(typeAndData) >>> 0, data.length + 8)
  return chunk
}

/**
 * A real, decodable 8-bit RGB PNG whose solid colour is derived from `seed`, so distinct seeds give distinct bytes and hashes.
 * Mock generations can return these where selection verifies PNG framing, checksums and decoded dimensions.
 */
export const seededPng = (seed: number, width = 2, height = 2): Buffer => {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = seed & 0xff
    row[2 + x * 3] = (seed >> 8) & 0xff
    row[3 + x * 3] = (seed * 37 + 11) & 0xff
  }
  const pixels = Buffer.concat(Array.from({ length: height }, () => row))
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', new Uint8Array())])
}
