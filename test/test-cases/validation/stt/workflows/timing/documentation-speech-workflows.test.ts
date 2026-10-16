import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TranscriptionResult } from '~/types'
import { childEnv } from '~/utils/child-env'
import { hasRuntimeTool } from '~/utils/runtime-paths'
import { createTempDirTracker } from '../../../../../test-utils/temp-dirs'

const AUDIO = 'input/examples/audio/01-two-speaker-speech-stereo.wav'
const TRANSCRIPT = 'input/examples/video/01-two-speaker-speech.transcript.json'
const MODEL = 'runtime/models/alignment/wav2vec2-base-960h-onnx'
const hasTiny = existsSync('runtime/bin/whisperfile/whisper-tiny.llamafile')
const hasAlignment = existsSync(join(MODEL, 'model.onnx')) && existsSync('config/stt-alignment/node_modules/onnxruntime-node/package.json')
const temporary = createTempDirTracker('autoshow-speech-documentation-')
afterAll(async () => await temporary.cleanup())
beforeAll(() => {
  for (const tool of ['ffmpeg', 'ffprobe'] as const) {
    if (!hasRuntimeTool(tool)) throw new Error(`Install ${tool} separately; speech workflow tests never download tools or models.`)
  }
})

const hashFile = async (path: string): Promise<string> => createHash('sha256').update(await Bun.file(path).bytes()).digest('hex')
const installedTest = (ready: boolean, name: string, run: () => Promise<void>): void => {
  if (ready) test(name, run, 90_000)
  else test.skip(`${name} (optional installed models absent; no download)`, run)
}
const readResult = async (path: string): Promise<TranscriptionResult> => await Bun.file(path).json() as TranscriptionResult
const positiveWords = (result: TranscriptionResult): void => {
  const words = result.evidence?.words ?? []
  expect(words.length).toBeGreaterThan(0)
  expect(words.every(word => Number.isFinite(word.startSeconds) && word.startSeconds >= 0 && Number.isFinite(word.endSeconds) && word.endSeconds > word.startSeconds)).toBe(true)
}
const workspace = async () => {
  const directory = await temporary.make()
  const config = join(directory, 'config.json'), preload = join(directory, 'network-forbidden.ts'), attempts = join(directory, 'network-attempts.txt')
  await Bun.write(config, '{}\n')
  await Bun.write(preload, `import { appendFileSync } from 'node:fs'\nglobalThis.fetch = () => { appendFileSync(${JSON.stringify(attempts)}, 'attempt\\n'); throw new Error('Network forbidden during speech workflow verification') }\n`)
  const run = async (args: string[]) => {
    const child = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', ...args, '--config-path', config, '--json'], {
      env: childEnv({ set: { HOME: directory } }), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(90_000)
    })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { exitCode, stdout, stderr }
  }
  return { directory, run, success: async (args: string[]) => {
    const completed = await run(args)
    expect(completed.exitCode, completed.stdout + completed.stderr).toBe(0)
  }, noNetwork: () => expect(existsSync(attempts)).toBe(false) }
}

