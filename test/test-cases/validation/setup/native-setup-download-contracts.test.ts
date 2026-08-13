import { describe, expect, test } from 'bun:test'
import { chmod, lstat, mkdir, readdir, readlink, rm, stat, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { extractTarGzBuffer } from '~/cli/commands/setup-and-utilities/setup/setup-download/tar-gz'
import { downloadFile, resolveDownloadTimeouts } from '~/cli/commands/setup-and-utilities/setup/setup-download/download'
import {
  DEFAULT_SETUP_DOWNLOAD_CONCURRENCY,
  getSetupDownloadAdmissionSnapshot,
  setSetupDownloadConcurrency
} from '~/cli/commands/setup-and-utilities/setup/setup-download/download-admission'
import { buildGithubArchiveUrl, buildGithubCommitArchiveUrl } from '~/cli/commands/setup-and-utilities/setup/setup-download/github-archives'
import { resolveUvAssetName, resolveUvCommandFromCandidates, resolveUvDownloadUrl } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-uv'
import { downloadHuggingFaceSnapshot } from '~/cli/commands/setup-and-utilities/setup/setup-download/huggingface'
import { buildManagedQpdfWrapperScript } from '~/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools'
import {
  buildLibjpegTurboCmakeArguments,
  buildQpdfCmakeArguments,
  buildQpdfSourceEnvironment,
  findForbiddenMacosDynamicLibraryReferences,
  resolveQpdfSourceBuildLayout
} from '~/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build'
import { hasCachedKittenTtsModel } from '~/cli/commands/process-steps/step-4-tts/tts-local/kitten/kitten-tts-model-cache'
import {
  hasSetupManagedLlamaModel,
  parseLlamaSetupModelMetadata,
  readLlamaSetupModelMetadata,
  recordSetupManagedLlamaModel
} from '~/cli/commands/process-steps/step-3-write/write-local/llama/llama-model-metadata'
import {
  REVERB_ASR_REQUIRED_FILES,
  REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES,
  REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-local/reverb/reverb-assets'
import type { SetupTarEntry } from '~/types'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['HUGGINGFACE_HUB_CACHE'],
  tempPrefix: 'autoshow-native-setup-test-',
  afterEachExtra: () => {
    setSetupDownloadConcurrency(DEFAULT_SETUP_DOWNLOAD_CONCURRENCY)
  }
})
const makeTempDir = tempDirs.make

const encoder = new TextEncoder()

const writeField = (header: Uint8Array, offset: number, length: number, value: string): void => {
  const bytes = encoder.encode(value)
  header.set(bytes.subarray(0, Math.min(bytes.byteLength, length)), offset)
}

const writeOctal = (header: Uint8Array, offset: number, length: number, value: number): void => {
  const text = value.toString(8).padStart(length - 1, '0')
  writeField(header, offset, length, `${text}\0`)
}

const createTarHeader = (entry: SetupTarEntry, size: number): Uint8Array => {
  const header = new Uint8Array(512)
  writeField(header, 0, 100, entry.path)
  writeOctal(header, 100, 8, entry.mode ?? (entry.type === 'file' ? 0o644 : 0o755))
  writeOctal(header, 108, 8, 0)
  writeOctal(header, 116, 8, 0)
  writeOctal(header, 124, 12, size)
  writeOctal(header, 136, 12, 0)
  header.fill(0x20, 148, 156)
  writeField(header, 156, 1, entry.type === 'directory' ? '5' : entry.type === 'symlink' ? '2' : '0')
  if (entry.type === 'symlink') {
    writeField(header, 157, 100, entry.linkName)
  }
  writeField(header, 257, 6, 'ustar')
  writeField(header, 263, 2, '00')

  let checksum = 0
  for (const byte of header) checksum += byte
  writeField(header, 148, 8, checksum.toString(8).padStart(6, '0') + '\0 ')
  return header
}

const padToBlock = (bytes: Uint8Array): Uint8Array => {
  const padded = new Uint8Array(Math.ceil(bytes.byteLength / 512) * 512)
  padded.set(bytes)
  return padded
}

const createTarGz = (entries: SetupTarEntry[]): Uint8Array<ArrayBuffer> => {
  const chunks: Uint8Array[] = []
  for (const entry of entries) {
    const payload = entry.type === 'file' ? encoder.encode(entry.content) : new Uint8Array()
    chunks.push(createTarHeader(entry, payload.byteLength))
    if (payload.byteLength > 0) chunks.push(padToBlock(payload))
  }
  chunks.push(new Uint8Array(1024))
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const tar = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    tar.set(chunk, offset)
    offset += chunk.byteLength
  }
  return Bun.gzipSync(tar)
}

const mockFetch = (
  fn: (url: string | URL | Request, init?: RequestInit) => Promise<Response>
): typeof fetch => Object.assign(fn, { preconnect: () => undefined }) as typeof fetch

