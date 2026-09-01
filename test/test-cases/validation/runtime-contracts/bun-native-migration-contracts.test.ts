import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  copyFileExact,
  readFileBytes,
  readTextFile,
  statPath,
  unlinkPath,
  writeFileExact
} from '~/utils/bun-file-io'
import { logicalCpuCount } from '~/utils/logical-cpu-count'
import { fileUrlToPath } from '~/utils/file-url-path'
import { runSyncCommand, runSyncCommandOrThrow, SyncCommandError } from '~/utils/sync-subprocess'
import { readZipEntryData } from '~/utils/zip-central-directory'
import type { ZipEntry } from '~/types'

const temporaryRoots: string[] = []

const makeTemporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-bun-native-'))
  temporaryRoots.push(root)
  return root
}

const errorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error
    ? (error as Error & { code?: string }).code
    : undefined

const localZipEntryBuffer = (data: Uint8Array): Buffer => {
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  return Buffer.concat([header, data])
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (root) => {
    await rm(root, { recursive: true, force: true })
  }))
})

describe('Bun-native migration contracts', () => {
  test('round-trips file URLs with encoded path characters and rejects non-file URLs', async () => {
    const root = await makeTemporaryRoot()
    const path = join(root, 'space # % snow-☃.txt')
    const url = Bun.pathToFileURL(path)

    expect(url.protocol).toBe('file:')
    expect(url.href).toContain('%23')
    expect(url.href).toContain('%25')
    expect(fileUrlToPath(url)).toBe(path)
    expect(() => fileUrlToPath('https://example.com/not-a-file')).toThrow()
    expect(() => fileUrlToPath('file:///%ZZ')).toThrow()
  })

  test('global random UUIDs retain the RFC 4122 version-4 identifier format', () => {
    const values = Array.from({ length: 32 }, () => crypto.randomUUID())
    const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

    expect(new Set(values).size).toBe(values.length)
    expect(values.every((value) => uuidV4.test(value))).toBe(true)
  })

  test('SHA-256 matches pinned text, Unicode, NUL, and binary vectors', () => {
    const digest = (value: Bun.BlobOrStringOrBuffer): string =>
      new Bun.CryptoHasher('sha256').update(value).digest('hex')

    expect(digest('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(digest('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(digest('AutoShow ☃ 🎧')).toBe('a934ee10f547cca59aa5522ca052b67c1d5d3e7e9553229cd6848df1b5109fda')
    expect(digest('left\0right')).toBe('a8bf3285e2c06883247ccc859fa41ad965f343ae6579b6b6b127c5d8280c9701')
    expect(digest(Uint8Array.from([0, 255, 16, 128]))).toBe('a33bb2aed757bc839807d7a9deab0688c3cf06d36e53cb428f2e539c8dc76c5b')
  })

  test('stat preserves metadata, mode bits, directory identity, and symlink following', async () => {
    const root = await makeTemporaryRoot()
    const target = join(root, 'target.bin')
    const link = join(root, 'target-link')
    await writeFile(target, Uint8Array.from([1, 2, 3, 4]))
    await chmod(target, 0o600)
    await symlink(target, link)

    const targetStats = await statPath(target)
    const linkStats = await statPath(link)
    const rootStats = await statPath(root)

    expect(targetStats.isFile()).toBe(true)
    expect(targetStats.size).toBe(4)
    expect(targetStats.mode & 0o777).toBe(0o600)
    expect(Number.isFinite(targetStats.mtimeMs)).toBe(true)
    expect(rootStats.isDirectory()).toBe(true)
    expect(linkStats.dev).toBe(targetStats.dev)
    expect(linkStats.ino).toBe(targetStats.ino)
    expect((await lstat(link)).isSymbolicLink()).toBe(true)

    try {
      await statPath(join(root, 'missing'))
      throw new Error('statPath unexpectedly accepted a missing path')
    } catch (error) {
      expect(errorCode(error)).toBe('ENOENT')
    }
  })

  test('unlink removes only the symlink and preserves missing-path and directory errors', async () => {
    const root = await makeTemporaryRoot()
    const target = join(root, 'target.txt')
    const link = join(root, 'target-link')
    const directory = join(root, 'directory')
    await writeFile(target, 'target')
    await symlink(target, link)
    await mkdir(directory)

    await expect(unlinkPath(link)).resolves.toBeUndefined()
    expect(await readTextFile(target)).toBe('target')
    await expect(unlinkPath(join(root, 'missing'))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(unlinkPath(directory)).rejects.toMatchObject({ syscall: 'unlink' })
  })

  test('text, byte, and exact-write adapters preserve bytes and refuse missing parents', async () => {
    const root = await makeTemporaryRoot()
    const file = join(root, 'payload.bin')
    const bytes = Uint8Array.from([0, 255, 16, 128, 10])

    expect(await writeFileExact(file, bytes, { mode: 0o600 })).toBeUndefined()
    expect(Buffer.isBuffer(await readFileBytes(file))).toBe(true)
    expect(await readFileBytes(file)).toEqual(Buffer.from(bytes))
    expect((await statPath(file)).mode & 0o777).toBe(0o600)

    await writeFileExact(file, 'short')
    expect(await readTextFile(file)).toBe('short')
    expect(await readFile(file)).toEqual(Buffer.from('short'))
    await expect(writeFileExact(join(root, 'missing-parent', 'file.txt'), 'nope')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('file-copy adapter overwrites regular files and refuses missing inputs or parents', async () => {
    const root = await makeTemporaryRoot()
    const source = join(root, 'source.bin')
    const destination = join(root, 'destination.bin')
    await writeFile(source, Uint8Array.from([9, 8, 7, 0, 6]))
    await writeFile(destination, 'longer stale content')

    expect(await copyFileExact(source, destination)).toBeUndefined()
    expect(await readFileBytes(destination)).toEqual(Buffer.from([9, 8, 7, 0, 6]))
    await expect(copyFileExact(join(root, 'missing'), destination)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(copyFileExact(source, join(root, 'missing-parent', 'copy'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('synchronous subprocess adapter captures output and throws typed nonzero failures', async () => {
    const root = await makeTemporaryRoot()
    const success = runSyncCommand(process.execPath, ['-e', 'console.log(`${process.cwd()}|${process.env.MIGRATION_PROBE}`)'], {
      cwd: root,
      env: { MIGRATION_PROBE: 'present' }
    })
    expect(success).toMatchObject({ exitCode: 0, success: true, stderr: '' })
    expect(success.stdout.trim()).toBe(`${await realpath(root)}|present`)

    const failure = runSyncCommand(process.execPath, ['-e', 'process.stdout.write("out"); process.stderr.write("err"); process.exit(7)'])
    expect(failure).toMatchObject({ exitCode: 7, success: false, stdout: 'out', stderr: 'err' })
    expect(() => runSyncCommandOrThrow(process.execPath, ['-e', 'process.stderr.write("failed"); process.exit(9)']))
      .toThrow(SyncCommandError)
    try {
      runSyncCommandOrThrow(process.execPath, ['-e', 'process.stderr.write("failed"); process.exit(9)'])
      throw new Error('runSyncCommandOrThrow unexpectedly accepted a failure')
    } catch (error) {
      expect(error).toBeInstanceOf(SyncCommandError)
      expect(error).toMatchObject({ exitCode: 9, stderr: 'failed' })
    }
  })

  test('synchronous subprocess maxBuffer keeps exact output and bounds overflow', () => {
    const exact = runSyncCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(1024))'], {
      maxBuffer: 1024
    })
    expect(exact).toMatchObject({ exitCode: 0, success: true })
    expect(exact.signalCode).toBeUndefined()
    expect(exact.stdout).toHaveLength(1024)

    const overflow = runSyncCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(262144))'], {
      maxBuffer: 1024
    })
    expect(overflow).toMatchObject({ success: false, maxBufferExceeded: true, stderr: '' })
    expect(overflow.stdout).toHaveLength(1024)
    if (overflow.signalCode !== undefined) expect(overflow.signalCode).toBe('SIGTERM')
    expect(() => runSyncCommandOrThrow(process.execPath, ['-e', 'process.stdout.write("x".repeat(262144))'], {
      maxBuffer: 1024
    })).toThrow('output exceeding maxBuffer')
  })

  test('raw DEFLATE returns Buffer-identical binary data and rejects malformed streams', () => {
    const expected = Buffer.from([0, 1, 2, 3, 255, 128, 65, 66, 67, 0, 10])
    const compressed = Buffer.from('Y2BkYv7f4OjkzMAFAA==', 'base64')
    const entry: ZipEntry = {
      name: 'binary.dat',
      method: 8,
      compSize: compressed.length,
      uncompSize: expected.length,
      localOffset: 0
    }
    const inflated = readZipEntryData(localZipEntryBuffer(compressed), entry, { stage: 'test:zip' })

    expect(Buffer.isBuffer(inflated)).toBe(true)
    expect(inflated).toEqual(expected)
    const stored = readZipEntryData(localZipEntryBuffer(expected), { ...entry, method: 0, compSize: expected.length }, { stage: 'test:zip' })
    expect(stored).toEqual(expected)
    expect(() => readZipEntryData(localZipEntryBuffer(Buffer.from([0xff, 0xff, 0xff])), { ...entry, compSize: 3 }, { stage: 'test:zip' })).toThrow()
  })

  test('logical CPU count remains a positive integer bounded to the Web API count', () => {
    expect(logicalCpuCount()).toBe(Math.max(1, navigator.hardwareConcurrency))
    expect(Number.isInteger(logicalCpuCount())).toBe(true)
    expect(logicalCpuCount()).toBeGreaterThanOrEqual(1)
  })
})