test('offline review/edit/caption CLI preserves the licensed source and nonempty interpolated timing; stale edits and invalid artifacts fail', async () => {
  const work = await workspace(), review = join(work.directory, 'review'), reviewed = join(work.directory, 'reviewed')
  const originalHash = await hashFile(TRANSCRIPT)
  await work.success([TRANSCRIPT, '--transcript-review', '--output-dir', review])
  const packet = await Bun.file(join(review, 'transcript-review.json')).json()
  expect(packet.words).toHaveLength(67)
  expect(packet.words[4]).toMatchObject({ text: 'Look', startSeconds: 3, endSeconds: 3.25 })
  const editPath = join(review, 'edits.json'), edit = await Bun.file(editPath).json()
  expect(edit.sourceSha256).toBe(originalHash)
  edit.edits = [{ startWord: 4, deleteCount: 1, expectedText: 'Look', replacement: 'Look,', reason: 'Add punctuation; supplied subtitle words are unchanged.' }]
  await Bun.write(editPath, JSON.stringify(edit))
  await work.success([TRANSCRIPT, '--transcript-edits', editPath, '--output-dir', reviewed])
  const resultPath = join(reviewed, 'result.json'), result = await readResult(resultPath)
  positiveWords(result)
  expect(result.evidence?.words).toHaveLength(67)
  expect(result.evidence?.words?.[4]).toMatchObject({ text: 'Look,', startSeconds: 3, endSeconds: 3.25, timingSource: 'repaired' })
  const receipt = await Bun.file(join(reviewed, 'transcript-edits.json')).json()
  expect(receipt).toMatchObject({ sourceSha256: originalHash, sourceResultUnmodified: true, inferredSourceWords: 67 })
  expect(receipt.changes[0].timingMethod).toBe('original-boundaries')
  for (const mode of ['phrase', 'word']) {
    const output = join(work.directory, `captions-${mode}`)
    await work.success([resultPath, '--captions', '--caption-mode', mode, '--caption-format', 'both', '--output-dir', output])
    const captions = await Bun.file(join(output, 'captions.json')).json()
    expect(captions.source).toBe(resultPath)
    expect(captions.cues.length).toBe(mode === 'word' ? 67 : 11)
    expect(captions.cues.every((cue: { start: number, end: number, text: string }) => cue.end > cue.start && cue.text.trim())).toBe(true)
    expect(await Bun.file(join(output, 'captions.vtt')).text()).toStartWith('WEBVTT')
    expect(await Bun.file(join(output, 'captions.srt')).text()).toContain('-->')
  }
  edit.sourceSha256 = '0'.repeat(64)
  await Bun.write(editPath, JSON.stringify(edit))
  const stale = await work.run([TRANSCRIPT, '--transcript-edits', editPath, '--output-dir', join(work.directory, 'stale')])
  expect(stale.exitCode).not.toBe(0)
  expect(stale.stdout + stale.stderr).toContain('sourceSha256')
  expect(existsSync(join(work.directory, 'stale', 'result.json'))).toBe(false)
  const malformed = join(work.directory, 'malformed.json')
  await Bun.write(malformed, '{"text":"incomplete artifact"}')
  expect((await work.run([malformed, '--captions', '--output-dir', join(work.directory, 'bad-captions')])).exitCode).not.toBe(0)
  const coarse = await work.run([resultPath, '--timing-reference', TRANSCRIPT, '--output-dir', join(work.directory, 'coarse-reference')])
  expect(coarse.exitCode).not.toBe(0)
  expect(coarse.stdout + coarse.stderr).toContain('segment interpolation is not an acoustic measurement')
  expect(await hashFile(TRANSCRIPT)).toBe(originalHash)
  work.noNetwork()
}, 30_000)

