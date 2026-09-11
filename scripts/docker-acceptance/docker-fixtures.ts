import { join } from 'node:path'
import { DockerEngine, containerArguments } from './docker-engine'

export const FIXTURE_NAMES: Record<string, string> = {
  audio: 'speech.mp3', video: 'speech.mp4', pdf: 'document.pdf', image: 'document.png', epub: 'document.epub',
  text: 'text.md', dialogue: 'dialogue.txt', captions: 'speech-fixed.vtt', urls: 'urls.md', batch: 'batch'
}
export function containerFixture(name: string): string {
  const file = FIXTURE_NAMES[name]
  if (!file) throw new Error(`Unknown acceptance fixture: ${name}`)
  return `/fixtures/${file}`
}
export const FIXTURE_ORIGIN = 'http://fixture:8787'

// Authored synthetic documents. No source books or user workspace content are copied.
const DOCUMENT_SCRIPT = String.raw`
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED
root = Path('/fixtures')
objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
for i in range(3):
    text = f'Chapter {i+1}: AutoShow Fixture'
    body = f'BT /F1 22 Tf 60 730 Td ({text}) Tj /F1 14 Tf 0 -40 Td (This is a synthetic document for local extraction.) Tj 0 -24 Td (The bright morning sky is blue and the grass is green.) Tj ET'.encode()
    objects += [f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {5+i*2} 0 R >>'.encode(), b'<< /Length '+str(len(body)).encode()+b' >>\nstream\n'+body+b'\nendstream']
pdf = b'%PDF-1.4\n'; offsets = [0]
for i, obj in enumerate(objects, 1):
    offsets.append(len(pdf)); pdf += f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n'
start = len(pdf)
pdf += f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
pdf += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
pdf += f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode()
(root/'document.pdf').write_bytes(pdf)
with ZipFile(root/'document.epub', 'w') as z:
    z.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
    z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">autoshow-synthetic</dc:identifier><dc:title>AutoShow Fixture</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>')
    z.writestr('OEBPS/nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">Chapter 1: Introduction to AutoShow</a></li><li><a href="two.xhtml">Chapter 2: Local Fixtures</a></li></ol></nav></body></html>')
    for name, title in [('one','Chapter 1: Introduction to AutoShow'), ('two','Chapter 2: Local Fixtures')]:
        paragraphs = ''.join('<p>This synthetic paragraph describes a blue sky, a green field, and a quiet local test. All words are authored for this fixture.</p>' for _ in range(25))
        z.writestr(f'OEBPS/{name}.xhtml', f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title></head><body><h1>{title}</h1>{paragraphs}</body></html>', compress_type=ZIP_DEFLATED)
`

const SPEECH_SCRIPT = String.raw`
const url = 'https://raw.githubusercontent.com/openai/whisper/v20250625/tests/jfk.flac';
const expected = '63a4b1e4c1dc655ac70961ffbf518acd249df237e5a0152faae9a4a836949715';
const path = '/app/runtime/acceptance-fixtures/jfk.flac';
const hash = bytes => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
let bytes = await Bun.file(path).exists() ? await Bun.file(path).bytes() : undefined;
if (!bytes || hash(bytes) !== expected) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('Speech sample download failed: '+response.status);
  bytes = new Uint8Array(await response.arrayBuffer());
  if (hash(bytes) !== expected) throw new Error('Speech fixture checksum mismatch');
  await Bun.write(path, bytes);
}
await Bun.write('/fixtures/speech.flac', bytes);
console.log(JSON.stringify({url,sha256:expected,bytes:bytes.length}));
`

