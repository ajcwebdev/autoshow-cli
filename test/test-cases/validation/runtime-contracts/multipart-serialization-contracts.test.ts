import { describe, expect, test } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { requireDefined } from '../../../test-utils/value-assertions'

type UploadedPart = {
  bytes: number[]
  name: string
  type: string
}

type MultipartObservation = {
  contentType: string
  fields: Record<string, string[]>
  files: Record<string, UploadedPart[]>
}

const uploadedPart = async (value: File): Promise<UploadedPart> => ({
  bytes: [...new Uint8Array(await value.arrayBuffer())],
  name: value.name,
  type: value.type
})

const observeMultipart = async (request: Request): Promise<MultipartObservation> => {
  const form = await request.formData()
  const fields: Record<string, string[]> = {}
  const files: Record<string, UploadedPart[]> = {}

  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') {
      ;(fields[key] ??= []).push(value)
    } else {
      ;(files[key] ??= []).push(await uploadedPart(value))
    }
  }

  return {
    contentType: request.headers.get('content-type') ?? '',
    fields,
    files
  }
}

describe('Bun 1.4 multipart contracts', () => {
  test('loopback fetch round-trips binary and text form values with a Bun-managed boundary', async () => {
    await withTempDir('autoshow-multipart-', async (dir) => {
      const bunFilePath = join(dir, 'bun file 雪.bin')
      const bunFileBytes = new Uint8Array([0x42, 0x00, 0x75, 0x6e, 0xff])
      await writeFile(bunFilePath, bunFileBytes)

      let resolveObservation: (value: MultipartObservation) => void = () => {}
      let rejectObservation: (reason: unknown) => void = () => {}
      const observation = new Promise<MultipartObservation>((resolve, reject) => {
        resolveObservation = resolve
        rejectObservation = reject
      })
      const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        async fetch(request) {
          try {
            resolveObservation(await observeMultipart(request))
            return new Response('ok')
          } catch (error) {
            rejectObservation(error)
            return new Response('invalid multipart body', { status: 400 })
          }
        }
      })

      try {
        const form = new FormData()
        form.append('nul_blob', new Blob([new Uint8Array([0x00, 0x01, 0x00, 0xfe])], { type: 'application/octet-stream' }), 'nul bytes.bin')
        form.append('bun_file', Bun.file(bunFilePath), 'bun file 雪.bin')
        form.append('blob', new Blob(['blob payload'], { type: 'text/plain' }), 'blob payload.txt')
        form.append('file', new File([new Uint8Array([0xc3, 0xa9, 0x00, 0x7f])], 'résumé audio 雪.asset', { type: 'application/x-autoshow-fixture' }))
        form.append('repeat', 'first')
        form.append('repeat', 'second')
        form.append('lone_cr', 'left\rright')
        form.append('lone_lf', 'up\ndown')

        const response = await fetch(`http://127.0.0.1:${server.port}/multipart`, {
          method: 'POST',
          body: form
        })
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('ok')

        const received = await observation
        expect(received.contentType).toMatch(/^multipart\/form-data; boundary=----WebKitFormBoundary[0-9a-f]+$/)
        expect(received.fields).toEqual({
          repeat: ['first', 'second'],
          lone_cr: ['left\r\nright'],
          lone_lf: ['up\r\ndown']
        })
        expect(requireDefined(received.files['nul_blob'], 'NUL blob')).toEqual([{
          bytes: [0x00, 0x01, 0x00, 0xfe],
          name: 'nul bytes.bin',
          type: 'application/octet-stream'
        }])
        expect(requireDefined(received.files['bun_file'], 'Bun.file part')).toEqual([{
          bytes: [...bunFileBytes],
          name: 'bun file 雪.bin',
          type: 'application/octet-stream'
        }])
        expect(requireDefined(received.files['blob'], 'Blob part')).toEqual([{
          bytes: [...new TextEncoder().encode('blob payload')],
          name: 'blob payload.txt',
          type: 'text/plain;charset=utf-8'
        }])
        expect(requireDefined(received.files['file'], 'File part')).toEqual([{
          bytes: [0xc3, 0xa9, 0x00, 0x7f],
          name: 'résumé audio 雪.asset',
          type: ''
        }])
      } finally {
        await server.stop(true)
      }
    })
  })

  test('source clients never manually supply a multipart Content-Type boundary', async () => {
    const sourceFiles = await Array.fromAsync(new Bun.Glob('src/**/*.ts').scan({ onlyFiles: true }))
    const offenders: string[] = []

    for (const sourceFile of sourceFiles) {
      const source = await Bun.file(sourceFile).text()
      if (source.toLowerCase().includes('multipart/form-data')) offenders.push(sourceFile)
    }

    expect(offenders.sort()).toEqual([])
  })
})
