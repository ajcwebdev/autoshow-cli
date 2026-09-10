import { expect, test } from 'bun:test'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { writeStoredZip } from './epub-contracts/shared'
import { readDocxMarkdown } from '~/cli/commands/text/ocr/office/docx-markdown'

const cli = resolve(import.meta.dir, '../../../../../src/cli/create-cli.ts')
const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Example</w:t></w:r></w:p><w:p><w:r><w:t>Plain text.</w:t></w:r></w:p></w:body></w:document>'
async function run(cwd: string, args: string[]) {
  const child = Bun.spawn([process.execPath, '--no-env-file', cli, ...args], { cwd, env: { PATH: process.env['PATH'], HOME: cwd, BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0" }, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, text: stdout + stderr }
}

test('DOCX Markdown zero-cost preflight writes nothing, execution registers Markdown; ordinary extract unchanged', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docx-contract-'))
  try {
    await writeStoredZip(join(dir, 'fixture.docx'), { 'word/document.xml': xml })
    const args = ['extract', 'fixture.docx', '--docx-markdown', '--output-dir', 'result']
    const price = await run(dir, [...args, '--price', '--json'])
    expect(price.code, price.text).toBe(0)
    expect(price.text).toContain('extraction.md')
    expect(price.text).toMatch(/0\.00/)
    expect(await readdir(dir)).toEqual(['fixture.docx'])
    const result = await run(dir, args)
    expect(result.code, result.text).toBe(0)
    expect(await Bun.file(join(dir, 'result/extraction.md')).text()).toBe('# Example\n\nPlain text.\n')
    expect(await Bun.file(join(dir, 'result/extraction.txt')).text()).toContain('Plain text.')
    expect(await Bun.file(join(dir, 'result/manifest.json')).text()).toContain('extraction.md')
    const ordinary = await run(dir, ['extract', 'fixture.docx', '--output-dir', 'ordinary'])
    expect(ordinary.code, ordinary.text).toBe(0)
    expect(await Bun.file(join(dir, 'ordinary/extraction.md')).exists()).toBe(false)
  } finally { await rm(dir, { recursive: true, force: true }) }
}, 30_000)

test('DOCX rejects invalid ZIP, absent document, malformed XML, remote input and provider flags before writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docx-errors-'))
  try {
    await Bun.write(join(dir, 'bad.docx'), 'invalid zip')
    await expect(readDocxMarkdown(join(dir, 'bad.docx'))).rejects.toThrow()
    await writeStoredZip(join(dir, 'missing.docx'), { 'other.xml': '<a/>' })
    await expect(readDocxMarkdown(join(dir, 'missing.docx'))).rejects.toThrow('word/document.xml')
    await writeStoredZip(join(dir, 'malformed.docx'), { 'word/document.xml': '<w:document>' })
    await expect(readDocxMarkdown(join(dir, 'malformed.docx'))).rejects.toThrow('Invalid word/document.xml')
    await writeStoredZip(join(dir, 'fixture.docx'), { 'word/document.xml': xml })
    for (const args of [['bad.docx'], ['missing.docx'], ['malformed.docx'], ['https://example.com/file.docx'], ['fixture.docx', '--provider', 'openai']]) {
      const result = await run(dir, ['extract', ...args, '--docx-markdown', '--output-dir', 'result', '--price'])
      expect(result.code, result.text).not.toBe(0)
    }
    expect(await Bun.file(join(dir, 'result/manifest.json')).exists()).toBe(false)
  } finally { await rm(dir, { recursive: true, force: true }) }
}, 30_000)
