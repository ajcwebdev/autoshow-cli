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
  mtime?: number
  binaryMtime?: bigint
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
  writeOctal(header, 136, 12, record.mtime ?? 0)
  if (record.binaryMtime !== undefined) {
    let value = record.binaryMtime
    for (let offset = 147; offset >= 136; offset--) {
      header[offset] = Number(value & 0xffn)
      value >>= 8n
    }
    header[136] = (header[136] ?? 0) | 0x80
  }
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
  test('preserves release-source timestamps so make does not regenerate shipped outputs', async () => {
    const destination = await tempDirs.make()
    const generated = 1_737_127_086
    const input = 1_737_126_905
    await extractTarGzBuffer(rawTarGz([
      { path: 'root/m4', typeFlag: '5', mode: 0o755, mtime: input },
      { path: 'root/configure', payload: encoder.encode('generated'), mode: 0o755, mtime: generated },
      { path: 'root/aclocal.m4', payload: encoder.encode('generated macros'), mtime: generated - 1 },
      { path: 'root/configure.ac', payload: encoder.encode('source input'), mtime: input },
      { path: 'root/m4/input.m4', payload: encoder.encode('macro input'), mtime: input },
      { path: 'root/Makefile', payload: encoder.encode('all: configure\nconfigure: aclocal.m4 configure.ac\n\t@echo unexpected-autoconf >&2; exit 61\naclocal.m4: configure.ac m4/input.m4\n\t@echo unexpected-aclocal >&2; exit 62\n'), mtime: generated },
      { path: 'root/configure-link', typeFlag: '2', linkName: 'configure', mtime: input }
    ]), { destination, stripComponents: 1 })
    expect((await stat(join(destination, 'configure'))).mtimeMs).toBe(generated * 1000)
    expect((await stat(join(destination, 'configure.ac'))).mtimeMs).toBe(input * 1000)
    expect((await stat(join(destination, 'configure'))).mode & 0o777).toBe(0o755)
    expect((await stat(join(destination, 'm4'))).mtimeMs).toBe(input * 1000)
    expect((await lstat(join(destination, 'configure-link'))).mtimeMs).toBe(input * 1000)
    const child = Bun.spawn(['/usr/bin/make', 'all'], { cwd: destination, env: { PATH: '/usr/bin:/bin' }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(`${stdout}\n${stderr}`).not.toContain('unexpected-')
  })

  test('preserves global and per-entry PAX timestamps and rejects malformed timestamps before publication', async () => {
    const destination = await tempDirs.make()
    await extractTarGzBuffer(rawTarGz([
      { path: 'global', typeFlag: 'g', payload: paxRecord('mtime', '1000.125') },
      { path: 'one', payload: encoder.encode('one'), mtime: 2 },
      { path: 'pax', typeFlag: 'x', payload: paxRecord('mtime', '-1.25') },
      { path: 'two', payload: encoder.encode('two'), mtime: 2 },
      { path: 'three', payload: encoder.encode('three'), mtime: 2 },
      { path: 'delete-local', typeFlag: 'x', payload: paxRecord('mtime', '') },
      { path: 'four', payload: encoder.encode('four'), binaryMtime: -2n },
      { path: 'delete-global', typeFlag: 'g', payload: paxRecord('mtime', '') },
      { path: 'five', payload: encoder.encode('five'), binaryMtime: -1n }
    ]), { destination })
    expect((await stat(join(destination, 'one'))).mtimeMs).toBeCloseTo(1_000_125, 1)
    expect((await stat(join(destination, 'two'))).mtimeMs).toBeCloseTo(-1250, 1)
    expect((await stat(join(destination, 'three'))).mtimeMs).toBeCloseTo(1_000_125, 1)
    expect((await stat(join(destination, 'four'))).mtimeMs).toBe(-2000)
    expect((await stat(join(destination, 'five'))).mtimeMs).toBe(-1000)
    for (const value of ['NaN', 'Infinity', '1e3', '123 trailing', '8640000000001']) {
      const target = join(await tempDirs.make(), 'target')
      await expect(extractTarGzBuffer(rawTarGz([
        { path: 'pax', typeFlag: 'x', payload: paxRecord('mtime', value) },
        { path: 'payload', payload: encoder.encode('unpublished') }
      ]), { destination: target })).rejects.toThrow('timestamp')
      expect(await Bun.file(join(target, 'payload')).exists()).toBe(false)
    }
    for (const binaryMtime of [-8_640_000_000_001n, 8_640_000_000_001n]) {
      const target = join(await tempDirs.make(), 'target')
      await expect(extractTarGzBuffer(rawTarGz([
        { path: 'payload', payload: encoder.encode('unpublished'), binaryMtime }
      ]), { destination: target })).rejects.toThrow('timestamp range')
      expect(await Bun.file(join(target, 'payload')).exists()).toBe(false)
    }
  })

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
