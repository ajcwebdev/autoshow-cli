import { describe, expect, test } from 'bun:test'
import { chmod, lstat, readdir, readlink, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  extractTarGzBuffer,
  writeTarPayloadFully
} from '~/cli/commands/setup-and-utilities/setup/setup-download/tar-gz'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

type RawTarRecord = {
  path: string
  typeFlag?: string
  payload?: Uint8Array
  linkName?: string
  mode?: number
}

const tempDirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-tar-security-' })
const encoder = new TextEncoder()

const writeField = (header: Uint8Array, offset: number, length: number, value: string): void => {
  header.set(encoder.encode(value).subarray(0, length), offset)
}

const writeOctal = (header: Uint8Array, offset: number, length: number, value: number): void => {
  writeField(header, offset, length, `${value.toString(8).padStart(length - 1, '0')}\0`)
}

const tarHeader = (record: RawTarRecord): Uint8Array => {
  const header = new Uint8Array(512)
  const payloadSize = record.payload?.byteLength ?? 0
  writeField(header, 0, 100, record.path)
  writeOctal(header, 100, 8, record.mode ?? (record.typeFlag === '5' ? 0o755 : 0o644))
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, payloadSize)
  writeOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  writeField(header, 156, 1, record.typeFlag ?? '0')
  if (record.linkName) writeField(header, 157, 100, record.linkName)
  writeField(header, 257, 6, 'ustar')
  writeField(header, 263, 2, '00')
  let checksum = 0
  for (const byte of header) checksum += byte
  writeField(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `)
  return header
}

const padded = (bytes: Uint8Array): Uint8Array => {
  const output = new Uint8Array(Math.ceil(bytes.byteLength / 512) * 512)
  output.set(bytes)
  return output
}

const rawTarGz = (records: RawTarRecord[]): Uint8Array<ArrayBuffer> => {
  const chunks: Uint8Array[] = []
  for (const record of records) {
    chunks.push(tarHeader(record))
    if (record.payload && record.payload.byteLength > 0) chunks.push(padded(record.payload))
  }
  chunks.push(new Uint8Array(1024))
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return Bun.gzipSync(bytes)
}

const paxRecord = (key: string, value: string): Uint8Array => {
  const body = `${key}=${value}\n`
  let length = encoder.encode(body).byteLength + 2
  for (;;) {
    const record = `${length} ${body}`
    const actual = encoder.encode(record).byteLength
    if (actual === length) return encoder.encode(record)
    length = actual
  }
}

const binaryPaxRecord = (key: string, value: Uint8Array): Uint8Array => {
  const keyBytes = encoder.encode(`${key}=`)
  let length = keyBytes.byteLength + value.byteLength + 3
  for (;;) {
    const prefix = encoder.encode(`${length} `)
    const actual = prefix.byteLength + keyBytes.byteLength + value.byteLength + 1
    if (actual === length) {
      const record = new Uint8Array(actual)
      record.set(prefix)
      record.set(keyBytes, prefix.byteLength)
      record.set(value, prefix.byteLength + keyBytes.byteLength)
      record[record.byteLength - 1] = 0x0a
      return record
    }
    length = actual
  }
}

describe('streamed tar.gz security and correctness corpus', () => {
  test('retries short file writes and rejects writers that make no progress', async () => {
    const expected = encoder.encode('payload split across short writes')
    const written: number[] = []
    const requestedLengths: number[] = []

    await writeTarPayloadFully(expected, async (remaining) => {
      requestedLengths.push(remaining.byteLength)
      const bytesWritten = Math.min(3, remaining.byteLength)
      written.push(...remaining.subarray(0, bytesWritten))
      return bytesWritten
    })

    expect(new Uint8Array(written)).toEqual(expected)
    expect(requestedLengths.length).toBeGreaterThan(1)
    expect(requestedLengths.at(-1)).toBeLessThanOrEqual(3)
    await expect(writeTarPayloadFully(expected, async () => 0)).rejects.toThrow('invalid byte count: 0')
  })

  test('preserves PAX, global extended, GNU long-name, and GNU long-link records', async () => {
    const destination = await tempDirs.make()
    const paxPath = `root/${'p'.repeat(120)}/pax.txt`
    const gnuPath = `root/${'g'.repeat(120)}/gnu.txt`
    const archive = rawTarGz([
      { path: 'global', typeFlag: 'g', payload: paxRecord('mtime', '0') },
      { path: 'pax', typeFlag: 'x', payload: paxRecord('path', paxPath) },
      { path: 'truncated-placeholder', payload: encoder.encode('pax') },
      { path: '././@LongLink', typeFlag: 'L', payload: encoder.encode(`${gnuPath}\0`) },
      { path: 'gnu-placeholder', payload: encoder.encode('gnu') },
      { path: '././@LongLink', typeFlag: 'K', payload: encoder.encode(`${gnuPath.replace('root/', '')}\0`) },
      { path: 'root/gnu-link', typeFlag: '2', linkName: 'truncated-target' }
    ])

    await extractTarGzBuffer(archive, { destination, stripComponents: 1 })

    expect(await Bun.file(join(destination, paxPath.replace('root/', ''))).text()).toBe('pax')
    expect(await Bun.file(join(destination, gnuPath.replace('root/', ''))).text()).toBe('gnu')
    expect(await readlink(join(destination, 'gnu-link'))).toBe(gnuPath.replace('root/', ''))
  })

  test('ignores binary values for unsupported PAX extension keys', async () => {
    const destination = await tempDirs.make()
    const extension = binaryPaxRecord('SCHILY.xattr.com.apple.provenance', new Uint8Array([0xff, 0xfe, 0xfd]))
    const path = paxRecord('path', 'root/payload.txt')
    const metadata = new Uint8Array(extension.byteLength + path.byteLength)
    metadata.set(extension)
    metadata.set(path, extension.byteLength)

    await extractTarGzBuffer(rawTarGz([
      { path: 'pax', typeFlag: 'x', payload: metadata },
      { path: 'placeholder', payload: encoder.encode('payload') }
    ]), { destination, stripComponents: 1 })

    expect(await Bun.file(join(destination, 'payload.txt')).text()).toBe('payload')
  })

  test('rejects traversal, absolute, and Windows-style archive paths', async () => {
    for (const path of ['../escape', '/absolute', 'C:/windows', 'root\\windows', 'root/../escape']) {
      const destination = join(await tempDirs.make(), 'target')
      await expect(extractTarGzBuffer(rawTarGz([{ path, payload: encoder.encode('bad') }]), { destination }))
        .rejects.toThrow('Unsafe tar path rejected')
      expect(await Bun.file(join(dirname(destination), 'escape')).exists()).toBe(false)
    }
  })

  test('allows contained relative symlinks and rejects escaping or ancestor symlinks', async () => {
    const safeDestination = await tempDirs.make()
    await extractTarGzBuffer(rawTarGz([
      { path: 'root/bin/tool', payload: encoder.encode('safe') },
      { path: 'root/nested/link', typeFlag: '2', linkName: '../bin/tool' }
    ]), { destination: safeDestination, stripComponents: 1 })
    expect((await lstat(join(safeDestination, 'nested/link'))).isSymbolicLink()).toBe(true)

    for (const records of [
      [{ path: 'root/link', typeFlag: '2', linkName: '../../escape' }],
      [
        { path: 'root/link', typeFlag: '2', linkName: 'inside' },
        { path: 'root/link/payload', payload: encoder.encode('bad') }
      ]
    ] satisfies RawTarRecord[][]) {
      const destination = join(await tempDirs.make(), 'target')
      await expect(extractTarGzBuffer(rawTarGz(records), { destination, stripComponents: 1 })).rejects.toThrow()
    }
  })

  test('rejects hard links, duplicate stripped targets, and unrelated destination overwrite', async () => {
    const hardLinkDestination = join(await tempDirs.make(), 'hard')
    await expect(extractTarGzBuffer(rawTarGz([
      { path: 'root/a', payload: encoder.encode('a') },
      { path: 'root/b', typeFlag: '1', linkName: 'root/a' }
    ]), { destination: hardLinkDestination, stripComponents: 1 })).rejects.toThrow('hard links are not supported')

    const duplicateDestination = join(await tempDirs.make(), 'duplicate')
    await expect(extractTarGzBuffer(rawTarGz([
      { path: 'one/file', payload: encoder.encode('one') },
      { path: 'two/file', payload: encoder.encode('two') }
    ]), { destination: duplicateDestination, stripComponents: 1 })).rejects.toThrow('Duplicate tar target rejected')

    const occupiedDestination = await tempDirs.make()
    await Bun.write(join(occupiedDestination, 'keep.txt'), 'keep')
    await expect(extractTarGzBuffer(rawTarGz([{ path: 'new.txt', payload: encoder.encode('new') }]), {
      destination: occupiedDestination
    })).rejects.toThrow('must be empty')
    expect(await Bun.file(join(occupiedDestination, 'keep.txt')).text()).toBe('keep')
  })

  test('preserves executable modes and rejects malformed, truncated, and oversized input', async () => {
    const executableDestination = await tempDirs.make()
    await extractTarGzBuffer(rawTarGz([{ path: 'tool', payload: encoder.encode('run'), mode: 0o755 }]), {
      destination: executableDestination
    })
    expect((await stat(join(executableDestination, 'tool'))).mode & 0o111).toBe(0o111)
    await chmod(join(executableDestination, 'tool'), 0o644)

    const malformedTar = Bun.gunzipSync(rawTarGz([{ path: 'bad', payload: encoder.encode('bad') }]))
    malformedTar[0] = (malformedTar[0] ?? 0) ^ 0xff
    await expect(extractTarGzBuffer(Bun.gzipSync(malformedTar), {
      destination: join(await tempDirs.make(), 'malformed')
    })).rejects.toThrow('checksum')

    const truncatedTar = Bun.gunzipSync(rawTarGz([{ path: 'large', payload: new Uint8Array(700) }])).subarray(0, 900)
    await expect(extractTarGzBuffer(Bun.gzipSync(truncatedTar), {
      destination: join(await tempDirs.make(), 'truncated')
    })).rejects.toThrow('Truncated tar archive')

    const archive = rawTarGz([{ path: 'large', payload: new Uint8Array(2048) }])
    await expect(extractTarGzBuffer(archive, {
      destination: join(await tempDirs.make(), 'compressed-limit'),
      maxCompressedBytes: archive.byteLength - 1
    })).rejects.toThrow('Compressed tar archive exceeds')
    await expect(extractTarGzBuffer(archive, {
      destination: join(await tempDirs.make(), 'entry-limit'),
      maxEntryBytes: 1024
    })).rejects.toThrow('Tar entry exceeds')
  })

  test('confines failure cleanup to staging directories', async () => {
    const parent = await tempDirs.make()
    const destination = join(parent, 'published')
    await Bun.write(join(parent, 'unrelated.txt'), 'preserve')
    await expect(extractTarGzBuffer(rawTarGz([{ path: '../escape', payload: encoder.encode('bad') }]), {
      destination
    })).rejects.toThrow()
    expect(await Bun.file(join(parent, 'unrelated.txt')).text()).toBe('preserve')
    expect((await readdir(parent)).some((name) => name.includes('.published.tar-stage-'))).toBe(false)
  })
})