describe('native tar.gz extraction', () => {
  test('extracts files, nested directories, symlinks, executable mode, and strip components', async () => {
    const destination = await makeTempDir()
    const archive = createTarGz([
      { type: 'directory', path: 'archive-root/bin' },
      { type: 'file', path: 'archive-root/bin/tool', content: '#!/usr/bin/env bun\n', mode: 0o755 },
      { type: 'directory', path: 'archive-root/nested' },
      { type: 'file', path: 'archive-root/nested/readme.txt', content: 'native tar works\n' },
      { type: 'symlink', path: 'archive-root/nested/tool-link', linkName: '../bin/tool' }
    ])

    await extractTarGzBuffer(archive, { destination, stripComponents: 1 })

    expect(await Bun.file(join(destination, 'nested/readme.txt')).text()).toBe('native tar works\n')
    expect((await stat(join(destination, 'bin/tool'))).mode & 0o111).toBeGreaterThan(0)
    expect((await lstat(join(destination, 'nested/tool-link'))).isSymbolicLink()).toBe(true)
    expect(await readlink(join(destination, 'nested/tool-link'))).toBe('../bin/tool')
  })

  test('rejects traversal paths', async () => {
    const destination = await makeTempDir()
    const archive = createTarGz([
      { type: 'file', path: '../escape.txt', content: 'bad' }
    ])

    await expect(extractTarGzBuffer(archive, { destination })).rejects.toThrow('Unsafe tar path rejected')
  })
})

describe('managed download checksum validation', () => {
  test('validates sha256 before writing downloaded files', async () => {
    const destination = join(await makeTempDir(), 'asset.txt')
    const payload = 'official artifact\n'
    globalThis.fetch = mockFetch(async () => new Response(payload))
    const result = await downloadFile({
      url: 'https://example.test/asset.txt',
      destination,
      sha256: '35cd0d2312fa344837c333588f0882f1015161916a573ee6a4754708d4a69657'
    })
    expect(result).toBeUndefined()
    expect(await Bun.file(destination).text()).toBe(payload)

    await expect(downloadFile({
      url: 'https://example.test/asset.txt',
      destination,
      sha256: '0000000000000000000000000000000000000000000000000000000000000000'
    })).rejects.toThrow('SHA-256 mismatch')
  })

  test('a checksum mismatch discards the partial file instead of leaving it to resume', async () => {
    const destination = join(await makeTempDir(), 'asset.bin')
    globalThis.fetch = mockFetch(async () => new Response('corrupt\n'))
    await expect(downloadFile({
      url: 'https://example.test/asset.bin',
      destination,
      sha256: '0000000000000000000000000000000000000000000000000000000000000000'
    })).rejects.toThrow('SHA-256 mismatch')

    expect(await Bun.file(`${destination}.part`).exists()).toBe(false)
    expect(await Bun.file(`${destination}.part.json`).exists()).toBe(false)
  })

  test('a short file is rejected and discarded rather than cached as complete', async () => {
    const destination = join(await makeTempDir(), 'model.bin')
    globalThis.fetch = mockFetch(async () => new Response('truncated'))
    await expect(downloadFile({
      url: 'https://example.test/model.bin',
      destination,
      expectedMinBytes: 10_000_000
    })).rejects.toThrow('too small')

    expect(await Bun.file(destination).exists()).toBe(false)
    expect(await Bun.file(`${destination}.part`).exists()).toBe(false)
  })
})