export async function prepareDockerFixtures(engine: DockerEngine, speech: boolean): Promise<void> {
  const dir = join(engine.options.output, 'fixtures')
  for (const [name, content] of Object.entries({
    'empty-config.json': '{}\n', 'text.md': 'The morning sky is blue. We are testing a local command.\n',
    'dialogue.txt': 'Host: The morning sky is blue.\nGuest: We are testing a local command.\n',
    'speech-fixed.vtt': 'WEBVTT\n\n00:00:00.000 --> 00:00:00.800\nshort line one\n\n00:00:00.900 --> 00:00:01.800\nshort line two\n',
    'urls.md': `${FIXTURE_ORIGIN}/speech.mp3\n${FIXTURE_ORIGIN}/speech.mp4\n`,
    'article.html': `<html><head><title>Local fixture article</title></head><body><article><h1>Local fixture article</h1>${'<p>This article describes a blue sky and a green field. It exists to verify local article extraction with Defuddle and the ordinary container entrypoint.</p>'.repeat(20)}</article></body></html>`,
    'feed.xml': `<?xml version="1.0"?><rss version="2.0"><channel><title>AutoShow Fixture Feed</title><link>${FIXTURE_ORIGIN}/</link><description>Local feed fixture</description><item><guid>fixture-1</guid><title>Fixture Episode</title><pubDate>Fri, 15 May 2026 12:00:00 GMT</pubDate><enclosure url="${FIXTURE_ORIGIN}/document.png" length="1234" type="image/png"/><enclosure url="${FIXTURE_ORIGIN}/speech.mp3" length="48000" type="audio/mpeg"/></item></channel></rss>`
  })) await Bun.write(join(dir, name), content)
  async function tool(binary: string, args: string[], network = 'none'): Promise<void> {
    engine.requireSuccess(await engine.container(args, network, engine.options.setupTimeoutMs, binary, true), `Prepare fixture (${binary})`)
  }
  await tool('python3', ['-c', DOCUMENT_SCRIPT])
  await tool('mutool', ['draw', '-r', '120', '-o', '/fixtures/document.png', '/fixtures/document.pdf', '1'])
  if (speech) {
    await tool('bun', ['--no-env-file', '-e', SPEECH_SCRIPT], 'bridge')
    await tool('ffmpeg', ['-y', '-i', '/fixtures/speech.flac', '-ar', '16000', '-ac', '1', '/fixtures/speech.wav'])
  }
  else await tool('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ar', '16000', '-ac', '1', '/fixtures/speech.wav'])
  await tool('ffmpeg', ['-y', '-i', '/fixtures/speech.wav', '/fixtures/speech.mp3'])
  await tool('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=10', '-i', '/fixtures/speech.wav', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '/fixtures/speech.mp4'])
  await tool('bun', ['--no-env-file', '-e', `await Bun.write('/fixtures/speech.png',Bun.file('/fixtures/document.png')); for (const name of ['01-batch-one','02-batch-two']) await Bun.write('/fixtures/batch/'+name+'.mp3',Bun.file('/fixtures/speech.mp3'));`])
}

const SERVER_SCRIPT = String.raw`
const files = new Map([['/speech.mp3','audio/mpeg'],['/speech.mp4','video/mp4'],['/document.png','image/png'],['/feed.xml','application/rss+xml'],['/article.html','text/html']]);
Bun.serve({hostname:'0.0.0.0',port:8787,fetch(request){
 const path = new URL(request.url).pathname;
 if(path==='/ready')return new Response('ready');
 if(!files.has(path))return new Response('not found',{status:404});
 return new Response(Bun.file('/fixtures'+path),{headers:{'content-type':files.get(path)}});
}});console.log('fixture ready');
`

export async function startDockerFixtureServer(engine: DockerEngine): Promise<void> {
  if (!engine.identity) throw new Error('Resolve the image before starting fixtures')
  const network = `${engine.runId}-network`
  engine.requireSuccess(await engine.command(['network', 'create', '--internal', '--label', `autoshow.acceptance=${engine.runId}`, network]), 'Create isolated fixture network')
  engine.fixtureNetwork = network
  const name = `${engine.runId}-fixture`
  engine.owned.add(name)
  const args = containerArguments(engine.identity, name, engine.runId, engine.mounts.filter(mount => mount.container === '/fixtures'), network, ['--no-env-file', '-e', SERVER_SCRIPT], 'bun')
  args.splice(1, 0, '--detach', '--network-alias', 'fixture')
  engine.requireSuccess(await engine.command(args), 'Start fixture server')
  engine.requireSuccess(await engine.container(['--no-env-file', '-e', `for(let i=0;i<30;i++){try {if((await fetch('${FIXTURE_ORIGIN}/ready',{signal:AbortSignal.timeout(1000)})).ok) process.exit(0)}catch{} await Bun.sleep(200)}process.exit(1)`], network, 30_000, 'bun'), 'Fixture readiness')
}
