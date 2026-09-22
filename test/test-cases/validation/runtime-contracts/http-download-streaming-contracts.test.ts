import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { downloadGeneratedFile, downloadGeneratedImage, downloadGeneratedVideo } from '~/utils/polled-job-client/generated-file'
import { geminiDownloadFile } from '~/utils/gemini/gemini-rest'
import { materializeMediaInput } from '~/utils/media-url'
import { downloadImageUrl } from '~/cli/commands/visuals/image/image-utils/image-output'
import { resolveVideoMediaFileForUpload, videoMediaReferenceToGeminiInlineData } from '~/cli/commands/visuals/video/video-utils/video-media-inputs'
import { HTTP_PAYLOAD_MAX_BYTES_ENV } from '~/utils/http-payload'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const dirs = setupContractSuiteLifecycle({ envKeys: [HTTP_PAYLOAD_MAX_BYTES_ENV], tempPrefix: 'autoshow-download-streaming-' })
const bytes = new Uint8Array([1, 2, 3, 4, 5, 6])
const streamedResponse = (mime = 'video/mp4'): Response => new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(bytes.slice(0, 2))
    controller.enqueue(bytes.slice(2))
    controller.close()
  }
}), { headers: { 'content-type': mime, 'content-length': String(bytes.length) } })
const read = async (path: string) => new Uint8Array(await Bun.file(path).arrayBuffer())

describe('disk downloads: mocked transport and byte integrity, not media validity', () => {
  test('all file-only consumers stream intact bytes with default, lowered, raised and reset ceilings', async () => {
    const root = await dirs.make()
    for (const ceiling of [undefined, '1', '1024', undefined]) {
      if (ceiling === undefined) delete process.env[HTTP_PAYLOAD_MAX_BYTES_ENV]
      else process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = ceiling
      installMockFetch(() => streamedResponse())
      const video = join(root, 'generated.mp4')
      expect(await downloadGeneratedVideo('https://example.test/video', 'Fixture', video)).toBe(bytes.length)
      expect(await read(video)).toEqual(bytes)
      const gemini = join(root, 'gemini.mp4')
      await geminiDownloadFile('mock-key', 'files/example', gemini)
      expect(await read(gemini)).toEqual(bytes)
      const upload = await resolveVideoMediaFileForUpload('https://example.test/video.mp4', root)
      expect(upload.mimeType).toBe('video/mp4')
      expect(await read(upload.path)).toEqual(bytes)
      const media = await materializeMediaInput('https://example.test/video.mp4')
      try { expect(await read(media.path)).toEqual(bytes) } finally { await media.cleanup() }
      installMockFetch(() => streamedResponse('image/jpeg'))
      const image = await downloadImageUrl('https://example.test/image.png', root, 0, 'png')
      expect(image.endsWith('.jpg')).toBe(true)
      expect(await read(image)).toEqual(bytes)
      await downloadGeneratedImage({ url: 'https://example.test/image', outputPath: image, outputFormat: 'jpg', providerLabel: 'Fixture', stage: 'test' })
      expect(await read(image)).toEqual(bytes)
    }
  })

  test('references needed as base64 still obey the in-memory ceiling', async () => {
    process.env[HTTP_PAYLOAD_MAX_BYTES_ENV] = '1'
    installMockFetch(() => streamedResponse())
    await expect(videoMediaReferenceToGeminiInlineData('https://example.test/video.mp4', 'video')).rejects.toThrow('ceiling')
  })

  test('empty generated images fail validation and leave no artifact', async () => {
    const path = join(await dirs.make(), 'empty.png')
    installMockFetch(() => new Response(new Uint8Array()))
    await expect(downloadGeneratedImage({ url: 'https://example.test/image', outputPath: path, outputFormat: 'png', providerLabel: 'Fixture', stage: 'test' })).rejects.toThrow('empty image')
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('a cancelled body stream removes its partial artifact without retrying', async () => {
    const path = join(await dirs.make(), 'partial.mp4')
    const cancellation = new AbortController()
    let pulls = 0
    const calls = installMockFetch(() => new Response(new ReadableStream({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(bytes)
        else {
          const error = new DOMException('fixture stream failed', 'AbortError')
          cancellation.abort(error)
          controller.error(error)
        }
      }
    }, { highWaterMark: 0 })))
    await expect(downloadGeneratedFile({ url: 'https://example.test/video', init: { signal: cancellation.signal }, outputPath: path, operationName: 'fixture', errorFactory: () => new Error('HTTP failure') })).rejects.toThrow('fixture stream failed')
    expect(calls).toHaveLength(1)
    expect(await Bun.file(path).exists()).toBe(false)
  })

  test('invalid reference MIME fails before producing an upload file', async () => {
    const root = await dirs.make()
    installMockFetch(() => streamedResponse('text/plain'))
    await expect(resolveVideoMediaFileForUpload('https://example.test/unknown', root)).rejects.toThrow('Unsupported')
    expect(await Bun.file(join(root, 'omni-upload-source.mp4')).exists()).toBe(false)
  })
})