describe('resumable downloads', () => {
  test('an interrupted transfer resumes from the bytes already on disk', async () => {
    const destination = join(await makeTempDir(), 'large.bin')
    const payload = 'abcdefghijklmnopqrstuvwxyz'
    const rangeHeaders: (string | null)[] = []
    let attempt = 0

    globalThis.fetch = mockFetch(async (_url, init) => {
      const headers = new Headers(init?.headers)
      rangeHeaders.push(headers.get('range'))
      attempt += 1

      if (attempt === 1) {
        // Deliver a prefix, then fail before the body completes. The chunk must
        // be delivered on a separate pull: error() discards anything still queued.
        let pulls = 0
        return new Response(new ReadableStream<Uint8Array>({
          pull (controller) {
            pulls += 1
            if (pulls === 1) {
              controller.enqueue(new TextEncoder().encode(payload.slice(0, 10)))
              return
            }
            controller.error(new Error('connection reset'))
          }
        }))
      }

      const start = Number(/bytes=(\d+)-/.exec(headers.get('range') ?? '')?.[1] ?? 0)
      return new Response(payload.slice(start), { status: 206 })
    })

    await expect(downloadFile({ url: 'https://example.test/large.bin', destination }))
      .rejects.toThrow()
    // The prefix survives so the retry does not refetch from zero.
    expect(await Bun.file(`${destination}.part`).text()).toBe(payload.slice(0, 10))

    await downloadFile({ url: 'https://example.test/large.bin', destination })

    expect(await Bun.file(destination).text()).toBe(payload)
    expect(rangeHeaders).toEqual([null, 'bytes=10-'])
    expect(await Bun.file(`${destination}.part`).exists()).toBe(false)
  })

  test('a partial file from a different url is discarded rather than concatenated', async () => {
    const destination = join(await makeTempDir(), 'asset.bin')
    const rangeHeaders: (string | null)[] = []

    await Bun.write(`${destination}.part`, 'stale bytes from another asset')
    await Bun.write(`${destination}.part.json`, JSON.stringify({ url: 'https://example.test/other.bin' }))

    globalThis.fetch = mockFetch(async (_url, init) => {
      rangeHeaders.push(new Headers(init?.headers).get('range'))
      return new Response('fresh\n')
    })

    await downloadFile({ url: 'https://example.test/asset.bin', destination })
    expect(rangeHeaders).toEqual([null])
    expect(await Bun.file(destination).text()).toBe('fresh\n')
  })

  test('a server that ignores the range request restarts cleanly instead of appending', async () => {
    const destination = join(await makeTempDir(), 'asset.bin')

    await Bun.write(`${destination}.part`, 'partial')
    await Bun.write(`${destination}.part.json`, JSON.stringify({ url: 'https://example.test/asset.bin' }))

    // Status 200 rather than 206 means the peer replayed from byte 0.
    globalThis.fetch = mockFetch(async () => new Response('complete payload\n', { status: 200 }))

    await downloadFile({ url: 'https://example.test/asset.bin', destination })
    expect(await Bun.file(destination).text()).toBe('complete payload\n')
  })
})

describe('HuggingFace cache detection', () => {
  test('requires one complete manifest-bound Kitten snapshot and rejects interrupted caches', async () => {
    const hubCache = await makeTempDir()
    process.env['HUGGINGFACE_HUB_CACHE'] = hubCache

    // HuggingFace stores snapshot entries as symlinks into blobs/, so a
    // readdir isFile() check sees nothing and the guard never fires.
    const repoDir = join(hubCache, 'models--KittenML--kitten-tts-nano-0.8-int8')
    const blobs = join(repoDir, 'blobs')
    const revision = 'a'.repeat(40)
    const snapshot = join(repoDir, 'snapshots', revision)
    await mkdir(blobs, { recursive: true })
    await mkdir(snapshot, { recursive: true })
    await mkdir(join(repoDir, 'refs'), { recursive: true })
    await Bun.write(join(repoDir, 'refs', 'main'), revision)
    await Bun.write(join(blobs, 'config'), JSON.stringify({
      model_file: 'model.onnx',
      voices: 'voices.npz'
    }))
    await Bun.write(join(blobs, 'weights'), 'model bytes')
    await Bun.write(join(blobs, 'voices'), 'voice bytes')
    await symlink(join(blobs, 'config'), join(snapshot, 'config.json'))
    await symlink(join(blobs, 'weights'), join(snapshot, 'model.onnx'))
    await symlink(join(blobs, 'voices'), join(snapshot, 'voices.npz'))

    expect(await hasCachedKittenTtsModel('kitten-tts-nano-0.8-int8')).toBe(true)

    // A pruned blob leaves the link behind; that is not a usable cache.
    await rm(join(blobs, 'weights'), { force: true })
    expect(await hasCachedKittenTtsModel('kitten-tts-nano-0.8-int8')).toBe(false)

    // An interrupted cache containing the model but not the manifest-selected voices is also not
    // execution-ready and must never be allowed to fall through to an online repair after admission.
    await Bun.write(join(blobs, 'weights'), 'restored model bytes')
    await rm(join(blobs, 'voices'), { force: true })
    expect(await hasCachedKittenTtsModel('kitten-tts-nano-0.8-int8')).toBe(false)
  })
})

