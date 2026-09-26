import { constants } from 'node:fs'
import { open, readdir, rename, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { crc32, deflateRaw, inflateRaw } from 'node:zlib'
import { promisify } from 'node:util'
import { UsageError, hasErrorCode } from '~/utils/error-handler'
import { withProcessLock } from '~/utils/process-lock'
import { inspectExistingSafeArtifactDirectory } from './safe-artifact-validation'

const compress = promisify(deflateRaw)
const decompress = promisify(inflateRaw)
const SLOT_NAME = /^[a-f0-9]{64}(?:-[a-f0-9]{64})?\.wav$/
const MAX_MEMBER_BYTES = 512 * 1024 * 1024
const ZIP_LIMIT = 0xffffffff
export const TTS_SLOT_BUNDLE = 'audio.zip'
export const isTtsSlotPath = (path: string): boolean => /(?:^|\/)slots\/[a-f0-9]{64}(?:-[a-f0-9]{64})?\.wav$/.test(path)

type ZipMember = { name: string; crc: number; size: number; compressedSize: number; offset: number }
type FileHandle = Awaited<ReturnType<typeof open>>

const invalid = () => UsageError('Invalid compressed TTS slot archive; restore the retained audio.zip before resuming.')
const readAt = async (file: FileHandle, length: number, position: number): Promise<Buffer> => {
  const bytes = Buffer.alloc(length)
  let read = 0
  while (read < length) {
    const result = await file.read(bytes, read, length - read, position + read)
    if (!result.bytesRead) throw invalid()
    read += result.bytesRead
  }
  return bytes
}

const openRegular = async (path: string): Promise<FileHandle> => {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  if (!(await file.stat()).isFile()) { await file.close(); throw invalid() }
  return file
}

// Only the small ZIP directory and the requested compressed member are read.
// Audio stays byte-identical, including provider WAV headers and recorded hashes.
const readIndex = async (file: FileHandle): Promise<Map<string, ZipMember>> => {
  const size = (await file.stat()).size
  if (size < 22 || size >= ZIP_LIMIT) throw invalid()
  const tail = await readAt(file, Math.min(size, 65557), Math.max(0, size - 65557))
  let end = tail.length - 22
  while (end >= 0 && (tail.readUInt32LE(end) !== 0x06054b50 || end + 22 + tail.readUInt16LE(end + 20) !== tail.length)) end--
  if (end < 0 || tail.readUInt32LE(end + 4) !== 0) throw invalid()
  const count = tail.readUInt16LE(end + 10), length = tail.readUInt32LE(end + 12), offset = tail.readUInt32LE(end + 16)
  if (count === 65535 || count !== tail.readUInt16LE(end + 8) || length > 32 * 1024 * 1024 || offset + length !== size - tail.length + end) throw invalid()
  const directory = await readAt(file, length, offset), members = new Map<string, ZipMember>()
  let cursor = 0
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > length || directory.readUInt32LE(cursor) !== 0x02014b50 || directory.readUInt16LE(cursor + 8) !== 0 || directory.readUInt16LE(cursor + 10) !== 8) throw invalid()
    const nameLength = directory.readUInt16LE(cursor + 28), extra = directory.readUInt16LE(cursor + 30), comment = directory.readUInt16LE(cursor + 32)
    if (cursor + 46 + nameLength + extra + comment > length) throw invalid()
    const name = directory.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    const member = { name, crc: directory.readUInt32LE(cursor + 16), compressedSize: directory.readUInt32LE(cursor + 20), size: directory.readUInt32LE(cursor + 24), offset: directory.readUInt32LE(cursor + 42) }
    if (!SLOT_NAME.test(name) || members.has(name) || member.size > MAX_MEMBER_BYTES || member.compressedSize > MAX_MEMBER_BYTES + 1024 * 1024 || member.offset + 30 + nameLength + member.compressedSize > offset) throw invalid()
    members.set(name, member)
    cursor += 46 + nameLength + extra + comment
  }
  if (cursor !== length) throw invalid()
  return members
}

const compressedMember = async (file: FileHandle, member: ZipMember): Promise<Buffer> => {
  const header = await readAt(file, 30, member.offset)
  if (header.readUInt32LE(0) !== 0x04034b50 || header.readUInt16LE(6) !== 0 || header.readUInt16LE(8) !== 8 || header.readUInt32LE(14) !== member.crc || header.readUInt32LE(18) !== member.compressedSize || header.readUInt32LE(22) !== member.size || header.readUInt16LE(28) !== 0) throw invalid()
  const name = await readAt(file, header.readUInt16LE(26), member.offset + 30)
  if (name.toString() !== member.name) throw invalid()
  return await readAt(file, member.compressedSize, member.offset + 30 + name.length)
}

const decodeMember = async (file: FileHandle, member: ZipMember): Promise<Buffer> => {
  const bytes = await decompress(await compressedMember(file, member), { maxOutputLength: Math.max(1, member.size) })
  if (bytes.length !== member.size || crc32(bytes) !== member.crc) throw invalid()
  return bytes
}

