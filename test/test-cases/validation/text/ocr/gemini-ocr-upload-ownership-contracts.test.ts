import { describe, expect, test } from 'bun:test'
import { truncate, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { MockFetchCall } from '~/types'
import { runGeminiOcr, stageGeminiOcrUpload } from '~/cli/commands/text/ocr/ocr-services/gemini-ocr/run-gemini-ocr'
import { cleanupOcrPreparationCache, createOcrPreparationCache, getCachedCloudStagingObject } from '~/cli/commands/text/ocr/ocr-utils/preparation-cache'
import { installMockFetch, jsonResponse, setupContractSuiteLifecycle } from '../../../../test-utils/rest-contract-helpers'
import { captureLogEvents } from '../../../../test-utils/console-capture'

const tempDirs = setupContractSuiteLifecycle({
  envKeys: ['GEMINI_API_KEY'],
  tempPrefix: 'autoshow-gemini-ocr-upload-'
})

const API_ROOT = 'https://generativelanguage.googleapis.com'
const UPLOAD_SESSION_URL = 'https://upload.gemini.test/ocr-session'
const FILE_URL = `${API_ROOT}/v1beta/files/ocr-upload`
const UPLOADED_FILE = { name: 'files/ocr-upload', uri: FILE_URL, mimeType: 'application/pdf' }

type UploadMocks = {
  uploadedFile?: Record<string, unknown>
  activation?: () => Response
  deleteFile?: (init: RequestInit | undefined) => Response
  generateContent?: () => Response
}

const installUploadMocks = (mocks: UploadMocks = {}): MockFetchCall[] => installMockFetch((call, _input, init) => {
  if (call.url === `${API_ROOT}/upload/v1beta/files`) {
    return new Response('{}', { status: 200, headers: { 'x-goog-upload-url': UPLOAD_SESSION_URL } })
  }
  if (call.url === UPLOAD_SESSION_URL) {
    const command = call.headers.get('x-goog-upload-command')
    return new Response(command === 'upload' ? '{}' : JSON.stringify({ file: mocks.uploadedFile ?? UPLOADED_FILE }), {
      status: 200,
      headers: { 'x-goog-upload-status': command === 'upload' ? 'active' : 'final' }
    })
  }
  if (call.url === FILE_URL && call.method === 'GET') {
    return mocks.activation?.() ?? jsonResponse({ name: UPLOADED_FILE.name, state: 'ACTIVE' })
  }
  if (call.url === FILE_URL && call.method === 'DELETE') {
    return mocks.deleteFile?.(init) ?? jsonResponse({})
  }
  if (call.url.endsWith(':generateContent') && call.method === 'POST' && mocks.generateContent) {
    return mocks.generateContent()
  }
  throw new Error(`Unexpected Gemini OCR fetch: ${call.method} ${call.url}`)
})

const uploadCount = (calls: MockFetchCall[]): number =>
  calls.filter((call) => call.url === `${API_ROOT}/upload/v1beta/files`).length

const deleteCount = (calls: MockFetchCall[]): number =>
  calls.filter((call) => call.url === FILE_URL && call.method === 'DELETE').length

const failedActivation = (): Response => jsonResponse({ name: UPLOADED_FILE.name, state: 'FAILED' })

const writeSmallPdf = async (): Promise<string> => {
  const path = join(await tempDirs.make(), 'scan.pdf')
  await writeFile(path, new Uint8Array([37, 80, 68, 70]))
  return path
}

describe('Gemini OCR upload ownership contracts', () => {
  test('activation failure deletes the acknowledged upload once and keeps the activation error', async () => {
    const path = await writeSmallPdf()
    const calls = installUploadMocks({ activation: failedActivation })

    await expect(stageGeminiOcrUpload('gemini-key', path, 'application/pdf')).rejects.toThrow('Gemini Files API upload failed')

    expect(uploadCount(calls)).toBe(1)
    expect(deleteCount(calls)).toBe(1)
  })

  test('a missing file URI deletes the acknowledged upload once', async () => {
    const path = await writeSmallPdf()
    const calls = installUploadMocks({ uploadedFile: { name: UPLOADED_FILE.name, mimeType: 'application/pdf' } })

    await expect(stageGeminiOcrUpload('gemini-key', path, 'application/pdf')).rejects.toThrow('did not return a file URI')

    expect(deleteCount(calls)).toBe(1)
  })

  test('aborting during activation still deletes the upload, without the aborted signal', async () => {
    const path = await writeSmallPdf()
    const controller = new AbortController()
    let deleteSignalAborted: boolean | undefined
    const calls = installUploadMocks({
      activation: () => {
        controller.abort(new Error('caller cancelled OCR'))
        return jsonResponse({ name: UPLOADED_FILE.name, state: 'PROCESSING' })
      },
      deleteFile: (init) => {
        deleteSignalAborted = init?.signal?.aborted ?? false
        return jsonResponse({})
      }
    })

    await expect(stageGeminiOcrUpload('gemini-key', path, 'application/pdf', controller.signal)).rejects.toThrow('caller cancelled OCR')

    expect(deleteCount(calls)).toBe(1)
    expect(deleteSignalAborted).toBe(false)
  })

  test('a failed delete is logged as a warning and the original error still surfaces', async () => {
    const path = await writeSmallPdf()
    const calls = installUploadMocks({
      activation: failedActivation,
      deleteFile: () => jsonResponse({ error: { code: 403, message: 'permission denied' } }, { status: 403 })
    })

    const { events } = await captureLogEvents(async () => {
      await expect(stageGeminiOcrUpload('gemini-key', path, 'application/pdf')).rejects.toThrow('Gemini Files API upload failed')
    })

    expect(deleteCount(calls)).toBe(1)
    const warnings = events.filter((event) => event.level === 'warn' && event.message.includes('Failed to delete Gemini OCR upload files/ocr-upload'))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.metadata).toMatchObject({ provider: 'gemini', uploadedFileName: 'files/ocr-upload' })
  })

  test('a successful staging hands deletion to its cleanup, which deletes exactly once', async () => {
    const path = await writeSmallPdf()
    const calls = installUploadMocks()

    const staged = await stageGeminiOcrUpload('gemini-key', path, 'application/pdf')

    expect(staged).toMatchObject({ uri: FILE_URL, mimeType: 'application/pdf', name: 'files/ocr-upload' })
    expect(deleteCount(calls)).toBe(0)
    await staged.cleanup?.()
    expect(deleteCount(calls)).toBe(1)
  })

  test('the preparation cache deletes a reused upload once at disposal and never re-deletes a failed staging', async () => {
    const path = await writeSmallPdf()
    const key = { provider: 'gemini', filePath: path, mimeType: 'application/pdf' }

    const successCalls = installUploadMocks()
    const cache = createOcrPreparationCache()
    const stage = async () => await stageGeminiOcrUpload('gemini-key', path, 'application/pdf')
    await getCachedCloudStagingObject(cache, key, stage)
    await getCachedCloudStagingObject(cache, key, stage)
    expect(uploadCount(successCalls)).toBe(1)
    expect(deleteCount(successCalls)).toBe(0)
    await cleanupOcrPreparationCache(cache)
    expect(deleteCount(successCalls)).toBe(1)

    const failureCalls = installUploadMocks({ activation: failedActivation })
    const failedCache = createOcrPreparationCache()
    await expect(getCachedCloudStagingObject(failedCache, key, stage)).rejects.toThrow('Gemini Files API upload failed')
    expect(deleteCount(failureCalls)).toBe(1)
    expect(failedCache.cleanupCallbacks).toHaveLength(0)
    await cleanupOcrPreparationCache(failedCache)
    expect(deleteCount(failureCalls)).toBe(1)
  })

  test('an uncached OCR request above the inline PDF limit deletes its upload exactly once', async () => {
    process.env['GEMINI_API_KEY'] = 'gemini-key'
    const path = join(await tempDirs.make(), 'large.pdf')
    await writeFile(path, new Uint8Array([37, 80, 68, 70]))
    await truncate(path, 50 * 1024 * 1024 + 1)
    const calls = installUploadMocks({
      generateContent: () => jsonResponse({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ pages: [{ pageNumber: 1, text: 'OCR text' }] }) }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 }
      })
    })

    const result = await runGeminiOcr(path, { slug: 'large', pageCount: 1, format: 'pdf', fileSize: 50 * 1024 * 1024 + 1 }, 'gemini-3.5-flash-lite')

    expect(result.pages).toEqual([{ pageNumber: 1, method: 'ocr', text: 'OCR text' }])
    expect(uploadCount(calls)).toBe(1)
    expect(deleteCount(calls)).toBe(1)
  })
})