describe('download timeout budgets', () => {
  test('large-asset flows get a longer total budget than the default flow', () => {
    // A flat total-transfer deadline is what made multi-GB models fail on any
    // link slower than the deadline implied, regardless of connection health.
    const defaultTimeouts = resolveDownloadTimeouts({ url: '', destination: '' })
    const modelTimeouts = resolveDownloadTimeouts({ url: '', destination: '', flowId: 'whisper-model' })

    expect(modelTimeouts.totalTimeoutMs).toBeGreaterThan(defaultTimeouts.totalTimeoutMs)
    // Inactivity, not elapsed transfer time, is what aborts a download.
    expect(modelTimeouts.stallTimeoutMs).toBe(defaultTimeouts.stallTimeoutMs)
  })

  test('HTTP download failures retain Retry-After headers for outer retry wrappers', async () => {
    const destination = join(await makeTempDir(), 'rate-limited.bin')
    globalThis.fetch = mockFetch(async () => new Response('slow down', {
      status: 429,
      headers: { 'retry-after': '11' }
    }))

    try {
      await downloadFile({ url: 'https://example.test/rate-limited.bin', destination })
      throw new Error('expected rate-limited download failure')
    } catch (error) {
      expect((error as { status?: number }).status).toBe(429)
      expect((error as { headers?: Headers }).headers?.get('retry-after')).toBe('11')
    }
  })

  test('a stalled transfer fails with a retryable timeout message', async () => {
    const destination = join(await makeTempDir(), 'stalled.bin')
    globalThis.fetch = mockFetch(async (_url, init) => new Response(new ReadableStream<Uint8Array>({
      start (controller) {
        controller.enqueue(new TextEncoder().encode('partial'))
        // Never closes; only the stall watchdog can end this.
        init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')))
      }
    })))

    await expect(downloadFile({
      url: 'https://example.test/stalled.bin',
      destination,
      stallTimeoutMs: 25,
      totalTimeoutMs: 5_000
    })).rejects.toThrow(/timed out/i)
  })
})

describe('setup download admission budget', () => {
  const deferred = (): { promise: Promise<void>, resolve: () => void } => {
    let resolve!: () => void
    const promise = new Promise<void>((r) => { resolve = r })
    return { promise, resolve }
  }

  const waitFor = async (predicate: () => boolean, timeoutMs = 2_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs
    while (!predicate()) {
      if (Date.now() > deadline) throw new Error('timed out waiting for download admission state')
      await new Promise<void>((resolve) => { setTimeout(resolve, 1) })
    }
  }

  const settle = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) await new Promise<void>((resolve) => { setTimeout(resolve, 1) })
  }

  test('bounds concurrent transfers so an opening burst cannot divide the link N ways', async () => {
    const dir = await makeTempDir()
    const started: string[] = []
    const gates = new Map<string, ReturnType<typeof deferred>>()

    globalThis.fetch = mockFetch(async (url) => {
      const key = String(url)
      started.push(key)
      await gates.get(key)!.promise
      return new Response('payload')
    })

    setSetupDownloadConcurrency(2)
    try {
      const urls = ['a', 'b', 'c'].map((name) => `https://example.test/${name}.bin`)
      urls.forEach((url) => gates.set(url, deferred()))

      const pending = urls.map((url, index) => downloadFile({
        url,
        destination: join(dir, `asset-${index}.bin`)
      }))

      // Which two win the race depends on which mkdir lands first; that only
      // two are in flight at all is the contract.
      await waitFor(() => started.length >= 2)
      await settle()
      expect(started.length).toBe(2)
      expect(getSetupDownloadAdmissionSnapshot()).toMatchObject({ capacity: 2, active: 2, waiting: 1 })

      gates.get(started[0]!)!.resolve()
      await waitFor(() => started.length >= 3)
      expect([...started].sort()).toEqual([...urls].sort())

      urls.forEach((url) => gates.get(url)!.resolve())
      await Promise.all(pending)
      expect(getSetupDownloadAdmissionSnapshot()).toMatchObject({ active: 0, waiting: 0 })
    } finally {
      setSetupDownloadConcurrency(DEFAULT_SETUP_DOWNLOAD_CONCURRENCY)
    }
  })

  test('a failed transfer releases its slot instead of leaking it', async () => {
    const dir = await makeTempDir()
    let attempt = 0

    globalThis.fetch = mockFetch(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('connection reset')
      return new Response('payload')
    })

    setSetupDownloadConcurrency(1)
    try {
      await expect(downloadFile({
        url: 'https://example.test/first.bin',
        destination: join(dir, 'first.bin')
      })).rejects.toThrow('connection reset')

      await downloadFile({
        url: 'https://example.test/second.bin',
        destination: join(dir, 'second.bin')
      })

      expect(await Bun.file(join(dir, 'second.bin')).text()).toBe('payload')
      expect(getSetupDownloadAdmissionSnapshot()).toMatchObject({ active: 0, waiting: 0 })
    } finally {
      setSetupDownloadConcurrency(DEFAULT_SETUP_DOWNLOAD_CONCURRENCY)
    }
  })

  test('the slot is released before checksum verification, not after', async () => {
    const dir = await makeTempDir()
    const events: string[] = []

    globalThis.fetch = mockFetch(async (url) => {
      events.push(`fetch:${String(url).endsWith('first.bin') ? 'first' : 'second'}`)
      return new Response('official artifact\n')
    })

    setSetupDownloadConcurrency(1)
    try {
      // The first download's checksum pass is local work. If the slot were held
      // across it, the second download could not start until the first resolved.
      const first = downloadFile({
        url: 'https://example.test/first.bin',
        destination: join(dir, 'first.bin'),
        sha256: '35cd0d2312fa344837c333588f0882f1015161916a573ee6a4754708d4a69657'
      }).then(() => { events.push('done:first') })

      const second = downloadFile({
        url: 'https://example.test/second.bin',
        destination: join(dir, 'second.bin')
      }).then(() => { events.push('done:second') })

      await Promise.all([first, second])

      expect(events.indexOf('fetch:second')).toBeLessThan(events.indexOf('done:first'))
    } finally {
      setSetupDownloadConcurrency(DEFAULT_SETUP_DOWNLOAD_CONCURRENCY)
    }
  })
})