installedTest(hasTiny, 'installed local tiny transcribes actual split channels before merge and fingerprinted review; no speaker identity or spoken-accuracy claim', async () => {
  const work = await workspace(), channels = join(work.directory, 'channels')
  await work.success([AUDIO, '--split-channels', '--output-dir', channels])
  const extraction = await Bun.file(join(channels, 'channels.json')).json()
  expect(extraction.channels).toHaveLength(2)
  expect(extraction.channels.map((channel: { sampleRate: number, channelIndex: number }) => [channel.sampleRate, channel.channelIndex])).toEqual([[16_000, 0], [16_000, 1]])
  const manifestPath = join(channels, 'channel-results.json'), manifest = await Bun.file(manifestPath).json()
  expect((await work.run([manifestPath, '--merge-channel-results', '--output-dir', join(work.directory, 'unfinished')])).exitCode).not.toBe(0)
  let expectedWords = 0
  for (const [index, channel] of manifest.channels.entries()) {
    const output = join(work.directory, `channel-${index + 1}`)
    await work.success([channel.audio, '--provider', 'whisperfile=tiny', '--output-dir', output])
    channel.result = join(output, 'result.json')
    const result = await readResult(channel.result)
    positiveWords(result)
    expectedWords += result.evidence!.words!.length
    expect(channel.id).toBe(extraction.channels[index].id)
    expect(channel.audio).toBe(extraction.channels[index].audio)
    expect(extraction.channels[index].decodedSha256).toMatch(/^SHA256=[a-f0-9]{64}$/)
  }
  await Bun.write(manifestPath, JSON.stringify(manifest))
  const merged = join(work.directory, 'merged')
  await work.success([manifestPath, '--merge-channel-results', '--output-dir', merged])
  const resultPath = join(merged, 'result.json'), result = await readResult(resultPath)
  positiveWords(result)
  expect(result.evidence?.words).toHaveLength(expectedWords)
  const labels = [...new Set(result.segments.flatMap(segment => segment.speaker ? [segment.speaker] : []))].sort()
  expect(labels).toEqual(['stream-0-channel-1', 'stream-0-channel-2'])
  const provenance = await Bun.file(join(merged, 'channel-merge.json')).json()
  for (const [index, channel] of provenance.channels.entries()) {
    expect(channel).toMatchObject({ id: manifest.channels[index].id, sha256: await hashFile(manifest.channels[index].result), appliedOffsetSeconds: 0 })
  }
  const review = join(work.directory, 'speaker-review')
  await work.success([resultPath, '--speaker-map-template', '--output-dir', review])
  const mapPath = join(review, 'speaker-map.json'), map = await Bun.file(mapPath).json()
  expect(map.sourceSha256).toBe(await hashFile(resultPath))
  expect(Object.keys(map.speakers).sort()).toEqual(labels)
  expect((await work.run([resultPath, '--speaker-map', mapPath, '--output-dir', join(work.directory, 'missing-reason')])).exitCode).not.toBe(0)
  map.reason = 'Retain channel identities: both channels contain mixed dialogue; no person assignment is established.'
  await Bun.write(mapPath, JSON.stringify(map))
  const reconciled = join(work.directory, 'reconciled')
  await work.success([resultPath, '--speaker-map', mapPath, '--output-dir', reconciled])
  expect(await readResult(join(reconciled, 'result.json'))).toEqual(result)
  expect(await Bun.file(join(reconciled, 'speaker-reconciliation.json')).json()).toMatchObject({ sourceSha256: map.sourceSha256, method: 'reviewed-explicit-map', reason: map.reason })
  map.speakers['nonexistent-speaker'] = 'Host'
  await Bun.write(mapPath, JSON.stringify(map))
  expect((await work.run([resultPath, '--speaker-map', mapPath, '--output-dir', join(work.directory, 'unknown-speaker')])).exitCode).not.toBe(0)
  const invalidResult = structuredClone(await readResult(manifest.channels[0].result))
  invalidResult.evidence!.words![0]!.endSeconds = invalidResult.evidence!.words![0]!.startSeconds
  const invalidPath = join(work.directory, 'invalid-words.json')
  await Bun.write(invalidPath, JSON.stringify(invalidResult))
  const invalidManifest = join(work.directory, 'invalid-channels.json')
  await Bun.write(invalidManifest, JSON.stringify({ ...manifest, channels: [{ ...manifest.channels[0], result: invalidPath }] }))
  const rejected = await work.run([invalidManifest, '--merge-channel-results', '--output-dir', join(work.directory, 'invalid-merge')])
  expect(rejected.exitCode).not.toBe(0)
  expect(rejected.stdout + rejected.stderr).toContain('invalid or negative timing')
  await Bun.write(invalidManifest, JSON.stringify({ ...manifest, channels: [{ ...manifest.channels[0], result: resultPath }] }))
  expect((await work.run([invalidManifest, '--merge-channel-results', '--output-dir', join(work.directory, 'double-merge')])).exitCode).not.toBe(0)
  work.noNetwork()
})

