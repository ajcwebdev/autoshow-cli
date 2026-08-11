import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  imageReferenceToDataUrl,
  imageReferenceToInlineDataPart,
  validateImageInputReferences
} from '~/cli/commands/process-steps/step-5-image/image-utils/image-inputs'
import {
  validateVideoMediaReferences,
  videoMediaReferenceToGeminiInlineData,
  videoMediaReferenceToUrlOrDataUrl
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-media-inputs'
import { installMockFetch, setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'

const tempDirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-media-reference-' })
const imageValidation = {
  provider: 'test-image',
  model: 'image-model',
  allowedMimeTypes: ['image/png', 'image/jpeg']
} as const
const videoImageValidation = {
  flagName: '--video-input-image',
  provider: 'test-video',
  model: 'video-model',
  kind: 'image'
} as const

describe('media reference differential contracts', () => {
  test('preserves validation behavior across local files, URLs, and data URLs', async () => {
    const dir = await tempDirs.make()
    const pngPath = join(dir, 'reference.png')
    const unknownPath = join(dir, 'reference.unknown')
    await writeFile(pngPath, new Uint8Array([1, 2, 3]))
    await writeFile(unknownPath, new Uint8Array([4, 5, 6]))

    expect(() => validateImageInputReferences([pngPath, 'https://example.com/no-extension'], imageValidation)).not.toThrow()
    expect(() => validateVideoMediaReferences([pngPath, 'https://example.com/no-extension'], videoImageValidation)).not.toThrow()

    expect(() => validateImageInputReferences(['data:image/jpg;base64,AQID'], imageValidation))
      .toThrow('Unsupported --image-input value "data:image/jpg;base64,AQID"')
    expect(() => validateVideoMediaReferences(['data:image/jpg;base64,AQID'], videoImageValidation)).not.toThrow()

    expect(() => validateImageInputReferences(['data:image/gif;base64,AQID'], imageValidation))
      .toThrow('Unsupported --image-input value "data:image/gif;base64,AQID"')
    expect(() => validateVideoMediaReferences(['data:image/gif;base64,AQID'], videoImageValidation))
      .toThrow('--video-input-image file "data:image/gif;base64,AQID" does not exist')

    expect(() => validateImageInputReferences([unknownPath], imageValidation))
      .toThrow(`Unsupported --image-input value "${unknownPath}"`)
    expect(() => validateVideoMediaReferences([unknownPath], videoImageValidation))
      .toThrow(`Unsupported --video-input-image value "${unknownPath}"`)
  })

  test('preserves the unknown-local-MIME conversion fork', async () => {
    const dir = await tempDirs.make()
    const unknownPath = join(dir, 'reference.unknown')
    await writeFile(unknownPath, new Uint8Array([1, 2, 3]))

    expect(await imageReferenceToDataUrl(unknownPath)).toBe('data:image/png;base64,AQID')
    await expect(videoMediaReferenceToUrlOrDataUrl(unknownPath, 'image'))
      .rejects.toThrow(`Unsupported local media input "${unknownPath}". Expected JPEG, PNG, BMP, or WebP content for image input.`)
  })

  test('preserves fetched content-type acceptance and URL-extension fallback', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    installMockFetch((call) => {
      if (call.url.endsWith('/image-reference')) {
        return new Response(bytes, { headers: { 'content-type': 'image/gif; charset=binary' } })
      }
      if (call.url.endsWith('/video-reference')) {
        return new Response(bytes, { headers: { 'content-type': 'image/gif' } })
      }
      return new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })
    })

    await expect(imageReferenceToInlineDataPart('https://example.com/image-reference')).resolves.toEqual({
      inlineData: { mimeType: 'image/gif', data: 'AQID' }
    })
    await expect(videoMediaReferenceToGeminiInlineData('https://example.com/video-reference', 'image'))
      .rejects.toThrow('Unsupported media URL "https://example.com/video-reference". Expected JPEG, PNG, BMP, or WebP content for image input.')
    await expect(videoMediaReferenceToGeminiInlineData('https://example.com/reference.png', 'image')).resolves.toEqual({
      inlineData: { mimeType: 'image/png', data: 'AQID' }
    })
  })

  test('normalizes MIME aliases and includes download status metadata', async () => {
    await expect(videoMediaReferenceToGeminiInlineData('data:image/jpg;base64,AQID', 'image')).resolves.toEqual({
      inlineData: { mimeType: 'image/jpeg', data: 'AQID' }
    })

    installMockFetch(() => new Response('rate limited', { status: 429 }))

    try {
      await imageReferenceToInlineDataPart('https://example.com/reference.png')
      throw new Error('Expected image download to fail')
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Image reference download failed (429): https://example.com/reference.png',
        stage: 'image:inputs',
        status: 429
      })
    }

    try {
      await videoMediaReferenceToGeminiInlineData('https://example.com/reference.png', 'image')
      throw new Error('Expected video media download to fail')
    } catch (error) {
      expect(error).toMatchObject({
        message: 'Video media input download failed (429): https://example.com/reference.png',
        stage: 'video:media-inputs',
        status: 429
      })
    }
  })
})