describe('managed macOS Tesseract setup', () => {
  const readInstallManagedTesseractMacosSource = async (): Promise<string> => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools.ts').text()
    const start = source.indexOf('export const installManagedTesseractMacos')
    const end = source.indexOf('export const installManagedQpdfMacos')
    if (start < 0 || end < 0) throw new Error('Could not locate installManagedTesseractMacos source')
    return source.slice(start, end)
  }

  test('builds Leptonica and Tesseract with CMake instead of autotools', async () => {
    const source = await readInstallManagedTesseractMacosSource()

    expect(source).toContain("runInherit('cmake'")
    expect(source).toContain("'-S', leptonicaBuildDir")
    expect(source).toContain("'-S', tesseractBuildDir")
    expect(source).toContain('`-DLeptonica_DIR=${leptonicaCmakeConfigDir}`')
    expect(source).toContain("'-DENABLE_WEBP=OFF'")
    expect(source).toContain("'-DENABLE_OPENJPEG=OFF'")
    expect(source).toContain("'-DBUILD_TESTS=OFF'")
    expect(source).toContain("'-DBUILD_TRAINING_TOOLS=OFF'")
    expect(source).toContain("'-DOPENMP_BUILD=OFF'")
    expect(source).toContain("'-DGRAPHICS_DISABLED=ON'")
    expect(source).not.toContain('./autogen.sh')
    expect(source).not.toContain("runInherit('./configure'")
    expect(source).not.toContain("runInherit('make'")
  })

  test('requires the managed Leptonica stamp and CMake config before treating Leptonica as ready', async () => {
    const fullSource = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools.ts').text()
    const source = await readInstallManagedTesseractMacosSource()

    expect(fullSource).toContain("const leptonicaCmakeConfigDir = join(leptonicaToolDir, 'lib/cmake/leptonica')")
    expect(fullSource).toContain("const leptonicaCmakeConfigPath = join(leptonicaCmakeConfigDir, 'LeptonicaConfig.cmake')")
    expect(fullSource).toContain("const leptonicaManagedBuildStampPath = join(leptonicaToolDir, '.autoshow-managed-build')")
    expect(fullSource).toContain('await pathExists(leptonicaCmakeConfigPath) && await pathExists(leptonicaManagedBuildStampPath)')
    expect(source).toContain('!await hasManagedLeptonicaBuild()')
    expect(source).toContain("await Bun.write(leptonicaManagedBuildStampPath, 'leptonica-cmake-v1\\n')")
    const installIndex = source.indexOf("await runInherit('cmake', ['--install', leptonicaCmakeBuildDir]")
    const stampIndex = source.indexOf('await Bun.write(leptonicaManagedBuildStampPath')
    expect(installIndex).toBeGreaterThanOrEqual(0)
    expect(stampIndex).toBeGreaterThanOrEqual(0)
    expect(installIndex).toBeLessThan(stampIndex)
    expect(source).not.toContain("!await pathExists(join(leptonicaToolDir, 'lib'))")
  })
})