export const readBundledTtsSlot = async (directory: string, name: string): Promise<Buffer> => {
  if (!SLOT_NAME.test(name)) throw invalid()
  const file = await openRegular(join(directory, TTS_SLOT_BUNDLE))
  try {
    const member = (await readIndex(file)).get(name)
    if (!member) throw Object.assign(new Error(`Missing compressed TTS slot ${name}`), { code: 'ENOENT' })
    return await decodeMember(file, member)
  } finally { await file.close() }
}

export const compactTtsSlotDirectory = async (rootDir: string, relativeDirectory: string): Promise<{ files: number; bytesBefore: number; bytesAfter: number }> => {
  const directory = (await inspectExistingSafeArtifactDirectory(rootDir, relativeDirectory, 'TTS slots')).path
  return await withProcessLock('tts-slot-compaction', async () => {
    const names = (await readdir(directory)).filter(name => name !== '.DS_Store' && SLOT_NAME.test(name)).sort()
    if (!names.length) return { files: 0, bytesBefore: 0, bytesAfter: 0 }
    const destination = join(directory, TTS_SLOT_BUNDLE), temporary = join(directory, `.audio-${crypto.randomUUID()}.zip.tmp`)
    let previous: FileHandle | undefined
    let oldMembers = new Map<string, ZipMember>()
    try { previous = await openRegular(destination); oldMembers = await readIndex(previous) } catch (error) { if (!hasErrorCode(error, 'ENOENT')) { await previous?.close(); throw error } }
    const output = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    const members: ZipMember[] = [], originals = new Map<string, string>()
    let offset = 0, bytesBefore = previous ? (await previous.stat()).size : 0
    const append = async (bytes: Buffer) => { await output.writeFile(bytes); offset += bytes.length; if (offset >= ZIP_LIMIT) throw UsageError('TTS slot bundle exceeds the ZIP size limit; uncompressed paid audio was preserved.') }
    try {
      for (const name of [...new Set([...oldMembers.keys(), ...names])].sort()) {
        let packed: Buffer, member: ZipMember
        const old = oldMembers.get(name)
        if (names.includes(name)) {
          const source = await openRegular(join(directory, name))
          let bytes: Buffer
          try { if ((await source.stat()).size > MAX_MEMBER_BYTES) throw UsageError('TTS slot is too large to compress safely; paid audio was preserved.'); bytes = await source.readFile() } finally { await source.close() }
          if (old && previous && !(await decodeMember(previous, old)).equals(bytes)) throw UsageError('TTS slot conflicts with its compressed copy; both copies were preserved.')
          bytesBefore += bytes.length
          originals.set(name, new Bun.CryptoHasher('sha256').update(bytes).digest('hex'))
          packed = await compress(bytes, { level: 6 })
          member = { name, crc: crc32(bytes), size: bytes.length, compressedSize: packed.length, offset }
        } else {
          if (!old || !previous) throw invalid()
          // Verify retained members before replacing the previous archive.
          await decodeMember(previous, old)
          packed = await compressedMember(previous, old)
          member = { ...old, offset }
        }
        const nameBytes = Buffer.from(name), header = Buffer.alloc(30)
        header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8)
        header.writeUInt32LE(member.crc, 14); header.writeUInt32LE(member.compressedSize, 18); header.writeUInt32LE(member.size, 22); header.writeUInt16LE(nameBytes.length, 26)
        await append(header); await append(nameBytes); await append(packed); members.push(member)
      }
      if (members.length >= 65535) throw invalid()
      const centralOffset = offset
      for (const member of members) {
        const name = Buffer.from(member.name), header = Buffer.alloc(46)
        header.writeUInt32LE(0x02014b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(8, 10)
        header.writeUInt32LE(member.crc, 16); header.writeUInt32LE(member.compressedSize, 20); header.writeUInt32LE(member.size, 24); header.writeUInt16LE(name.length, 28); header.writeUInt32LE(member.offset, 42)
        await append(header); await append(name)
      }
      const end = Buffer.alloc(22)
      end.writeUInt32LE(0x06054b50); end.writeUInt16LE(members.length, 8); end.writeUInt16LE(members.length, 10); end.writeUInt32LE(offset - centralOffset, 12); end.writeUInt32LE(centralOffset, 16)
      await append(end); await output.sync(); await output.close()
      const verified = await openRegular(temporary)
      try {
        const index = await readIndex(verified)
        for (const [name, sha] of originals) if (new Bun.CryptoHasher('sha256').update(await decodeMember(verified, index.get(name)!)).digest('hex') !== sha) throw invalid()
      } finally { await verified.close() }
      await rename(temporary, destination)
      for (const [name, sha] of originals) {
        const source = await openRegular(join(directory, name))
        try { if (new Bun.CryptoHasher('sha256').update(await source.readFile()).digest('hex') !== sha) throw UsageError('TTS slot changed during compaction; its original was preserved.') } finally { await source.close() }
        await unlink(join(directory, name))
      }
      return { files: originals.size, bytesBefore, bytesAfter: offset }
    } finally { await previous?.close(); await output.close().catch(() => {}); await unlink(temporary).catch(() => {}) }
  }, { lockRoot: join(rootDir, '.locks'), waitMs: 60_000 })
}
