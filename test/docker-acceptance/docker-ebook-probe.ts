export const FB2_CHAPTERS = [
  { title: 'Chapter 1: The Copper Kite', text: 'This synthetic chapter follows a copper kite above a quiet green field.' },
  { title: 'Chapter 2: The Lantern Bridge', text: 'This synthetic chapter crosses a lantern bridge beneath a clear blue sky.' },
] as const

export const FB2_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info><genre>prose</genre><author><first-name>AutoShow</first-name><last-name>Fixture</last-name></author><book-title>AutoShow Synthetic Conversion Fixture</book-title><lang>en</lang></title-info>
    <document-info><author><first-name>AutoShow</first-name><last-name>Fixture</last-name></author><date value="2026-10-19">2026-10-19</date><id>autoshow-authored-fb2-acceptance</id><version>1.0</version></document-info>
  </description>
  <body>${FB2_CHAPTERS.map(({ title, text }, index) => `<section id="chapter-${index + 1}"><title><p>${title}</p></title><p>${text}</p></section>`).join('')}</body>
</FictionBook>
`

// Python is already shipped for yt-dlp and document fixtures. Its ZIP reader
// independently checks CRCs, which the application EPUB reader does not check.
export const EPUB_INTEGRITY_SCRIPT = String.raw`
import json, posixpath, sys
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_STORED

try:
    with ZipFile(sys.argv[1]) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)):
            raise ValueError('duplicate ZIP entries')
        for name in names:
            if name.startswith('/') or '..' in name.split('/'):
                raise ValueError('unsafe ZIP entry: ' + name)
        corrupt = archive.testzip()
        if corrupt is not None:
            raise ValueError('ZIP CRC mismatch: ' + corrupt)
        if not entries or entries[0].filename != 'mimetype' or entries[0].compress_type != ZIP_STORED:
            raise ValueError('mimetype must be the first uncompressed ZIP entry')
        if archive.read('mimetype') != b'application/epub+zip':
            raise ValueError('incorrect EPUB mimetype')
        container = ET.fromstring(archive.read('META-INF/container.xml'))
        rootfile = container.find('.//{*}rootfile')
        if rootfile is None or not rootfile.get('full-path'):
            raise ValueError('container has no package rootfile')
        package_path = rootfile.get('full-path')
        package = ET.fromstring(archive.read(package_path))
        if package.tag.rsplit('}', 1)[-1] != 'package':
            raise ValueError('rootfile is not an OPF package')
        manifest = {item.get('id'): item for item in package.findall('./{*}manifest/{*}item')}
        spine = package.findall('./{*}spine/{*}itemref')
        if not spine:
            raise ValueError('package has no spine documents')
        for reference in spine:
            item = manifest.get(reference.get('idref'))
            if item is None or not item.get('href'):
                raise ValueError('spine references an absent manifest item')
            href = urlsplit(item.get('href'))
            if href.scheme or href.netloc:
                raise ValueError('spine document is not local')
            path = posixpath.normpath(posixpath.join(posixpath.dirname(package_path), unquote(href.path)))
            if path not in names:
                raise ValueError('spine document is absent: ' + path)
            document = ET.fromstring(archive.read(path))
            if not ''.join(document.itertext()).strip():
                raise ValueError('spine document is empty: ' + path)
        print(json.dumps({'entries': len(entries), 'spineDocuments': len(spine)}))
except Exception as error:
    sys.exit('Invalid converted EPUB: ' + str(error))
`

export const EBOOK_CONVERSION_PROBE = `
import { expect } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { prepareDocumentMetadata } from '/app/src/cli/commands/sources/download/document/dl-document.ts';
import { runEpubBunInspect } from '/app/src/cli/commands/text/ocr/ebook/epub/run-epub-bun-inspect.ts';

const integrityScript = ${JSON.stringify(EPUB_INTEGRITY_SCRIPT)};
async function integrity(path) {
  const child = Bun.spawn(['python3', '-c', integrityScript, path], { stdout: 'pipe', stderr: 'pipe' });
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
  return { exitCode, stdout, stderr };
}
const prepared = await prepareDocumentMetadata('/fixtures/document.fb2');
let negatives;
const converted = prepared.effectiveFilePath;
try {
  expect(prepared.step1Metadata).toMatchObject({ format: 'epub', sourceFormat: 'fb2', normalizedFormat: 'epub', conversionChain: ['calibre'] });
  expect(converted).toBeString();
  const checked = await integrity(converted);
  expect(checked.exitCode, checked.stderr).toBe(0);
  expect(JSON.parse(checked.stdout).spineDocuments).toBeGreaterThan(0);
  const inspected = await runEpubBunInspect(converted);
  for (const chapter of ${JSON.stringify(FB2_CHAPTERS)}) {
    expect(inspected.text).toContain(chapter.title);
    expect(inspected.text).toContain(chapter.text);
  }
  negatives = await mkdtemp(join(tmpdir(), 'autoshow-ebook-artifact-negative-'));
  const malformed = join(negatives, 'not-an-epub.epub');
  const truncated = join(negatives, 'truncated.epub');
  await Bun.write(malformed, 'A converter exit code alone does not establish artifact integrity.');
  const bytes = await Bun.file(converted).bytes();
  await Bun.write(truncated, bytes.subarray(0, Math.floor(bytes.length / 2)));
  for (const path of [malformed, truncated]) {
    const rejected = await integrity(path);
    expect(rejected.exitCode).not.toBe(0);
    expect(rejected.stderr).toContain('Invalid converted EPUB:');
  }
} finally {
  if (negatives) await rm(negatives, { recursive: true, force: true });
  await prepared.tempCleanup?.();
}
expect(await Bun.file(converted).exists(), 'Temporary converted EPUB was retained').toBe(false);
console.log(JSON.stringify({ status: 'passed', architecture: process.arch, checks: ['calibre-fb2-normalization', 'epub-zip-crc-and-spine-integrity', 'authored-chapter-text', 'malformed-and-truncated-artifact-rejection', 'converted-epub-cleanup'] }));
`