describe('managed macOS qpdf setup', () => {
  test('generated wrapper executes the static qpdf binary without a dynamic-library override', async () => {
    const dir = await makeTempDir()
    const installedQpdf = join(dir, 'tools/qpdf/bin/qpdf')
    const managedQpdf = join(dir, 'bin/qpdf')
    await mkdir(join(dir, 'tools/qpdf/bin'), { recursive: true })
    await mkdir(join(dir, 'bin'), { recursive: true })
    await Bun.write(installedQpdf, '#!/bin/sh\nprintf "qpdf version 12.0.0\\n"\n')
    await chmod(installedQpdf, 0o755)
    const wrapperScript = buildManagedQpdfWrapperScript(installedQpdf)
    await Bun.write(managedQpdf, wrapperScript)
    await chmod(managedQpdf, 0o755)

    const proc = Bun.spawn([managedQpdf, '--version'], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ])

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
    expect(wrapperScript).not.toContain('DYLD_LIBRARY_PATH')
    expect(wrapperScript).toContain(`exec "${installedQpdf}" "$@"`)
    expect(stdout).toContain('qpdf version 12.0.0')
  })

  test('uses one static libjpeg and native-crypto qpdf source recipe', () => {
    const layout = resolveQpdfSourceBuildLayout('/tmp/qpdf-build')
    const libjpegArgs = buildLibjpegTurboCmakeArguments(layout, '15.0')
    const qpdfArgs = buildQpdfCmakeArguments(layout, '/tmp/qpdf-tool', '15.0')
    const env = buildQpdfSourceEnvironment(layout)

    expect(libjpegArgs).toContain('-DENABLE_SHARED=OFF')
    expect(libjpegArgs).toContain('-DENABLE_STATIC=ON')
    expect(libjpegArgs).toContain('-DWITH_TURBOJPEG=OFF')
    expect(libjpegArgs).toContain('-DCMAKE_OSX_DEPLOYMENT_TARGET=15.0')
    expect(qpdfArgs).toContain('-DBUILD_SHARED_LIBS=OFF')
    expect(qpdfArgs).toContain('-DBUILD_STATIC_LIBS=ON')
    expect(qpdfArgs).toContain('-DPKG_CONFIG_EXECUTABLE=/usr/bin/false')
    expect(qpdfArgs).toContain('-DUSE_IMPLICIT_CRYPTO=OFF')
    expect(qpdfArgs).toContain('-DREQUIRE_CRYPTO_NATIVE=ON')
    expect(qpdfArgs).toContain('-DDEFAULT_CRYPTO=native')
    expect(qpdfArgs).toContain('-DSHOW_FAILED_TEST_OUTPUT=ON')
    expect(qpdfArgs).toContain(`-DCMAKE_LIBRARY_PATH=${layout.libjpegTurboInstallDir}/lib`)
    expect(qpdfArgs).toContain(`-DCMAKE_INCLUDE_PATH=${layout.libjpegTurboInstallDir}/include`)
    expect(qpdfArgs).toContain(`-DLIBJPEG_LIB_PATH=${layout.libjpegTurboInstallDir}/lib/libjpeg.a`)
    expect(qpdfArgs).toContain(`-DLIBJPEG_H_PATH=${layout.libjpegTurboInstallDir}/include`)
    expect(env['PKG_CONFIG_PATH']).toBeUndefined()
    expect(env['PKG_CONFIG_LIBDIR']).toBeUndefined()
  })

  test('rejects non-system absolute qpdf dynamic-library references', () => {
    const output = `/tmp/qpdf:
\t/usr/lib/libz.1.dylib (compatibility version 1.0.0, current version 1.2.12)
\t/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation (compatibility version 150.0.0, current version 3500.0.0)
\t@loader_path/libpackaged.dylib (compatibility version 1.0.0, current version 1.0.0)
\t/opt/homebrew/opt/jpeg-turbo/lib/libjpeg.8.dylib (compatibility version 8.0.0, current version 8.3.2)
\t/usr/local/lib/libcrypto.3.dylib (compatibility version 3.0.0, current version 3.0.0)
`

    expect(findForbiddenMacosDynamicLibraryReferences(output)).toEqual([
      '/opt/homebrew/opt/jpeg-turbo/lib/libjpeg.8.dylib',
      '/usr/local/lib/libcrypto.3.dylib'
    ])
  })

  test('qpdf uses staged atomic promotion instead of deleting the working install before validation', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools.ts').text()
    const start = source.indexOf('export const installManagedQpdfMacos')
    const installSource = source.slice(start)

    expect(installSource).toContain('createManagedToolStagingDirectory(qpdfToolDir)')
    expect(installSource).toContain('promoteManagedToolDirectory({')
    expect(installSource).toContain("writeManagedSourceArtifactManifest({ tool: 'qpdf'")
    expect(source).not.toContain('cleanupFailedManagedQpdfInstall')
    expect(installSource).not.toContain('await recreateDir(qpdfToolDir)')
  })

  test('document setup validates qpdf health before trusting an existing runtime binary', async () => {
    const source = await Bun.file('src/cli/commands/setup-and-utilities/setup/setup-download/dl-document/document.ts').text()
    const start = source.indexOf('const installQpdf')
    const end = source.indexOf('export const setupDocumentTools')
    const installSource = source.slice(start, end)
    const healthIndex = installSource.indexOf('await resolveHealthyQpdfToolInfo()')
    const installIndex = installSource.indexOf("l.write('info', 'Installing qpdf')")
    const darwinInstallIndex = installSource.indexOf('await installManagedQpdfMacos()')
    const linuxInstallIndex = installSource.indexOf("await runInherit('sudo', ['apt', 'install', '-y', 'qpdf'])")
    const refreshIndexes = [...installSource.matchAll(/await refreshQpdfHealthCache\(\{ repairManaged: false \}\)/g)]
      .map(match => match.index ?? -1)

    expect(source).toContain("import { refreshQpdfHealthCache, resolveHealthyQpdfToolInfo }")
    expect(installSource).toContain("await hasHealthyManagedSourceInstall('qpdf')")
    expect(healthIndex).toBeGreaterThanOrEqual(0)
    expect(installIndex).toBeGreaterThanOrEqual(0)
    expect(darwinInstallIndex).toBeGreaterThanOrEqual(0)
    expect(linuxInstallIndex).toBeGreaterThanOrEqual(0)
    expect(healthIndex).toBeLessThan(installIndex)
    expect(refreshIndexes.some(index => index > darwinInstallIndex && index < linuxInstallIndex)).toBe(true)
    expect(refreshIndexes.some(index => index > linuxInstallIndex)).toBe(true)
    expect(installSource).not.toContain("if (hasRuntimeTool('qpdf'))")
  })
})

