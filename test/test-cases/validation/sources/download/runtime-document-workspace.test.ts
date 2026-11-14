import { expect, test } from 'bun:test'
import { dirname, relative, sep } from 'node:path'
import { downloadDocumentUrlToTempFile } from '~/cli/commands/sources/download/document/resolve-document-source'
import { RUNTIME_TEMP_DIR } from '~/utils/runtime-state'

test('document URL download retains source bytes and format in a private runtime workspace until explicit cleanup', async () => {
  const bytes = Buffer.from('Runtime workspace source bytes\n')
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: () => new Response(bytes, {
      headers: {
        'content-type': 'application/epub+zip',
        'content-disposition': 'attachment; filename="fixture.epub"'
      }
    })
  })
  let result: Awaited<ReturnType<typeof downloadDocumentUrlToTempFile>> | undefined
  try {
    result = await downloadDocumentUrlToTempFile(`http://127.0.0.1:${server.port}/source`)
    const workspace = relative(RUNTIME_TEMP_DIR, dirname(result.filePath))
    expect(workspace).not.toBe('')
    expect(workspace.startsWith(`..${sep}`)).toBe(false)
    expect(workspace.startsWith(sep)).toBe(false)
    expect(result.filePath).toEndWith(`${sep}document.epub`)
    expect(Buffer.from(await Bun.file(result.filePath).bytes())).toEqual(bytes)
    await result.cleanup()
    expect(await Bun.file(result.filePath).exists()).toBe(false)
    await result.cleanup()
  } finally {
    await result?.cleanup()
    await server.stop(true)
  }
})
