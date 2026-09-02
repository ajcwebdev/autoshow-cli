import { describe, expect, test } from 'bun:test'
import { createServer, type Server, type Socket } from 'node:net'
import type { AddressInfo } from 'node:net'
import { extractErrorMetadata, serializeDiagnosticError } from '~/utils/error-handler'
import { classifyFetchRetry, classifyPaidCreateRetry } from '~/utils/retries'

const listen = async (server: Server): Promise<number> => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return (server.address() as AddressInfo).port
}

const close = async (server: Server, sockets: Set<Socket>): Promise<void> => {
  for (const socket of sockets) socket.destroy()
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
}

describe('Bun 1.4 fetch error contracts', () => {
  test('bounded TypeError cause metadata remains useful without widening paid-create retries', () => {
    let nested: Error = Object.assign(new Error('deepest network detail'), { privateDepthMarker: 'depth-7' })
    for (let depth = 0; depth < 7; depth += 1) {
      nested = new Error(`cause-${depth}`, { cause: nested })
    }
    const cause = Object.assign(new TypeError('DNS lookup failed', { cause: nested }), {
      errno: -3008,
      syscall: 'getaddrinfo',
      hostname: 'fixture.invalid'
    })
    const error = Object.assign(new TypeError('fetch failed', { cause }), { code: 'ENOTFOUND' })

    expect(extractErrorMetadata(error)).toMatchObject({
      code: 'ENOTFOUND',
      errno: -3008,
      syscall: 'getaddrinfo',
      hostname: 'fixture.invalid'
    })
    const diagnostic = serializeDiagnosticError(error)
    expect(diagnostic['code']).toBe('ENOTFOUND')
    expect(JSON.stringify(diagnostic)).toContain('[Truncated]')
    expect(JSON.stringify(diagnostic)).not.toContain('depth-7')

    expect(classifyFetchRetry(error, 'runtime_http_read')).toMatchObject({
      shouldRetry: true,
      reason: 'network error'
    })
    expect(classifyPaidCreateRetry(error)).toEqual({
      shouldRetry: false,
      delayMs: 0,
      reasonCode: 'unsafe_paid_redispatch',
      reason: 'paid create outcome is ambiguous'
    })
    expect(classifyPaidCreateRetry(new TypeError('fetch failed', {
      cause: { code: 'ENOTFOUND', status: 429 }
    }))).toMatchObject({ shouldRetry: false })
  })

  test('reserved invalid domains surface ENOTFOUND for read retries but not paid redispatch', async () => {
    let caught: unknown
    try {
      await fetch('http://autoshow-fetch-contract.invalid', { signal: AbortSignal.timeout(3_000) })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(TypeError)
    expect(caught).toMatchObject({ code: 'ENOTFOUND' })
    expect(classifyFetchRetry(caught, 'runtime_http_read')).toMatchObject({ shouldRetry: true, reason: 'network error' })
    expect(classifyPaidCreateRetry(caught)).toMatchObject({ shouldRetry: false })
  })

  test('aborting after response arrival rejects the body and marks it used', async () => {
    const sockets = new Set<Socket>()
    const server = createServer(socket => {
      sockets.add(socket)
      socket.once('close', () => sockets.delete(socket))
      socket.write('HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\npartial')
    })
    const port = await listen(server)
    const controller = new AbortController()

    try {
      const response = await fetch(`http://127.0.0.1:${port}/abort`, { signal: controller.signal })
      expect(response.bodyUsed).toBe(false)
      controller.abort()
      await expect(response.text()).rejects.toMatchObject({ name: 'AbortError' })
      expect(response.bodyUsed).toBe(true)
    } finally {
      await close(server, sockets)
    }
  })

  test('a failed response-body read still marks bodyUsed', async () => {
    const sockets = new Set<Socket>()
    const server = createServer(socket => {
      sockets.add(socket)
      socket.once('close', () => sockets.delete(socket))
      socket.end('HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\nshort')
    })
    const port = await listen(server)

    try {
      const response = await fetch(`http://127.0.0.1:${port}/truncated`)
      expect(response.bodyUsed).toBe(false)
      await expect(response.arrayBuffer()).rejects.toBeInstanceOf(TypeError)
      expect(response.bodyUsed).toBe(true)
    } finally {
      await close(server, sockets)
    }
  })

  test('consumed responses cannot be cloned or read again', async () => {
    const response = new Response('one use only')

    expect(await response.text()).toBe('one use only')
    expect(response.bodyUsed).toBe(true)
    expect(() => response.clone()).toThrow(TypeError)
    await expect(response.text()).rejects.toBeInstanceOf(TypeError)
  })

  test('paid-create admission remains limited to explicit 425 and 429 responses', () => {
    for (const status of [425, 429]) {
      expect(classifyPaidCreateRetry(Object.assign(new Error('provider rejected create'), { status }))).toMatchObject({ shouldRetry: true })
    }
    for (const status of [408, 500, 502, 503, 504]) {
      expect(classifyPaidCreateRetry(Object.assign(new Error('ambiguous create'), { status }))).toMatchObject({ shouldRetry: false })
    }
  })
})