describe('managed uv resolution', () => {
  test('maps supported platforms to uv release assets', () => {
    expect(resolveUvAssetName('darwin', 'arm64')).toBe('uv-aarch64-apple-darwin.tar.gz')
    expect(resolveUvAssetName('darwin', 'x64')).toBe('uv-x86_64-apple-darwin.tar.gz')
    expect(resolveUvAssetName('linux', 'arm64')).toBe('uv-aarch64-unknown-linux-gnu.tar.gz')
    expect(resolveUvAssetName('linux', 'x64')).toBe('uv-x86_64-unknown-linux-gnu.tar.gz')
    expect(resolveUvDownloadUrl('0.11.14', 'uv-x86_64-apple-darwin.tar.gz')).toBe(
      'https://github.com/astral-sh/uv/releases/download/0.11.14/uv-x86_64-apple-darwin.tar.gz'
    )
  })

  test('prefers PATH uv before managed uv and falls back to managed uv', async () => {
    const dir = await makeTempDir()
    const managed = join(dir, 'uv')
    await Bun.write(managed, 'fake uv')
    await chmod(managed, 0o755)

    expect(await resolveUvCommandFromCandidates('/path/uv', managed)).toBe('/path/uv')
    expect(await resolveUvCommandFromCandidates(null, managed)).toBe(managed)
  })
})

describe('llama setup model metadata', () => {
  test('records setup-managed llama model downloads without probing external caches', async () => {
    const dir = await makeTempDir()
    const metadataPath = join(dir, 'setup-managed-models.json')

    await recordSetupManagedLlamaModel('ggml-org/gemma-3-270m-it-GGUF', {
      metadataPath,
      now: new Date('2026-01-02T03:04:05.000Z')
    })

    const metadata = await readLlamaSetupModelMetadata(metadataPath)
    expect(metadata.models['ggml-org/gemma-3-270m-it-GGUF']).toEqual({
      requestedModel: 'ggml-org/gemma-3-270m-it-GGUF',
      repo: 'ggml-org/gemma-3-270m-it-GGUF',
      downloadedAt: '2026-01-02T03:04:05.000Z'
    })
    expect(await hasSetupManagedLlamaModel('ggml-org/gemma-3-270m-it-GGUF', metadataPath)).toBe(true)
    expect(await hasSetupManagedLlamaModel('ggml-org/Qwen3-0.6B-GGUF', metadataPath)).toBe(false)
  })

  test('ignores malformed llama metadata instead of trusting an unknown cache', () => {
    expect(parseLlamaSetupModelMetadata('{bad json')).toEqual({ version: 1, models: {} })
    expect(parseLlamaSetupModelMetadata(JSON.stringify({
      version: 1,
      models: {
        bad: { repo: 'ggml-org/bad' }
      }
    }))).toEqual({ version: 1, models: {} })
  })
})

describe('GitHub archive URLs', () => {
  test('builds tag and commit archive URLs', () => {
    expect(buildGithubArchiveUrl({ owner: 'ggerganov', repo: 'whisper.cpp', ref: 'v1.7.4' })).toBe(
      'https://github.com/ggerganov/whisper.cpp/archive/refs/tags/v1.7.4.tar.gz'
    )
    expect(buildGithubCommitArchiveUrl({ owner: 'revdotcom', repo: 'reverb', ref: 'abc123' })).toBe(
      'https://github.com/revdotcom/reverb/archive/abc123.tar.gz'
    )
  })
})

