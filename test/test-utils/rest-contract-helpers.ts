import { afterEach, beforeEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EnvSnapshot, MockFetchCall, MockFetchHandler } from '~/types'

export const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : init?.headers as Record<string, string> | undefined)
    }
  })

export const bytesResponse = (
  body: Uint8Array,
  init?: ResponseInit
): Response => new Response(body, init)

const readMockFetchBody = async (
  body: RequestInit['body'] | null | undefined
): Promise<{ text: string, bytes?: number | undefined, form?: FormData | undefined }> => {
  if (typeof body === 'string') {
    return { text: body }
  }
  if (body instanceof FormData) {
    return { text: '', form: body }
  }
  if (body instanceof ArrayBuffer) {
    return { text: '', bytes: body.byteLength }
  }
  if (ArrayBuffer.isView(body)) {
    return { text: '', bytes: body.byteLength }
  }
  if (body instanceof Blob) {
    return { text: '', bytes: body.size }
  }
  return { text: '' }
}

const readMockFetchRequestBody = async (
  request: Request
): Promise<{ text: string, bytes?: number | undefined, form?: FormData | undefined }> => {
  if (request.body === null) return { text: '' }
  const clone = request.clone()
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    return { text: '', form: await clone.formData() as unknown as FormData }
  }
  if (contentType.includes('json') || contentType.startsWith('text/')) {
    return { text: await clone.text() }
  }
  const body = await clone.arrayBuffer()
  return { text: '', bytes: body.byteLength }
}

export const installMockFetch = (handler: MockFetchHandler): MockFetchCall[] => {
  const calls: MockFetchCall[] = []
  globalThis.fetch = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const request = input instanceof Request ? input : undefined
    const { text, bytes, form } = init?.body !== undefined
      ? await readMockFetchBody(init.body)
      : request !== undefined
        ? await readMockFetchRequestBody(request)
        : { text: '' }
    const call: MockFetchCall = {
      url: request?.url ?? String(input),
      method: init?.method ?? request?.method ?? 'GET',
      headers: new Headers(init?.headers ?? request?.headers),
      bodyText: text,
      ...(text.trim().startsWith('{') ? { bodyJson: JSON.parse(text) as Record<string, unknown> } : {}),
      ...(bytes !== undefined ? { bodyBytes: bytes } : {}),
      ...(form ? { form } : {})
    }
    calls.push(call)
    return await handler(call, input, init)
  }) as typeof fetch
  return calls
}

export const snapshotEnv = (keys: readonly string[]): EnvSnapshot =>
  Object.fromEntries(keys.map((key) => [key, process.env[key]]))

export const clearEnv = (keys: readonly string[]): void => {
  for (const key of keys) {
    delete process.env[key]
  }
}

export const restoreEnv = (snapshot: EnvSnapshot): void => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

export const createTempDirTracker = (
  defaultPrefix: string
): {
  make: (prefix?: string) => Promise<string>
  withDir: <T>(fn: (dir: string) => Promise<T>, prefix?: string) => Promise<T>
  cleanup: () => Promise<void>
} => {
  const tempDirs: string[] = []

  const make = async (prefix = defaultPrefix): Promise<string> => {
    const dir = await mkdtemp(join(tmpdir(), prefix))
    tempDirs.push(dir)
    return dir
  }

  return {
    make,
    withDir: async <T,>(fn: (dir: string) => Promise<T>, prefix?: string): Promise<T> =>
      await fn(await make(prefix)),
    cleanup: async (): Promise<void> => {
      await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
    }
  }
}

export const setupContractSuiteLifecycle = (
  options: {
    envKeys: readonly string[]
    tempPrefix: string
    restoreBunSleep?: boolean | undefined
    beforeEachExtra?: (() => Promise<void> | void) | undefined
    afterEachExtra?: (() => Promise<void> | void) | undefined
  }
): ReturnType<typeof createTempDirTracker> => {
  const tempDirs = createTempDirTracker(options.tempPrefix)
  let previousEnv: EnvSnapshot = {}
  let previousFetch: typeof fetch
  let previousSleep: typeof Bun.sleep | undefined

  beforeEach(async () => {
    previousFetch = globalThis.fetch
    previousEnv = snapshotEnv(options.envKeys)
    clearEnv(options.envKeys)
    if (options.restoreBunSleep === true) {
      previousSleep = Bun.sleep
    }
    await options.beforeEachExtra?.()
  })

  afterEach(async () => {
    try {
      await options.afterEachExtra?.()
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv(previousEnv)
      if (previousSleep !== undefined) {
        ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
      }
      await tempDirs.cleanup()
    }
  })

  return tempDirs
}
