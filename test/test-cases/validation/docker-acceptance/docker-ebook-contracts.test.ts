import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { FB2_CHAPTERS, FB2_FIXTURE, EPUB_INTEGRITY_SCRIPT } from '../../../docker-acceptance/docker-ebook-probe'
import { containerFixture } from '../../../docker-acceptance/docker-fixtures'
import { dockerScenarios, selectDockerScenarios } from '../../../docker-acceptance/docker-scenarios'
import type { CliOutcome, LocalExecutionAdapter } from '../../../scenarios/local-cli-contracts'
import { withTempDir } from '../../../test-utils/temp-dirs'

async function python(script: string, args: string[]) {
  const child = Bun.spawn(['python3', '-c', script, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}

const WRITE_EPUB = String.raw`
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED
path, variant = sys.argv[1:]
files = {
  'mimetype': 'application/epub+zip',
  'META-INF/container.xml': '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  'OPS/package.opf': '<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="body" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="body"/></spine></package>',
  'OPS/chapter.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Independent integrity fixture</h1><p>Unique artifact body for CRC validation.</p></body></html>'
}
if variant == 'missing-spine':
    del files['OPS/chapter.xhtml']
elif variant == 'empty-spine':
    files['OPS/package.opf'] = '<package xmlns="http://www.idpf.org/2007/opf"><manifest/><spine/></package>'
elif variant == 'malformed-xml':
    files['OPS/chapter.xhtml'] = '<html><body>Unclosed chapter'
elif variant == 'wrong-mimetype':
    files['mimetype'] = 'text/plain'
elif variant == 'missing-container':
    del files['META-INF/container.xml']
with ZipFile(path, 'w', compression=ZIP_STORED) as archive:
    for name, content in files.items():
        archive.writestr(name, content)
if variant == 'bad-crc':
    data = Path(path).read_bytes().replace(b'Unique artifact body', b'Broken artifact body', 1)
    Path(path).write_bytes(data)
elif variant == 'truncated':
    data = Path(path).read_bytes()
    Path(path).write_bytes(data[:len(data)//2])
`

test('authored FB2 fixture contains two named chapters and valid FictionBook XML', async () => {
  const checked = await python(String.raw`
import json, sys
from xml.etree import ElementTree as ET
root = ET.fromstring(sys.argv[1])
ns = {'fb': 'http://www.gribuser.ru/xml/fictionbook/2.0'}
assert root.tag == '{http://www.gribuser.ru/xml/fictionbook/2.0}FictionBook'
sections = root.findall('./fb:body/fb:section', ns)
print(json.dumps([{'title': section.find('./fb:title/fb:p', ns).text, 'text': section.find('./fb:p', ns).text} for section in sections]))
`, [FB2_FIXTURE])
  expect(checked.exitCode, checked.stderr).toBe(0)
  expect(JSON.parse(checked.stdout)).toEqual(FB2_CHAPTERS)
  expect(containerFixture('fb2')).toBe('/fixtures/document.fb2')
  expect(containerFixture('malformedFb2')).toBe('/fixtures/malformed.fb2')
})

test('EPUB artifact integrity accepts an independently authored ZIP with a readable referenced spine', async () => {
  await withTempDir('autoshow-epub-integrity-', async root => {
    const path = join(root, 'valid.epub')
    const created = await python(WRITE_EPUB, [path, 'valid'])
    expect(created.exitCode, created.stderr).toBe(0)
    const checked = await python(EPUB_INTEGRITY_SCRIPT, [path])
    expect(checked.exitCode, checked.stderr).toBe(0)
    expect(JSON.parse(checked.stdout)).toEqual({ entries: 4, spineDocuments: 1 })
  })
})

for (const [variant, diagnostic] of [
  ['missing-spine', 'spine document is absent'],
  ['empty-spine', 'package has no spine documents'],
  ['malformed-xml', 'no element found'],
  ['wrong-mimetype', 'incorrect EPUB mimetype'],
  ['missing-container', 'META-INF/container.xml'],
  ['bad-crc', 'CRC'],
  ['truncated', 'not a zip file'],
] as const) test(`EPUB artifact integrity rejects ${variant} after a successful fixture process`, async () => {
  await withTempDir('autoshow-epub-negative-', async root => {
    const path = join(root, 'invalid.epub')
    const created = await python(WRITE_EPUB, [path, variant])
    expect(created.exitCode, created.stderr).toBe(0)
    const checked = await python(EPUB_INTEGRITY_SCRIPT, [path])
    expect(checked.exitCode).not.toBe(0)
    expect(checked.stderr).toContain('Invalid converted EPUB:')
    expect(checked.stderr).toContain(diagnostic)
  })
})

const adapter = { hostPath: (path: string) => path } as LocalExecutionAdapter

async function extraction(root: string): Promise<CliOutcome> {
  await Bun.write(join(root, 'manifest.json'), JSON.stringify({ command: 'extract', scope: 'single', items: [{
    status: 'full', extractRoute: 'document', providers: [], metadata: {
      step1: { format: 'epub', sourceFormat: 'fb2', normalizedFormat: 'epub', conversionChain: ['calibre'] },
      step2: {
        extractionMethod: 'epub-text', inputFamily: 'epub', normalizedFrom: 'fb2', conversionChain: ['calibre'], outputFidelity: 'cleaned-epub-text',
        chapterExport: { sourceFormat: 'epub', normalizedFrom: 'fb2', mode: 'chapters', directories: ['chapters'], logicalChapterCount: 2 }
      },
      resolvedStep2: { route: 'native-document', sourceKind: 'epub' }
    }
  }] }))
  await Bun.write(join(root, 'extraction.txt'), FB2_CHAPTERS.map(chapter => `${chapter.title}\n\n${chapter.text}`).join('\n\n'))
  for (const [index, chapter] of FB2_CHAPTERS.entries()) await Bun.write(join(root, 'chapters', `${index + 1}.txt`), `${chapter.title}\n\n${chapter.text}\n`)
  return { exitCode: 0, stdout: '', stderr: '', outputDir: root, outputRoot: root }
}

test('core acceptance requires offline FB2 success and malformed-input rejection through the public CLI', () => {
  const selected = selectDockerScenarios({ suite: 'core' })
  expect(selected.find(scenario => scenario.id === 'fb2-calibre')).toMatchObject({ network: 'none', args: ['extract', '/fixtures/document.fb2'] })
  expect(selected.find(scenario => scenario.id === 'reject-malformed-fb2')).toMatchObject({ network: 'none', args: ['extract', '/fixtures/malformed.fb2'] })
  expect(() => selectDockerScenarios({ suite: 'core' }, dockerScenarios().filter(scenario => scenario.id !== 'fb2-calibre'))).toThrow('Missing offline Calibre conversion coverage')
})

test('FB2 acceptance checks normalized metadata and authored text in extraction and chapter artifacts', async () => {
  await withTempDir('autoshow-fb2-scenario-', async root => {
    const scenario = dockerScenarios().find(item => item.id === 'fb2-calibre')!
    const result = await extraction(root)
    await scenario.verify(adapter, result)
    await Bun.write(join(root, 'extraction.txt'), 'Transport and artifact integrity passed but the text is wrong.\n')
    await expect(scenario.verify(adapter, result)).rejects.toThrow()
    await extraction(root)
    await Bun.write(join(root, 'chapters', '1.txt'), `${FB2_CHAPTERS[0].title}\n\nWrong chapter body.\n`)
    await expect(scenario.verify(adapter, result)).rejects.toThrow('Missing authored chapter export')
  })
})

test('malformed FB2 rejection requires a failed command and a Calibre diagnostic without a successful run', async () => {
  const scenario = dockerScenarios().find(item => item.id === 'reject-malformed-fb2')!
  const failed: CliOutcome = { exitCode: 1, stdout: '', stderr: 'Calibre ebook-convert failed: input is not XML', outputDir: null, outputRoot: '/unused' }
  await scenario.verify(adapter, failed)
  await expect(scenario.verify(adapter, { ...failed, exitCode: 0 })).rejects.toThrow()
  await expect(scenario.verify(adapter, { ...failed, stderr: 'Unexpected failure' })).rejects.toThrow()
  await expect(scenario.verify(adapter, { ...failed, outputDir: '/unexpected-run' })).rejects.toThrow()
})