installedTest(hasTiny && hasAlignment, 'installed pinned ONNX rejects default low confidence, retains diagnostic provenance, and calibrates real tiny timing without acoustic-accuracy claims', async () => {
  const work = await workspace(), rejected = join(work.directory, 'rejected'), diagnostic = join(work.directory, 'diagnostic')
  // Independent documented asset identity; this test cannot invoke the installer or network.
  expect(await hashFile(join(MODEL, 'model.onnx'))).toBe('00b7cc69516c1ab63c429e63a2b543e4d42bb77441ec5b98ee935de175b00de1')
  const rejectedRun = await work.run([AUDIO, '--align-transcript', TRANSCRIPT, '--alignment-model', MODEL, '--output-dir', rejected])
  expect(rejectedRun.exitCode).not.toBe(0)
  expect(existsSync(join(rejected, 'result.json'))).toBe(false)
  const rejectedReport = await Bun.file(join(rejected, 'alignment.json')).json()
  expect(rejectedReport.review.length).toBeGreaterThan(0)
  expect(rejectedReport.review.every((word: { confidence: number }) => word.confidence < .1)).toBe(true)
  await work.success([AUDIO, '--align-transcript', TRANSCRIPT, '--alignment-model', MODEL, '--alignment-min-confidence', '0', '--output-dir', diagnostic])
  const referencePath = join(diagnostic, 'result.json'), reference = await Bun.file(referencePath).json()
  positiveWords(reference)
  expect(reference.evidence.words).toHaveLength(67)
  expect(reference.referenceProvenance).toMatchObject({ kind: 'automatic-alignment', manuallyVerified: false, minimumConfidence: 0, audioSha256: await hashFile(AUDIO), sourceSha256: await hashFile(TRANSCRIPT), lowConfidenceWordCount: rejectedReport.lowConfidenceWords.length })
  const calibration = join(work.directory, 'calibration')
  await work.success([AUDIO, '--calibrate-whisper', '--timing-reference', referencePath, '--whisper-calibration-model', 'tiny', '--output-dir', calibration])
  const report = await Bun.file(join(calibration, 'calibration.json')).json()
  expect(report).toMatchObject({ schemaVersion: 1, engine: 'whisperfile', model: 'tiny', defaultsChanged: false, referenceSha256: await hashFile(referencePath), audioSha256: await hashFile(AUDIO) })
  expect(report.referenceProvenance).toEqual(reference.referenceProvenance)
  expect(report.variants.length).toBeGreaterThan(0)
  const standard = report.variants.find((variant: { mode: string }) => variant.mode === 'standard')
  expect(standard.matchedWords).toBeGreaterThan(0)
  expect(standard.referenceCoverage).toBeGreaterThan(0)
  expect(standard.referenceCoverage).toBeLessThan(1)
  expect([...report.variants, ...report.unsupportedVariants, ...report.rejectedVariants].filter((variant: { mode: string }) => variant.mode === 'dtw')).toHaveLength(1)
  const comparison = join(work.directory, 'comparison')
  await work.success([standard.result, '--timing-reference', referencePath, '--output-dir', comparison])
  const measured = await Bun.file(join(comparison, 'timing-comparison.json')).json()
  expect(measured.referenceProvenance).toEqual(reference.referenceProvenance)
  expect(measured.matchedWords).toBe(standard.matchedWords)
  expect(measured.referenceSha256).toBe(await hashFile(referencePath))
  const invalid = structuredClone(reference), invalidPath = join(work.directory, 'invalid-reference.json')
  invalid.evidence.words[0].endSeconds = invalid.evidence.words[0].startSeconds
  await Bun.write(invalidPath, JSON.stringify(invalid))
  expect((await work.run([standard.result, '--timing-reference', invalidPath, '--output-dir', join(work.directory, 'invalid-comparison')])).exitCode).not.toBe(0)
  invalid.referenceProvenance.audioSha256 = '0'.repeat(64)
  await Bun.write(invalidPath, JSON.stringify(invalid))
  const mismatch = await work.run([AUDIO, '--calibrate-whisper', '--timing-reference', invalidPath, '--output-dir', join(work.directory, 'wrong-audio')])
  expect(mismatch.exitCode).not.toBe(0)
  expect(mismatch.stdout + mismatch.stderr).toContain('audio fingerprint')
  expect(existsSync(join(work.directory, 'wrong-audio', 'standard'))).toBe(false)
  work.noNetwork()
})