describe('Hugging Face downloader', () => {
  test('sends auth headers and filters files with allow patterns', async () => {
    const destination = await makeTempDir()
    const calls: Array<{ url: string, authorization: string | null }> = []
    const fetchImpl = mockFetch(async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(url), authorization: new Headers(init?.headers).get('Authorization') })
      if (String(url).includes('/tree/')) {
        return Response.json([
          { path: 'reverb_asr_v1.pt', type: 'file' },
          { path: 'config.yaml', type: 'file' },
          { path: 'README.md', type: 'file' }
        ])
      }
      return new Response(`download:${String(url)}`)
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      revision: 'main',
      token: 'hf_test',
      destination,
      allowPatterns: ['*.pt', '*.yaml'],
      requiredFiles: ['reverb_asr_v1.pt', 'config.yaml'],
      fetchImpl
    })

    expect(calls.every((call) => call.authorization === 'Bearer hf_test')).toBe(true)
    expect(await Bun.file(join(destination, 'README.md')).exists()).toBe(false)
    expect(await Bun.file(join(destination, 'reverb_asr_v1.pt')).exists()).toBe(true)
    expect(await Bun.file(join(destination, 'config.yaml')).exists()).toBe(true)
  })

  test('downloads the complete Reverb ASR runtime asset set', async () => {
    const destination = await makeTempDir()
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        return Response.json([
          ...REVERB_ASR_REQUIRED_FILES.map(path => ({ path, type: 'file' })),
          { path: 'README.md', type: 'file' }
        ])
      }
      return new Response(`download:${String(url)}`)
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      revision: 'main',
      token: 'hf_test',
      destination,
      allowPatterns: [...REVERB_ASR_REQUIRED_FILES],
      requiredFiles: [...REVERB_ASR_REQUIRED_FILES],
      fetchImpl
    })

    for (const file of REVERB_ASR_REQUIRED_FILES) {
      expect(await Bun.file(join(destination, file)).exists()).toBe(true)
    }
    expect(await Bun.file(join(destination, 'README.md')).exists()).toBe(false)
  })

  test('downloads the complete Reverb diarization runtime asset sets', async () => {
    const pipelineDestination = await makeTempDir()
    const embeddingDestination = await makeTempDir()
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        if (String(url).includes('pyannote-wespeaker-voxceleb-resnet34-LM')) {
          return Response.json([
            ...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES.map(path => ({ path, type: 'file' })),
            { path: 'README.md', type: 'file' }
          ])
        }
        return Response.json([
          ...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES.map(path => ({ path, type: 'file' })),
          { path: 'README.md', type: 'file' }
        ])
      }
      return new Response(`download:${String(url)}`)
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-diarization-v2',
      revision: 'main',
      token: 'hf_test',
      destination: pipelineDestination,
      allowPatterns: [...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES],
      requiredFiles: [...REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES],
      fetchImpl
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/pyannote-wespeaker-voxceleb-resnet34-LM',
      revision: 'main',
      token: 'hf_test',
      destination: embeddingDestination,
      allowPatterns: [...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES],
      requiredFiles: [...REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES],
      fetchImpl
    })

    for (const file of REVERB_DIARIZATION_PIPELINE_REQUIRED_FILES) {
      expect(await Bun.file(join(pipelineDestination, file)).exists()).toBe(true)
    }
    for (const file of REVERB_DIARIZATION_EMBEDDING_REQUIRED_FILES) {
      expect(await Bun.file(join(embeddingDestination, file)).exists()).toBe(true)
    }
    expect(await Bun.file(join(pipelineDestination, 'README.md')).exists()).toBe(false)
    expect(await Bun.file(join(embeddingDestination, 'README.md')).exists()).toBe(false)
  })

  test('retries retryable listing failures', async () => {
    const destination = await makeTempDir()
    let treeCalls = 0
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        treeCalls++
        if (treeCalls === 1) {
          return new Response('temporary outage', { status: 503, statusText: 'Service Unavailable' })
        }
        return Response.json([{ path: 'config.yaml', type: 'file' }])
      }
      return new Response('ok')
    })

    await downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      token: 'hf_test',
      destination,
      requiredFiles: ['config.yaml'],
      fetchImpl,
      retryDelayMs: 0
    })

    expect(treeCalls).toBe(2)
  })

  test('removes partial downloads on file failure', async () => {
    const destination = await makeTempDir()
    const failingResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      arrayBuffer: async () => {
        throw new Error('stream failed')
      }
    } as unknown as Response
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        return Response.json([{ path: 'config.yaml', type: 'file' }])
      }
      return failingResponse
    })

    await expect(downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      token: 'hf_test',
      destination,
      fetchImpl,
      retryDelayMs: 0,
      maxAttempts: 1
    })).rejects.toThrow('stream failed')

    const files = await readdir(destination)
    expect(files.some((file) => file.includes('.download-'))).toBe(false)
  })

  test('validates required files after download', async () => {
    const destination = await makeTempDir()
    const fetchImpl = mockFetch(async (url: string | URL | Request): Promise<Response> => {
      if (String(url).includes('/tree/')) {
        return Response.json([{ path: 'config.yaml', type: 'file' }])
      }
      return new Response('ok')
    })

    await expect(downloadHuggingFaceSnapshot({
      repoId: 'Revai/reverb-asr',
      token: 'hf_test',
      destination,
      requiredFiles: ['reverb_asr_v1.pt', 'config.yaml'],
      fetchImpl
    })).rejects.toThrow('Missing required Hugging Face files: reverb_asr_v1.pt')
  })
})
