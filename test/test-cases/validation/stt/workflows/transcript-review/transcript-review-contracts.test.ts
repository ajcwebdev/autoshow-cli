import { test, expect } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('CLI review and edit application preserve evidence, distinguish interpolation, and reject stale or crossing edits offline', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'transcript review '))
  try {
    const source = join(dir, 'original.json'), preload = join(dir, 'offline.ts')
    await Bun.write(preload, `globalThis.fetch = () => { throw new Error('NETWORK FORBIDDEN') }`)
    const word = (text: string, startSeconds: number, endSeconds: number, speaker: string) => ({ text, normalized: text.toLowerCase(), startSeconds, endSeconds, speaker, timingSource: 'native' })
    const original = JSON.stringify({ text: 'Hello there there. Yes.', segments: [
      { start: '00:00:00.100', end: '00:00:01.300', text: 'Hello there there.', speaker: 'speaker-A' },
      { start: '00:00:02.000', end: '00:00:02.500', text: 'Yes.', speaker: 'speaker-B' }
    ], evidence: { words: [word('Hello', .1, .4, 'speaker-A'), word('there', .5, .8, 'speaker-A'), word('there.', .9, 1.3, 'speaker-A'), word('Yes.', 2, 2.5, 'speaker-B')] } })
    await Bun.write(source, original)
    const run = async (flags: string[]) => {
      const child = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', source, '--json', ...flags], { stdout: 'pipe', stderr: 'pipe' })
      const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      return { out, err, code }
    }
    const reviewDir = join(dir, 'review')
    expect((await run(['--transcript-review', '--output-dir', reviewDir])).code).toBe(0)
    const packet = await Bun.file(join(reviewDir, 'transcript-review.json')).json()
    expect(packet.words.map((word: { index: number }) => word.index)).toEqual([0, 1, 2, 3])
    const edits = join(reviewDir, 'edits.json')
    const writeEdits = async (entries: unknown[], sourceSha256 = packet.sourceSha256) => Bun.write(edits, JSON.stringify({ schemaVersion: 1, sourceSha256, edits: entries }))
    await writeEdits([{ startWord: 1, deleteCount: 1, expectedText: 'there', replacement: 'dear friend', reason: 'Test explicit expansion' }, { startWord: 3, deleteCount: 1, expectedText: 'Yes.', replacement: 'Yeah.', reason: 'Test spelling edit' }])
    const outputDir = join(dir, 'edited')
    const args = ['--transcript-edits', edits, '--output-dir', outputDir]
    const applied = await run(args)
    expect(applied, applied.err).toMatchObject({ code: 0 })
    const result = await Bun.file(join(outputDir, 'result.json')).json()
    expect(result.text).toBe('Hello dear friend there. Yeah.')
    expect(result.evidence.words[0]).toMatchObject({ text: 'Hello', startSeconds: .1, endSeconds: .4 })
    expect(result.evidence.words[1]).toMatchObject({ text: 'dear', startSeconds: .5, timingSource: 'interpolated' })
    expect(result.evidence.words[3]).toMatchObject({ text: 'there.', startSeconds: .9, endSeconds: 1.3 })
    expect(result.evidence.words[4]).toMatchObject({ text: 'Yeah.', startSeconds: 2, endSeconds: 2.5, speaker: 'speaker-B', timingSource: 'repaired' })
    expect(result.segments.map(({ text: _text, ...segment }: { text: string }) => segment)).toEqual(JSON.parse(original).segments.map(({ text: _text, ...segment }: { text: string }) => segment))
    expect(await Bun.file(source).text()).toBe(original)
    expect((await run(args)).code).not.toBe(0)
    const invalidCases = [
      [{ startWord: 1, deleteCount: 1, expectedText: 'wrong', replacement: 'word', reason: 'test' }],
      [{ startWord: 2, deleteCount: 2, expectedText: 'there. Yes.', replacement: 'Combined.', reason: 'crossed turn' }],
      [{ startWord: 1, deleteCount: 2, expectedText: 'there there.', replacement: 'x', reason: 'test' }, { startWord: 2, deleteCount: 1, expectedText: 'there.', replacement: 'y', reason: 'overlap' }]
    ]
    for (const entries of invalidCases) {
      await writeEdits(entries)
      expect((await run(['--transcript-edits', edits, '--output-dir', join(dir, 'invalid')])).code).not.toBe(0)
    }
    await writeEdits([], 'stale')
    expect((await run(['--transcript-edits', edits, '--output-dir', join(dir, 'stale')])).code).not.toBe(0)
    const invalidTimingSource = JSON.stringify({ text: 'Hello Mmm. Mmm. Yes.', segments: [
      { start: '00:00:00.100', end: '00:00:00.400', text: 'Hello', speaker: 'speaker-A' },
      { start: '00:00:00.500', end: '00:00:00.800', text: 'Mmm. Mmm.', speaker: 'speaker-B' },
      { start: '00:00:02.000', end: '00:00:02.500', text: 'Yes.', speaker: 'speaker-C' }
    ], evidence: { words: [word('Hello', .1, .4, 'speaker-A'), word('Mmm.', .5, .8, 'speaker-B'), word('Mmm.', .8, .8, 'speaker-B'), word('Yes.', 2, 2.5, 'speaker-C')] } })
    await Bun.write(source, invalidTimingSource)
    const repairDir = join(dir, 'repair-review')
    expect((await run(['--transcript-review', '--output-dir', repairDir])).code).toBe(0)
    const repairPacket = await Bun.file(join(repairDir, 'transcript-review.json')).json()
    expect(repairPacket.invalidSourceWords).toBe(1)
    expect(repairPacket.invalidReviewWordIndices).toEqual([2])
    await writeEdits([], repairPacket.sourceSha256)
    expect((await run(['--transcript-edits', edits, '--output-dir', join(dir, 'not-repaired')])).code).not.toBe(0)
    await writeEdits([{ startWord: 1, deleteCount: 2, expectedText: 'Mmm. Mmm.', replacement: '', reason: 'Explicitly remove repetitive provider artifact' }], repairPacket.sourceSha256)
    const repairedDir = join(dir, 'repaired')
    const repairedRun = await run(['--transcript-edits', edits, '--output-dir', repairedDir])
    expect(repairedRun, repairedRun.err).toMatchObject({ code: 0 })
    expect((await Bun.file(join(repairedDir, 'result.json')).json()).text).toBe('Hello Yes.')
    expect((await Bun.file(join(repairedDir, 'transcript-edits.json')).json()).removedSegments).toHaveLength(1)
    expect(await Bun.file(source).text()).toBe(invalidTimingSource)
  } finally { await rm(dir, { recursive: true, force: true }) }
}, 30_000)
